import { createHash } from 'crypto';
import { HttpMethod } from '@activepieces/pieces-common';
import { tryCatch, tryCatchSync } from '@activepieces/shared';
import { marketplaces } from './marketplaces';
import { REQUEST_TIMEOUT_MS, RetryableFailure, spApiRetry } from './retry';

// LWA access tokens live an hour; the token endpoint is rate limited too, so a flow that
// runs several actions in one sandbox should not exchange the refresh token per request.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken({ auth }: { auth: AmazonSellerAuthProps }): Promise<string> {
    const cacheKey = tokenCacheKey({ auth });
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const response = await exchangeRefreshToken({ auth });
    const lifetimeMs = (response.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000;
    tokenCache.set(cacheKey, { token: response.access_token, expiresAt: Date.now() + lifetimeMs - TOKEN_RENEW_EARLY_MS });
    return response.access_token;
}

// The token call goes to one fixed Amazon host and its form body is the client secret and
// refresh token, so it is sent with send(), whose errors carry only the response.
async function exchangeRefreshToken({ auth }: { auth: AmazonSellerAuthProps }): Promise<LwaTokenResponse> {
    const { data, error } = await tryCatch(() => sendWithRetry<unknown>({
        request: {
            method: HttpMethod.POST,
            url: LWA_TOKEN_URL,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: auth.refreshToken.trim(),
                client_id: auth.clientId.trim(),
                client_secret: auth.clientSecret.trim(),
            }).toString(),
        },
        safeToRepeat: true,
    }));
    if (error) {
        throw new Error(`Login with Amazon token request failed: ${describeError({ error })}`);
    }
    if (isRecord(data) && typeof data['access_token'] === 'string') {
        return { access_token: data['access_token'], expires_in: typeof data['expires_in'] === 'number' ? data['expires_in'] : undefined };
    }
    throw new Error('Login with Amazon token request failed: the response had no access token.');
}

async function tryGetAccessToken({ auth }: { auth: AmazonSellerAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getAccessToken({ auth }));
    return { error: error ? error.message : null };
}

function apiBase({ auth }: { auth: AmazonSellerAuthProps }): string {
    const region = marketplaces.regionFor({ marketplaceId: auth.marketplaceId });
    const host = auth.sandbox ? `sandbox.sellingpartnerapi-${region}.amazon.com` : `sellingpartnerapi-${region}.amazon.com`;
    return `https://${host}`;
}

