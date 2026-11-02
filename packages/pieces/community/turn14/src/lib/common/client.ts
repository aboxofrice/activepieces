import { createHash } from 'crypto';
import { tryCatch, tryCatchSync } from '@activepieces/shared';

// Turn14 tokens last an hour. A flow that runs several actions in one sandbox should not
// exchange the client secret on every request.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// Turn14 rejects more than 5 GET requests per second per account with a 429, so requests from
// one sandbox are spaced out instead of being fired in parallel and retried.
let nextSlotAt = 0;

async function getToken({ auth }: { auth: Turn14AuthProps }): Promise<string> {
    const cacheKey = tokenCacheKey({ auth });
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const response = await requestToken({ auth });
    const lifetimeMs = (response.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000;
    tokenCache.set(cacheKey, { token: response.access_token, expiresAt: Date.now() + Math.max(MIN_TOKEN_TTL_MS, lifetimeMs - TOKEN_RENEW_EARLY_MS) });
    return response.access_token;
}

// pieces-common's httpClient logs the request body when a call fails, and for this call the body
// is the client secret. The token goes to a fixed Turn14 host, so it uses fetch and builds its
// error from Turn14's error title alone.
async function requestToken({ auth, attempt = 1 }: { auth: Turn14AuthProps; attempt?: number }): Promise<TokenResponse> {
    await waitForSlot();
    const { data: response, error } = await tryCatch(() => fetch(`${apiBase({ auth })}/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: auth.clientId.trim(),
            client_secret: auth.clientSecret.trim(),
        }),
    }));
    if (error) {
        throw new Error(`Turn14 token request failed: ${error.message}`);
    }
    const body = await readBody({ response });
    if (response.ok && isRecord(body) && typeof body['access_token'] === 'string') {
        return { access_token: body['access_token'], expires_in: typeof body['expires_in'] === 'number' ? body['expires_in'] : undefined };
    }
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
        await sleep({ ms: backoffMs({ attempt }) });
        return requestToken({ auth, attempt: attempt + 1 });
    }
    throw new Turn14Error({ status: response.status, message: `Turn14 token request failed: HTTP ${response.status}: ${errorText({ body })}` });
}

async function tryGetToken({ auth }: { auth: Turn14AuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getToken({ auth }));
    return { error: error ? error.message : null };
}

function apiBase({ auth }: { auth: Turn14AuthProps }): string {
    return auth.environment === 'testing' ? TESTING_BASE_URL : PRODUCTION_BASE_URL;
}

// Every Turn14 call goes through fetch so that no failure path can echo a request body: quote and
// order bodies carry the recipient's name, address and phone number.
async function request<T>({ auth, method, path, queryParams, body }: Turn14Request): Promise<T> {
    const first = await tryCatch(() => send<T>({ auth, method, path, queryParams, body }));
    if (!first.error) {
        return first.data;
    }
    if (!(first.error instanceof Turn14Error) || first.error.status !== 401) {
        throw first.error;
    }
    // A cached token can be revoked or expire early; one fresh exchange settles which it is.
    tokenCache.delete(tokenCacheKey({ auth }));
    return send<T>({ auth, method, path, queryParams, body });
}

async function send<T>({ auth, method, path, queryParams, body, attempt = 1 }: Turn14Request & { attempt?: number }): Promise<T> {
    const token = await getToken({ auth });
    await waitForSlot();
    const url = `${apiBase({ auth })}${normalizePath({ path })}${queryString({ queryParams })}`;
    const { data: response, error } = await tryCatch(() => fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    }));
    if (error) {
        if (method === 'GET' && attempt < MAX_ATTEMPTS) {
            await sleep({ ms: backoffMs({ attempt }) });
            return send<T>({ auth, method, path, queryParams, body, attempt: attempt + 1 });
        }
        throw new Error(`Turn14 ${method} ${path} failed: ${error.message}`);
    }
    const text = await response.text().catch(() => '');
    if (response.ok) {
        return parseJson<T>({ text });
    }
    const responseBody = parseBody({ text });
    // A 5xx may mean a quote or order was created before the gateway gave up, so only reads repeat.
    const retryable = method === 'GET' && (response.status === 429 || response.status >= 500);
    if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep({ ms: backoffMs({ attempt }) });
        return send<T>({ auth, method, path, queryParams, body, attempt: attempt + 1 });
    }
    throw new Turn14Error({ status: response.status, message: `Turn14 ${method} ${path} failed: HTTP ${response.status}: ${errorText({ body: responseBody })}` });
}

// Turn14 list endpoints page with ?page=N and report meta.total_pages.
async function fetchPages<T>({ auth, path, queryParams, maxPages, startPage = 1 }: FetchPagesParams): Promise<{ rows: T[]; totalPages: number; pagesRead: number }> {
    const collect = async ({ page, collected }: { page: number; collected: T[] }): Promise<{ rows: T[]; totalPages: number; pagesRead: number }> => {
        const response = await request<ListResponse<T>>({ auth, method: 'GET', path, queryParams: { ...queryParams, page } });
        const rows = [...collected, ...(response.data ?? [])];
        const totalPages = response.meta?.total_pages ?? page;
        const pagesRead = page - startPage + 1;
        if (page >= totalPages || pagesRead >= maxPages || (response.data ?? []).length === 0) {
            return { rows, totalPages, pagesRead };
        }
        return collect({ page: page + 1, collected: rows });
    };
    return collect({ page: startPage, collected: [] });
}

async function waitForSlot(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, nextSlotAt);
    nextSlotAt = slot + MIN_REQUEST_SPACING_MS;
    if (slot > now) {
        await sleep({ ms: slot - now });
    }
}

async function readBody({ response }: { response: Response }): Promise<unknown> {
    const text = await response.text().catch(() => '');
    return parseBody({ text });
}

function parseBody({ text }: { text: string }): unknown {
    if (text.length === 0) {
        return null;
    }
    const { data, error } = tryCatchSync((): unknown => JSON.parse(text));
    return error ? text : data;
}

// Responses are trusted to match the documented Turn14 shape, as httpClient.sendRequest<T> does.
function parseJson<T>({ text }: { text: string }): T {
    return text.length === 0 ? null : JSON.parse(text);
}

// Turn14 errors look like {"errors":{"status":"404","title":"..."}} or {"errors":[{...}]}.
function errorText({ body }: { body: unknown }): string {
    if (isRecord(body)) {
        const errors = body['errors'];
        const list = Array.isArray(errors) ? errors : [errors];
        const titles = list.filter(isRecord).map((entry) => [entry['title'], entry['detail']].filter((part) => typeof part === 'string' && part.length > 0).join(' - ')).filter((title) => title.length > 0);
        if (titles.length > 0) {
            return titles.join('; ');
        }
        if (typeof body['error'] === 'string') {
            return [body['error'], body['error_description']].filter((part) => typeof part === 'string').join(' - ');
        }
    }
    if (typeof body === 'string' && body.length > 0) {
        return body.slice(0, MAX_ERROR_TEXT);
    }
    return 'no error details';
}

function normalizePath({ path }: { path: string }): string {
    const withSlash = path.startsWith('/') ? path : `/${path}`;
    return withSlash.startsWith('/v1/') ? withSlash : `/v1${withSlash}`;
}

function queryString({ queryParams }: { queryParams?: Turn14Query }): string {
    const entries = Object.entries(queryParams ?? {})
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
        .map(([key, value]) => [key, String(value)]);
    return entries.length === 0 ? '' : `?${new URLSearchParams(entries).toString()}`;
}

function backoffMs({ attempt }: { attempt: number }): number {
    return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1)) + Math.floor(Math.random() * JITTER_MS);
}

function sleep({ ms }: { ms: number }): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tokenCacheKey({ auth }: { auth: Turn14AuthProps }): string {
    return createHash('sha256').update(`${apiBase({ auth })}|${auth.clientId}|${auth.clientSecret}`).digest('hex');
}

class Turn14Error extends Error {
    readonly status: number;

    constructor({ status, message }: { status: number; message: string }) {
        super(message);
        this.status = status;
    }
}

const PRODUCTION_BASE_URL = 'https://api.turn14.com';
const TESTING_BASE_URL = 'https://apitest.turn14.com';
const DEFAULT_TOKEN_LIFETIME_S = 3600;
const TOKEN_RENEW_EARLY_MS = 5 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 60 * 1000;
const MIN_REQUEST_SPACING_MS = 220;
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 20000;
const JITTER_MS = 500;
const MAX_ERROR_TEXT = 300;

export const turn14Client = { apiBase, getToken, tryGetToken, request, fetchPages, isRecord, Turn14Error };

export type Turn14AuthProps = {
    clientId: string;
    clientSecret: string;
    environment?: string;
};

export type Turn14Query = Record<string, string | number | boolean | undefined | null>;

export type ListResponse<T> = {
    data?: T[];
    meta?: { total_pages?: number };
    links?: Record<string, string>;
};

export type Turn14Method = 'GET' | 'POST';

type Turn14Request = {
    auth: Turn14AuthProps;
    method: Turn14Method;
    path: string;
    queryParams?: Turn14Query;
    body?: unknown;
};

type FetchPagesParams = {
    auth: Turn14AuthProps;
    path: string;
    queryParams?: Turn14Query;
    maxPages: number;
    startPage?: number;
};

type TokenResponse = {
    access_token: string;
    expires_in?: number;
};
