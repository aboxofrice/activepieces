import { createHash } from 'crypto';
import { HttpError, HttpMethod, HttpRequest, QueryParams, httpClient } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';
import { marketplaces } from './marketplaces';

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

// pieces-common's HttpError embeds the request body in its message and logs it, which for this
// call is the client secret and refresh token. The token call goes to one fixed Amazon host, so it
// uses fetch and builds its own error from the response alone.
async function exchangeRefreshToken({ auth, attempt = 1 }: { auth: AmazonSellerAuthProps; attempt?: number }): Promise<LwaTokenResponse> {
    const response = await fetch(LWA_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: auth.refreshToken.trim(),
            client_id: auth.clientId.trim(),
            client_secret: auth.clientSecret.trim(),
        }).toString(),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && spApiClient.isRecord(body) && typeof body['access_token'] === 'string') {
        return { access_token: body['access_token'], expires_in: typeof body['expires_in'] === 'number' ? body['expires_in'] : undefined };
    }
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1))));
        return exchangeRefreshToken({ auth, attempt: attempt + 1 });
    }
    throw new Error(`Login with Amazon token request failed: HTTP ${response.status}: ${lwaErrorText({ body }) ?? 'no error details'}`);
}

async function tryGetAccessToken({ auth }: { auth: AmazonSellerAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getAccessToken({ auth }));
    return { error: error ? describeError({ error }) : null };
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
            url: `${apiBase({ auth })}${path}`,
            headers: {
                'x-amz-access-token': accessToken,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            queryParams: compactQuery({ queryParams }),
            body,
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

// SP-API answers a throttled call with 429 before doing any work, so a 429 is safe to retry
// even for a write. A 5xx may mean the write landed, so only reads and token calls repeat it.
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
    const retryable = status === 429 || (safeToRepeat && TRANSIENT_STATUSES.includes(status));
    if (!retryable) {
        return null;
    }
    // getOrders restores one request a minute once its burst is spent, so the backoff has
    // to reach a minute or every retry lands inside the same empty bucket.
    const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
    return backoff + Math.floor(Math.random() * JITTER_MS);
}

function isUnauthorized({ error }: { error: Error }): boolean {
    return error instanceof HttpError && (error.response.status === 401 || isExpiredTokenForbidden({ error }));
}

function isExpiredTokenForbidden({ error }: { error: HttpError }): boolean {
    return error.response.status === 403 && JSON.stringify(error.response.body ?? '').includes('expired');
}

function describeError({ error }: { error: Error }): string {
    if (!(error instanceof HttpError)) {
        return error.message;
    }
    const body = error.response.body;
    const detail = spApiErrorText({ body }) ?? lwaErrorText({ body }) ?? JSON.stringify(body ?? '');
    return `HTTP ${error.response.status}: ${detail}`;
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

function compactQuery({ queryParams }: { queryParams?: SpApiQuery }): QueryParams {
    return Object.fromEntries(
        Object.entries(queryParams ?? {})
            .filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0))
            .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)]),
    );
}

function tokenCacheKey({ auth }: { auth: AmazonSellerAuthProps }): string {
    return createHash('sha256').update(`${auth.clientId}|${auth.refreshToken}`).digest('hex');
}

const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const DEFAULT_TOKEN_LIFETIME_S = 3600;
const TOKEN_RENEW_EARLY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;
const JITTER_MS = 1000;
const TRANSIENT_STATUSES = [500, 502, 503, 504];

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

type LwaTokenResponse = {
    access_token: string;
    expires_in?: number;
};