async function request<T>({ auth, method, path, queryParams, body }: SpApiRequest): Promise<T> {
    const send = async ({ accessToken }: { accessToken: string }) => sendWithRetry<T>({
        request: {
            method,
            url: withQuery({ url: `${apiBase({ auth })}${path}`, queryParams }),
            headers: {
                'x-amz-access-token': accessToken,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        },
        safeToRepeat: method === HttpMethod.GET,
    });

    const first = await tryCatch(async () => send({ accessToken: await getAccessToken({ auth }) }));
    if (!first.error) {
        return first.data;
    }
    if (!isUnauthorized({ error: first.error })) {
        throw new Error(`Amazon SP-API ${method} ${path} failed: ${describeError({ error: first.error })}`);
    }
    // A cached token can be revoked or expire early; one fresh exchange settles which it is.
    tokenCache.delete(tokenCacheKey({ auth }));
    const retry = await tryCatch(async () => send({ accessToken: await getAccessToken({ auth }) }));
    if (retry.error) {
        throw new Error(`Amazon SP-API ${method} ${path} failed: ${describeError({ error: retry.error })}`);
    }
    return retry.data;
}

// SP-API pages with an opaque NextToken. The callers differ only in where the token and the
// rows live, so they pass accessors instead of each re-implementing the loop.
async function fetchPages<TPage, TRow>({ fetchPage, rowsOf, nextTokenOf, maxRows }: FetchPagesParams<TPage, TRow>): Promise<TRow[]> {
    const collect = async ({ nextToken, collected }: { nextToken: string | undefined; collected: TRow[] }): Promise<TRow[]> => {
        const page = await fetchPage({ nextToken });
        const all = [...collected, ...rowsOf({ page })];
        const next = nextTokenOf({ page });
        if (!next || (maxRows !== undefined && all.length >= maxRows)) {
            return maxRows === undefined ? all : all.slice(0, maxRows);
        }
        return collect({ nextToken: next, collected: all });
    };
    return collect({ nextToken: undefined, collected: [] });
}

// fetch rather than pieces-common's httpClient: its HttpError drops the response headers
// (Retry-After, x-amzn-RateLimit-Limit) and embeds the request body in its message.
async function sendWithRetry<T>({ request, safeToRepeat, attempt = 1, startedAt = Date.now() }: SendParams): Promise<T> {
    const { data, error } = await tryCatch(() => sendOnce<T>({ request }));
    if (!error) {
        return data;
    }
    const failure = retryableFailure({ error });
    const delay = failure === null ? null : spApiRetry.delayBeforeRetry({ failure, attempt, safeToRepeat, elapsedMs: Date.now() - startedAt });
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
        throw new SpApiHttpError({
            status: response.status,
            body,
            serverDelayMs: spApiRetry.serverRequestedDelayMs({ headers: response.headers, now: Date.now() }),
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
    return error instanceof SpApiHttpError ? { kind: 'http', status: error.status, serverDelayMs: error.serverDelayMs } : null;
}

function isUnauthorized({ error }: { error: Error }): boolean {
    return error instanceof SpApiHttpError && (error.status === 401 || isExpiredTokenForbidden({ error }));
}

// A 403 is usually a missing role or wrong seller, which a new token will not fix. Only
// Amazon's Unauthorized/InvalidAccessToken errors about the token itself are worth a re-login.
function isExpiredTokenForbidden({ error }: { error: SpApiHttpError }): boolean {
    if (error.status !== 403 || !isRecord(error.body) || !Array.isArray(error.body['errors'])) {
        return false;
    }
    return error.body['errors'].filter(isRecord).some((entry) => {
        const code = typeof entry['code'] === 'string' ? entry['code'] : '';
        const text = [entry['message'], entry['details']].filter((part) => typeof part === 'string').join(' ');
        return code === 'InvalidAccessToken' || (code === 'Unauthorized' && ACCESS_TOKEN_PROBLEM.test(text));
    });
}

function describeError({ error }: { error: Error }): string {
    if (error instanceof NetworkError) {
        return `network error: ${error.message}`;
    }
    if (!(error instanceof SpApiHttpError)) {
        return error.message;
    }
    const body = error.body;
    const detail = spApiErrorText({ body }) ?? lwaErrorText({ body }) ?? JSON.stringify(body ?? '').slice(0, 500);
    return `HTTP ${error.status}: ${detail}`;
}

function spApiErrorText({ body }: { body: unknown }): string | null {
    if (!isRecord(body) || !Array.isArray(body['errors'])) {
        return null;
    }
    const messages = body['errors'].filter(isRecord).map((entry) => [entry['code'], entry['message'], entry['details']].filter(Boolean).join(' - '));
    return messages.length > 0 ? messages.join('; ') : null;
}

function lwaErrorText({ body }: { body: unknown }): string | null {
    if (!isRecord(body) || typeof body['error'] !== 'string') {
        return null;
    }
    return [body['error'], body['error_description']].filter(Boolean).join(' - ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withQuery({ url, queryParams }: { url: string; queryParams?: SpApiQuery }): string {
    const target = new URL(url);
    Object.entries(queryParams ?? {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0))
        .forEach(([key, value]) => target.searchParams.append(key, Array.isArray(value) ? value.join(',') : String(value)));
    return target.toString();
}

// Hashed so the cache never holds the raw credentials; the secret is part of it so that fixing
// a wrong secret on a connection is not masked by a token cached under the old one.
function tokenCacheKey({ auth }: { auth: AmazonSellerAuthProps }): string {
    return createHash('sha256').update(`${auth.clientId}|${auth.clientSecret}|${auth.refreshToken}`).digest('hex');
}

const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const DEFAULT_TOKEN_LIFETIME_S = 3600;
const TOKEN_RENEW_EARLY_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_PROBLEM = /access token.*(expired|revoked|invalid|malformed)/i;

class NetworkError extends Error {
    constructor({ cause }: { cause: unknown }) {
        super(cause instanceof Error ? cause.message : String(cause));
        this.name = 'NetworkError';
    }
}

class SpApiHttpError extends Error {
    readonly status: number;
    readonly body: unknown;
    readonly serverDelayMs: number | null;

    constructor({ status, body, serverDelayMs }: { status: number; body: unknown; serverDelayMs: number | null }) {
        super(`HTTP ${status}`);
        this.name = 'SpApiHttpError';
        this.status = status;
        this.body = body;
        this.serverDelayMs = serverDelayMs;
    }
}

export const spApiClient = { apiBase, getAccessToken, tryGetAccessToken, request, fetchPages, isRecord };

export type AmazonSellerAuthProps = {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    marketplaceId: string;
    sellerId?: string;
    sandbox?: boolean;
};

export type SpApiQuery = Record<string, string | number | boolean | string[] | undefined | null>;

type SpApiRequest = {
    auth: AmazonSellerAuthProps;
    method: HttpMethod;
    path: string;
    queryParams?: SpApiQuery;
    body?: unknown;
};

type FetchPagesParams<TPage, TRow> = {
    fetchPage: (params: { nextToken: string | undefined }) => Promise<TPage>;
    rowsOf: (params: { page: TPage }) => TRow[];
    nextTokenOf: (params: { page: TPage }) => string | undefined;
    maxRows?: number;
};

type RawRequest = {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body?: string;
};

type SendParams = {
    request: RawRequest;
    safeToRepeat: boolean;
    attempt?: number;
    startedAt?: number;
};

type LwaTokenResponse = {
    access_token: string;
    expires_in?: number;
};
