import { randomUUID } from 'node:crypto';
import { HttpError, HttpMethod, HttpRequest, httpClient } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';

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
    const response = await sendWithRetry<TokenResponse>({
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
    const lifetimeMs = (response.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000;
    const entry = {
        token: response.access_token,
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
            url: `${apiBase({ auth })}${path}`,
            headers: {
                ...baseHeaders(),
                'WM_SEC.ACCESS_TOKEN': accessToken,
                ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
                ...headers,
            },
            queryParams: compactQuery({ queryParams }),
            body,
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

// Walmart rejects a throttled call (429) before doing any work, so that is safe to repeat
// for every method. A 5xx may come after the write was applied, so only reads and token
// fetches are repeated on those: repeating an inventory PUT or a ship call is not harmless.
async function sendWithRetry<T>({ request, safeToRepeat, attempt = 1 }: { request: HttpRequest; safeToRepeat: boolean; attempt?: number }): Promise<T> {
    const { data, error } = await tryCatch(() => httpClient.sendRequest<T>(request));
    if (!error) {
        return data.body;
    }
    const delay = retryDelayMs({ error, attempt, safeToRepeat });
    if (delay === null) {
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return sendWithRetry({ request, safeToRepeat, attempt: attempt + 1 });
}

function retryDelayMs({ error, attempt, safeToRepeat }: { error: Error; attempt: number; safeToRepeat: boolean }): number | null {
    if (attempt >= MAX_ATTEMPTS || !(error instanceof HttpError)) {
        return null;
    }
    const status = error.response.status;
    const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
    // HttpError drops response headers, so Retry-After is not visible here; back off
    // exponentially instead (1.5s, 3s, 6s, 12s).
    if (status === 429) {
        return backoff;
    }
    if (safeToRepeat && status >= 500) {
        return backoff;
    }
    return null;
}

function isStatus({ error, status }: { error: Error; status: number }): boolean {
    return error instanceof HttpError && error.response.status === status;
}

// Walmart error bodies are {"error":[{code, description}]} or {"errors":{"error":[...]}};
// surface the code and description rather than the whole envelope.
function describeError({ error }: { error: Error }): string {
    if (!(error instanceof HttpError)) {
        return error.message;
    }
    const { status, body } = error.response;
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
    const status = error instanceof HttpError ? error.response.status : null;
    return new WalmartApiError({ message: `Walmart ${method} ${path.split('?')[0]} failed: ${describeError({ error })}`, status });
}

function errorStatus({ error }: { error: unknown }): number | null {
    if (error instanceof WalmartApiError) {
        return error.status;
    }
    return error instanceof HttpError ? error.response.status : null;
}

function compactQuery({ queryParams }: { queryParams?: WalmartRequest['queryParams'] }): Record<string, string> {
    return Object.fromEntries(
        Object.entries(queryParams ?? {})
            .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
            .map(([key, value]) => [key, String(value)]),
    );
}

function tokenCacheKey({ auth }: { auth: WalmartAuthProps }): string {
    return `${apiBase({ auth })}|${auth.clientId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const PRODUCTION_BASE_URL = 'https://marketplace.walmartapis.com';
const SANDBOX_BASE_URL = 'https://sandbox.walmartapis.com';
const SERVICE_NAME = 'Walmart Marketplace';
const DEFAULT_TOKEN_LIFETIME_S = 900;
const TOKEN_RENEW_EARLY_MS = 2 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1500;

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

type TokenResponse = {
    access_token: string;
    token_type?: string;
    expires_in?: number;
};

type WalmartRequest = {
    auth: WalmartAuthProps;
    method: HttpMethod;
    path: string;
    queryParams?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
    headers?: Record<string, string>;
};
