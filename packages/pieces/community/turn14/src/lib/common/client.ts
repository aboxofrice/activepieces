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
// error from Turn14's error title alone. Exchanging credentials creates nothing, so every failure
// may be retried.
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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }));
    if (error) {
        if (attempt < MAX_ATTEMPTS) {
            await sleep({ ms: backoffMs({ attempt }) });
            return requestToken({ auth, attempt: attempt + 1 });
        }
        throw new Error(`Turn14 token request failed: ${isTimeout({ error }) ? `no answer within ${REQUEST_TIMEOUT_MS / 1000}s` : error.message}`);
    }
    const { data: text } = await tryCatch(() => response.text());
    const body = parseBody({ text: text ?? '' });
    if (response.ok && isRecord(body) && typeof body['access_token'] === 'string') {
        return { access_token: body['access_token'], expires_in: typeof body['expires_in'] === 'number' ? body['expires_in'] : undefined };
    }
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
        await pauseBeforeRetry({ response, attempt });
        return requestToken({ auth, attempt: attempt + 1 });
    }
    throw new Turn14Error({ status: response.status, message: `Turn14 token request failed: HTTP ${response.status}: ${errorText({ body })}` });
}

async function tryGetToken({ auth }: { auth: Turn14AuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getToken({ auth }));
    return { error: error ? error.message : null };
}

function apiBase({ auth }: { auth: Turn14AuthProps }): string {
    return isTestingHost({ auth }) ? TESTING_BASE_URL : PRODUCTION_BASE_URL;
}

function isTestingHost({ auth }: { auth: Turn14AuthProps }): boolean {
    return auth.environment === 'testing';
}

// Every Turn14 call goes through fetch so that no failure path can echo a request body: quote and
// order bodies carry the recipient's name, address and phone number. `validate` checks the parsed
// body, so an empty or unexpected answer fails here with a clear message instead of later with a
// TypeError.
async function request<T>({ auth, method, path, queryParams, body, validate }: Turn14Request<T>): Promise<T> {
    const first = await tryCatch(() => send({ auth, method, path, queryParams, body, validate }));
    if (!first.error) {
        return first.data;
    }
    if (!(first.error instanceof Turn14Error) || first.error.status !== 401) {
        throw first.error;
    }
    // A cached token can be revoked or expire early; one fresh exchange settles which it is.
    // A 401 means Turn14 did not process the call, so a POST may repeat too.
    tokenCache.delete(tokenCacheKey({ auth }));
    return send({ auth, method, path, queryParams, body, validate });
}

async function send<T>({ auth, method, path, queryParams, body, validate, attempt = 1 }: Turn14Request<T> & { attempt?: number }): Promise<T> {
    const token = await getToken({ auth });
    await waitForSlot();
    const url = `${apiBase({ auth })}${normalizePath({ path })}${queryString({ queryParams })}`;
    const retry = (): Promise<T> => send({ auth, method, path, queryParams, body, validate, attempt: attempt + 1 });
    const { data: response, error } = await tryCatch(() => fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }));
    if (error) {
        if (method === 'GET' && attempt < MAX_ATTEMPTS) {
            await sleep({ ms: backoffMs({ attempt }) });
            return retry();
        }
        throw transportError({ method, path, error });
    }
    const { data: text, error: readError } = await tryCatch(() => response.text());
    if (readError) {
        if (method === 'GET' && attempt < MAX_ATTEMPTS) {
            await sleep({ ms: backoffMs({ attempt }) });
            return retry();
        }
        throw transportError({ method, path, error: readError });
    }
    const parsed = parseBody({ text });
    if (response.ok) {
        if (validate(parsed)) {
            return parsed;
        }
        throw new Turn14Error({
            status: response.status,
            message: `Turn14 ${method} ${path} returned ${parsed === null ? 'an empty response' : 'a response in an unexpected format'} (HTTP ${response.status}).`,
        });
    }
    // A 429 is refused before any work is done, so every method may repeat it. A 5xx may mean a
    // quote or order was created before the gateway gave up, so only reads repeat those.
    const retryable = response.status === 429 || (method === 'GET' && response.status >= 500);
    if (retryable && attempt < MAX_ATTEMPTS) {
        await pauseBeforeRetry({ response, attempt });
        return retry();
    }
    const message = `Turn14 ${method} ${path} failed: HTTP ${response.status}: ${errorText({ body: parsed })}`;
    if (method === 'POST' && response.status >= 500) {
        throw new Turn14OutcomeUnknownError({ status: response.status, message: `${message}. ${OUTCOME_UNKNOWN_ADVICE}` });
    }
    throw new Turn14Error({ status: response.status, message });
}

