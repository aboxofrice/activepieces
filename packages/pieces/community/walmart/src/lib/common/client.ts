import { createHash, randomUUID } from 'node:crypto';
import { HttpMethod } from '@activepieces/pieces-common';
import { tryCatch, tryCatchSync } from '@activepieces/shared';
import { walmartJson } from './json';
import { REQUEST_TIMEOUT_MS, RetryableFailure, walmartRetry } from './retry';

// Walmart tokens last 15 minutes and /v3/token is itself rate limited, so a flow that
// runs many requests must not log in once per request.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function apiBase({ auth }: { auth: WalmartAuthProps }): string {
    return auth.environment === WALMART_ENVIRONMENT.SANDBOX ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
}

function baseHeaders(): Record<string, string> {
    return {
        'WM_SVC.NAME': SERVICE_NAME,
        'WM_QOS.CORRELATION_ID': randomUUID(),
        Accept: 'application/json',
    };
}

async function getToken({ auth }: { auth: WalmartAuthProps }): Promise<string> {
    const cacheKey = tokenCacheKey({ auth });
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const basic = Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString('base64');
    const response = await sendWithRetry<unknown>({
        request: {
            method: HttpMethod.POST,
            url: `${apiBase({ auth })}/v3/token`,
            headers: {
                ...baseHeaders(),
                Authorization: `Basic ${basic}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        },
        safeToRepeat: true,
    });
    if (!isRecord(response) || typeof response['access_token'] !== 'string') {
        throw new Error('Walmart token response had no access token.');
    }
    const lifetimeMs = (typeof response['expires_in'] === 'number' ? response['expires_in'] : DEFAULT_TOKEN_LIFETIME_S) * 1000;
    const entry = {
        token: response['access_token'],
        expiresAt: Date.now() + Math.max(MIN_TOKEN_TTL_MS, lifetimeMs - TOKEN_RENEW_EARLY_MS),
    };
    tokenCache.set(cacheKey, entry);
    return entry.token;
}

async function tryGetToken({ auth }: { auth: WalmartAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getToken({ auth }));
    return { error: error ? describeError({ error }) : null };
}

// A stale cached token is recovered by retrying a 401 once with a fresh one, so the
// clock arithmetic in getToken() need not be exact.
async function request<T>({ auth, method, path, queryParams, body, headers }: WalmartRequest): Promise<T> {
    const send = async ({ accessToken }: { accessToken: string }) => sendWithRetry<T>({
        request: {
            method,
            url: withQuery({ url: `${apiBase({ auth })}${path}`, queryParams }),
            headers: {
                ...baseHeaders(),
                'WM_SEC.ACCESS_TOKEN': accessToken,
                ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
                ...headers,
            },
            body: body === undefined || body instanceof FormData || typeof body === 'string' ? body : JSON.stringify(body),
        },
        safeToRepeat: method === HttpMethod.GET,
    });

    const first = await tryCatch(async () => send({ accessToken: await getToken({ auth }) }));
    if (!first.error) {
        return first.data;
    }
    if (!isStatus({ error: first.error, status: 401 })) {
        throw apiError({ method, path, error: first.error });
    }
    tokenCache.delete(tokenCacheKey({ auth }));
    const retry = await tryCatch(async () => send({ accessToken: await getToken({ auth }) }));
    if (retry.error) {
        throw apiError({ method, path, error: retry.error });
    }
    return retry.data;
}

// fetch rather than pieces-common's httpClient: its HttpError drops the response headers
// (Retry-After, x-next-replenish-time) and embeds the request body in its message.
async function sendWithRetry<T>({ request, safeToRepeat, attempt = 1, startedAt = Date.now() }: SendParams): Promise<T> {
    const { data, error } = await tryCatch(() => sendOnce<T>({ request }));
    if (!error) {
        return data;
    }
    const failure = retryableFailure({ error });
    const delay = failure === null ? null : walmartRetry.delayBeforeRetry({ failure, attempt, safeToRepeat, elapsedMs: Date.now() - startedAt });
    if (delay === null) {
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return sendWithRetry({ request, safeToRepeat, attempt: attempt + 1, startedAt });
}

async function sendOnce<T>({ request }: { request: RawRequest }): Promise<T> {
    const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((cause: unknown) => {
        throw new NetworkError({ cause });
    });
    const text = await response.text();
    const body = parseBody<T>({ text });
    if (!response.ok) {
        throw new WalmartHttpError({
            status: response.status,
            body,
            serverDelayMs: walmartRetry.serverRequestedDelayMs({ headers: response.headers, now: Date.now() }),
        });
    }
    return body;
}

// JSON.parse is untyped; non-JSON text is returned as a JSON string so callers still get a value.
function parseBody<T>({ text }: { text: string }): T {
    const parsed = tryCatchSync(() => JSON.parse(text));
    return parsed.error ? JSON.parse(JSON.stringify(text)) : parsed.data;
}

function retryableFailure({ error }: { error: Error }): RetryableFailure | null {
    if (error instanceof NetworkError) {
        return { kind: 'network' };
    }
    return error instanceof WalmartHttpError ? { kind: 'http', status: error.status, serverDelayMs: error.serverDelayMs } : null;
}

function isStatus({ error, status }: { error: Error; status: number }): boolean {
    return error instanceof WalmartHttpError && error.status === status;
}

// Walmart error bodies are {"error":[{code, description}]} or {"errors":{"error":[...]}};
// surface the code and description rather than the whole envelope.
function describeError({ error }: { error: Error }): string {
    if (error instanceof NetworkError) {
        return `network error: ${error.message}`;
    }
    if (!(error instanceof WalmartHttpError)) {
        return error.message;
    }
    const { status, body } = error;
    if (status === 429) {
        return 'rate limited by Walmart, try again shortly';
    }
    const details = errorEntries({ body })
        .map((entry) => [entry['code'], entry['description'] ?? entry['info']].filter((part) => typeof part === 'string').join(': '))
        .filter((text) => text.length > 0);
    if (details.length > 0) {
        return `${status} ${details.join('; ')}`;
    }
    const text = typeof body === 'string' ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : JSON.stringify(body);
    return `${status} ${text.slice(0, 300)}`;
}

function errorEntries({ body }: { body: unknown }): Record<string, unknown>[] {
    if (!isRecord(body)) {
        return [];
    }
    const direct = body['error'];
    const nested = isRecord(body['errors']) ? body['errors']['error'] : body['errors'];
    const entries = Array.isArray(direct) ? direct : Array.isArray(nested) ? nested : [];
    return entries.filter(isRecord);
}

function apiError({ method, path, error }: { method: HttpMethod; path: string; error: Error }): WalmartApiError {
    const status = error instanceof WalmartHttpError ? error.status : null;
    return new WalmartApiError({ message: `Walmart ${method} ${path.split('?')[0]} failed: ${describeError({ error })}`, status });
}

function errorStatus({ error }: { error: unknown }): number | null {
    if (error instanceof WalmartApiError) {
        return error.status;
    }
    return error instanceof WalmartHttpError ? error.status : null;
}

// Cursor paths already carry a query string; URL keeps it and appends the rest.
function withQuery({ url, queryParams }: { url: string; queryParams?: WalmartRequest['queryParams'] }): string {
    const target = new URL(url);
    Object.entries(queryParams ?? {})
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
        .forEach(([key, value]) => target.searchParams.append(key, String(value)));
    return target.toString();
}

// The secret is part of the key (as a hash, never raw) so that fixing a wrong secret on a
// connection is not masked by a token cached under the old one.
function tokenCacheKey({ auth }: { auth: WalmartAuthProps }): string {
    const secretHash = createHash('sha256').update(auth.clientSecret).digest('hex');
    return `${apiBase({ auth })}|${auth.clientId}|${secretHash}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return walmartJson.isRecord(value);
}

const PRODUCTION_BASE_URL = 'https://marketplace.walmartapis.com';
const SANDBOX_BASE_URL = 'https://sandbox.walmartapis.com';
const SERVICE_NAME = 'Walmart Marketplace';
const DEFAULT_TOKEN_LIFETIME_S = 900;
const TOKEN_RENEW_EARLY_MS = 2 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 30 * 1000;

class NetworkError extends Error {
    constructor({ cause }: { cause: unknown }) {
        super(cause instanceof Error ? cause.message : String(cause));
        this.name = 'NetworkError';
    }
}

class WalmartHttpError extends Error {
    readonly status: number;
    readonly body: unknown;
    readonly serverDelayMs: number | null;

    constructor({ status, body, serverDelayMs }: { status: number; body: unknown; serverDelayMs: number | null }) {
        super(`HTTP ${status}`);
        this.name = 'WalmartHttpError';
        this.status = status;
        this.body = body;
        this.serverDelayMs = serverDelayMs;
    }
}

export class WalmartApiError extends Error {
    readonly status: number | null;

    constructor({ message, status }: { message: string; status: number | null }) {
        super(message);
        this.name = 'WalmartApiError';
        this.status = status;
    }
}

export const WALMART_ENVIRONMENT = {
    PRODUCTION: 'production',
    SANDBOX: 'sandbox',
} as const;

export const walmartClient = {
    apiBase,
    baseHeaders,
    getToken,
    tryGetToken,
    request,
    errorStatus,
    isRecord,
};

export type WalmartAuthProps = {
    clientId: string;
    clientSecret: string;
    environment?: string;
};

type RawRequest = {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body?: string | FormData;
};

type SendParams = {
    request: RawRequest;
    safeToRepeat: boolean;
    attempt?: number;
    startedAt?: number;
};

type WalmartRequest = {
    auth: WalmartAuthProps;
    method: HttpMethod;
    path: string;
    queryParams?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
    headers?: Record<string, string>;
};