// Turn14 list endpoints page with ?page=N and report meta.total_pages. The reducer sees each page
// as it arrives and may stop the scan; nothing is accumulated beyond what it keeps.
async function scanPages<T, A>({ auth, path, queryParams, maxPages, startPage = 1, deadline, initial, reduce }: ScanPagesParams<T, A>): Promise<ScanResult<A>> {
    const step = async ({ page, acc }: { page: number; acc: A }): Promise<ScanResult<A>> => {
        const pagesRead = page - startPage;
        if (deadline !== undefined && Date.now() >= deadline) {
            return { acc, totalPages: null, pagesRead, nextPage: page, stoppedBy: 'deadline' };
        }
        const response = await request({ auth, method: 'GET', path, queryParams: { ...queryParams, page }, validate: isListResponse<T> });
        const rows = response.data ?? [];
        const totalPages = response.meta?.total_pages ?? page;
        const reduced = reduce({ acc, rows, page });
        const lastPage = page >= totalPages || rows.length === 0;
        if (reduced.done) {
            return { acc: reduced.acc, totalPages, pagesRead: pagesRead + 1, nextPage: lastPage ? null : page + 1, stoppedBy: 'reducer' };
        }
        if (lastPage) {
            return { acc: reduced.acc, totalPages, pagesRead: pagesRead + 1, nextPage: null, stoppedBy: 'complete' };
        }
        if (pagesRead + 1 >= maxPages) {
            return { acc: reduced.acc, totalPages, pagesRead: pagesRead + 1, nextPage: page + 1, stoppedBy: 'maxPages' };
        }
        return step({ page: page + 1, acc: reduced.acc });
    };
    return step({ page: startPage, acc: initial });
}

async function fetchPages<T>({ auth, path, queryParams, maxPages, startPage, deadline }: FetchPagesParams): Promise<FetchPagesResult<T>> {
    const result = await scanPages<T, T[]>({
        auth,
        path,
        queryParams,
        maxPages,
        startPage,
        deadline,
        initial: [],
        reduce: ({ acc, rows }) => ({ acc: [...acc, ...rows], done: false }),
    });
    return {
        rows: result.acc,
        totalPages: result.totalPages ?? 0,
        pagesRead: result.pagesRead,
        nextPage: result.nextPage,
        truncated: result.nextPage !== null,
    };
}

async function waitForSlot(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, nextSlotAt);
    nextSlotAt = slot + MIN_REQUEST_SPACING_MS;
    if (slot > now) {
        await sleep({ ms: slot - now });
    }
}

// Honour Turn14's Retry-After, and hold back every other request from this sandbox until then.
async function pauseBeforeRetry({ response, attempt }: { response: Response; attempt: number }): Promise<void> {
    const waitMs = retryAfterMs({ header: response.headers.get('retry-after'), now: Date.now() }) ?? backoffMs({ attempt });
    nextSlotAt = Math.max(nextSlotAt, Date.now() + waitMs);
    await sleep({ ms: waitMs });
}

function retryAfterMs({ header, now }: { header: string | null; now: number }): number | null {
    if (header === null || header.trim().length === 0) {
        return null;
    }
    const trimmed = header.trim();
    const seconds = /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) * 1000 : Date.parse(trimmed) - now;
    if (Number.isNaN(seconds)) {
        return null;
    }
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, seconds));
}

function transportError({ method, path, error }: { method: Turn14Method; path: string; error: Error }): Error {
    const reason = isTimeout({ error }) ? `no answer within ${REQUEST_TIMEOUT_MS / 1000}s` : error.message;
    if (method === 'POST') {
        return new Turn14OutcomeUnknownError({ status: 0, message: `Turn14 POST ${path}: ${reason}. ${OUTCOME_UNKNOWN_ADVICE}` });
    }
    return new Error(`Turn14 ${method} ${path} failed: ${reason}`);
}

function isTimeout({ error }: { error: Error }): boolean {
    return error.name === 'TimeoutError' || error.name === 'AbortError';
}

function parseBody({ text }: { text: string }): unknown {
    if (text.trim().length === 0) {
        return null;
    }
    const { data, error } = tryCatchSync((): unknown => JSON.parse(text));
    return error ? text : data;
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

// Turn14 resources are JSON:API-style {id, type, attributes}. The guards check the envelope and
// the id; attribute types are trusted to match Turn14's documented shape.
function isResource(value: unknown): value is Turn14Resource {
    return isRecord(value) && (typeof value['id'] === 'string' || typeof value['id'] === 'number');
}

function isSingleResponse<T extends Turn14Resource>(value: unknown): value is { data: T } {
    return isRecord(value) && isResource(value['data']);
}

function isListResponse<T>(value: unknown): value is ListResponse<T> {
    if (!isRecord(value)) {
        return false;
    }
    const data = value['data'];
    return data === undefined || (Array.isArray(data) && data.every(isResource));
}

// Writes return whatever Turn14 sends, including nothing at all (an empty 200/204 parses to null).
function isAnyBody(value: unknown): value is unknown {
    return value !== undefined;
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

// The request may or may not have been carried out by Turn14 (timeout, dropped connection or a
// gateway error after the body was sent).
class Turn14OutcomeUnknownError extends Turn14Error {}

const PRODUCTION_BASE_URL = 'https://api.turn14.com';
const TESTING_BASE_URL = 'https://apitest.turn14.com';
const DEFAULT_TOKEN_LIFETIME_S = 3600;
const TOKEN_RENEW_EARLY_MS = 5 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 60 * 1000;
const MIN_REQUEST_SPACING_MS = 220;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 20000;
const MAX_RETRY_AFTER_MS = 30_000;
const JITTER_MS = 500;
const MAX_ERROR_TEXT = 300;
const OUTCOME_UNKNOWN_ADVICE = 'The outcome is UNKNOWN: Turn14 may have created it. Check List Open Orders / Get Order for this PO number before running it again.';

export const turn14Client = {
    apiBase,
    isTestingHost,
    getToken,
    tryGetToken,
    request,
    scanPages,
    fetchPages,
    retryAfterMs,
    isRecord,
    isSingleResponse,
    isListResponse,
    isAnyBody,
    Turn14Error,
    Turn14OutcomeUnknownError,
    REQUEST_TIMEOUT_MS,
};

export type Turn14AuthProps = {
    clientId: string;
    clientSecret: string;
    environment?: string;
};

export type Turn14Query = Record<string, string | number | boolean | undefined | null>;

export type Turn14Resource = { id: string | number };

export type ListResponse<T> = {
    data?: T[];
    meta?: { total_pages?: number };
    links?: Record<string, string>;
};

export type Turn14Method = 'GET' | 'POST';

export type ScanResult<A> = {
    acc: A;
    totalPages: number | null;
    pagesRead: number;
    nextPage: number | null;
    stoppedBy: 'complete' | 'reducer' | 'maxPages' | 'deadline';
};

export type FetchPagesResult<T> = {
    rows: T[];
    totalPages: number;
    pagesRead: number;
    nextPage: number | null;
    truncated: boolean;
};

type Turn14Request<T> = {
    auth: Turn14AuthProps;
    method: Turn14Method;
    path: string;
    queryParams?: Turn14Query;
    body?: unknown;
    validate: (value: unknown) => value is T;
};

type ScanPagesParams<T, A> = {
    auth: Turn14AuthProps;
    path: string;
    queryParams?: Turn14Query;
    maxPages: number;
    startPage?: number;
    deadline?: number;
    initial: A;
    reduce: (input: { acc: A; rows: T[]; page: number }) => { acc: A; done: boolean };
};

type FetchPagesParams = {
    auth: Turn14AuthProps;
    path: string;
    queryParams?: Turn14Query;
    maxPages: number;
    startPage?: number;
    deadline?: number;
};

type TokenResponse = {
    access_token: string;
    expires_in?: number;
};
