import { HttpError, HttpMethod, QueryParams, httpClient } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';

// Tokens last an hour and /token is itself rate limited, so a flow that runs many
// actions must not log in once per request.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// `store` is the flow's key-value store. The engine forks a process per sandbox, so the
// module cache dies with the run; passing the store keeps one login alive across runs.
async function getToken({ auth, store }: { auth: SellercloudAuthProps; store?: TokenStore }): Promise<string> {
    const cacheKey = `${apiBase({ auth })}|${auth.username}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const stored = store ? await readStoredToken({ store }) : null;
    if (stored && stored.expiresAt > Date.now()) {
        tokenCache.set(cacheKey, stored);
        return stored.token;
    }
    const response = await sendWithRetry<CreateTokenResponse>({
        request: {
            method: HttpMethod.POST,
            url: `${apiBase({ auth })}/token`,
            headers: { 'Content-Type': 'application/json' },
            body: { Username: auth.username, Password: auth.password },
        },
    });
    const entry = { token: response.access_token, expiresAt: expiryFrom({ response }) };
    tokenCache.set(cacheKey, entry);
    if (store) {
        await store.put(TOKEN_STORE_KEY, entry);
    }
    return entry.token;
}

// SellerCloud reports expires_in (seconds). This is an optimisation only — a stale token
// is recovered by the 401 retry in request(), so the arithmetic need not be exact.
function expiryFrom({ response }: { response: CreateTokenResponse }): number {
    const lifetimeMs = (response.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000;
    return Date.now() + Math.max(MIN_TOKEN_TTL_MS, lifetimeMs - TOKEN_RENEW_EARLY_MS);
}

async function readStoredToken({ store }: { store: TokenStore }): Promise<{ token: string; expiresAt: number } | null> {
    const { data } = await tryCatch(() => store.get<{ token: string; expiresAt: number }>(TOKEN_STORE_KEY));
    return data && typeof data.token === 'string' && typeof data.expiresAt === 'number' ? data : null;
}

// SellerCloud answers 409 {"Error":"Too many requests.","RateLimitResetTime":"..."} when
// throttling, so the reset time in the body is what to wait for, not a fixed backoff.
async function sendWithRetry<T>({ request, attempt = 1 }: { request: Parameters<typeof httpClient.sendRequest>[0]; attempt?: number }): Promise<T> {
    const { data, error } = await tryCatch(() => httpClient.sendRequest<T>(request));
    if (!error) {
        return data.body;
    }
    const delay = retryDelayMs({ error, attempt });
    if (delay === null) {
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return sendWithRetry({ request, attempt: attempt + 1 });
}

function retryDelayMs({ error, attempt }: { error: Error; attempt: number }): number | null {
    if (attempt >= MAX_ATTEMPTS || !(error instanceof HttpError)) {
        return null;
    }
    const status = error.response.status;
    if (status === RATE_LIMITED_STATUS || status === 429) {
        const wait = rateLimitWaitMs({ body: error.response.body });
        return wait !== null && wait <= MAX_RATE_LIMIT_WAIT_MS ? wait : null;
    }
    if (TRANSIENT_STATUSES.includes(status)) {
        return BASE_BACKOFF_MS * 2 ** (attempt - 1);
    }
    return null;
}

function rateLimitWaitMs({ body }: { body: unknown }): number | null {
    const resetTime = (body as { RateLimitResetTime?: string } | null)?.RateLimitResetTime;
    if (!resetTime) {
        return BASE_BACKOFF_MS;
    }
    const resetAt = Date.parse(resetTime);
    if (Number.isNaN(resetAt)) {
        return BASE_BACKOFF_MS;
    }
    return Math.max(BASE_BACKOFF_MS, resetAt - Date.now() + RATE_LIMIT_PADDING_MS);
}

async function tryGetToken({ auth }: { auth: SellercloudAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getToken({ auth }));
    return { error: error ? describeError({ error }) : null };
}

// Callers that make many requests (catalog paging, job polling) pass `token` so one run
// logs in once. Expiry is handled by retrying a 401 with a fresh token rather than by
// trusting the clock, so a cached token going stale mid-run is self-healing.
async function request<T>({ auth, token, store, method, path, queryParams, body }: SellercloudRequest): Promise<T> {
    const send = async ({ accessToken }: { accessToken: string }) => sendWithRetry<T>({
        request: {
            method,
            url: `${apiBase({ auth })}${path}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            queryParams: compactQuery({ queryParams }),
            body,
        },
    });

    const accessToken = token ?? await getToken({ auth, store });
    const first = await tryCatch(() => send({ accessToken }));
    if (!first.error) {
        return first.data;
    }
    if (!isUnauthorized({ error: first.error })) {
        throw new Error(`SellerCloud ${method} ${path} failed: ${describeError({ error: first.error })}`);
    }
    await invalidateToken({ auth, store });
    const freshToken = await getToken({ auth, store });
    const retry = await tryCatch(() => send({ accessToken: freshToken }));
    if (retry.error) {
        throw new Error(`SellerCloud ${method} ${path} failed: ${describeError({ error: retry.error })}`);
    }
    return retry.data;
}

function isUnauthorized({ error }: { error: Error }): boolean {
    return error instanceof HttpError && error.response.status === 401;
}

async function invalidateToken({ auth, store }: { auth: SellercloudAuthProps; store?: TokenStore }): Promise<void> {
    tokenCache.delete(`${apiBase({ auth })}|${auth.username}`);
    if (store) {
        await tryCatch(() => store.put(TOKEN_STORE_KEY, null));
    }
}

async function listWarehouses({ auth, token }: { auth: SellercloudAuthProps; token?: string }): Promise<SellercloudWarehouse[]> {
    return fetchAllPages<SellercloudWarehouse>({ auth, token, path: '/Warehouses' });
}

// /Catalog pages 50 at a time, so one match pass is ~50 requests against a rate-limited
// API. Six PDC flows rebuilding the same list would spend most of the budget on it.
const catalogCache = new Map<string, { ids: string[]; expiresAt: number }>();

async function listCatalogProductIds({ auth, token }: { auth: SellercloudAuthProps; token?: string }): Promise<string[]> {
    const cacheKey = apiBase({ auth });
    const cached = catalogCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.ids;
    }
    const products = await fetchAllPages<{ ID: string }>({ auth, token, path: '/Catalog' });
    const ids = products.map((product) => product.ID);
    catalogCache.set(cacheKey, { ids, expiresAt: Date.now() + CATALOG_TTL_MS });
    return ids;
}

// SellerCloud silently caps pageSize (50 on /Catalog), so stop on the running total, not on pageNumber * pageSize.
async function fetchAllPages<T>({ auth, token, path, pageNumber = 1, collected = [] }: FetchPagesParams<T>): Promise<T[]> {
    const page = await request<PagedResponse<T>>({
        auth,
        token,
        method: HttpMethod.GET,
        path,
        queryParams: { 'model.pageSize': MAX_PAGE_SIZE, 'model.pageNumber': pageNumber },
    });
    const all = [...collected, ...(page.Items ?? [])];
    if ((page.Items ?? []).length === 0 || all.length >= page.TotalResults) {
        return all;
    }
    return fetchAllPages({ auth, token, path, pageNumber: pageNumber + 1, collected: all });
}

function apiBase({ auth }: { auth: SellercloudAuthProps }): string {
    return `${auth.serverUrl.trim().replace(/\/+$/, '')}/api`;
}

function compactQuery({ queryParams }: { queryParams?: Record<string, string | number | boolean | undefined | null> }): QueryParams {
    return Object.fromEntries(
        Object.entries(queryParams ?? {})
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)]),
    );
}

function describeError({ error }: { error: Error }): string {
    if (!(error instanceof HttpError)) {
        return error.message;
    }
    const { status, body } = error.response;
    if (status === RATE_LIMITED_STATUS) {
        const resetTime = (body as { RateLimitResetTime?: string } | null)?.RateLimitResetTime;
        return `rate limited by SellerCloud${resetTime ? `, resets at ${resetTime}` : ''}`;
    }
    return `${status} ${JSON.stringify(body)}`;
}

const MAX_PAGE_SIZE = 500;
const TOKEN_STORE_KEY = 'sellercloud_token';
const DEFAULT_TOKEN_LIFETIME_S = 3600;
const TOKEN_RENEW_EARLY_MS = 5 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 60 * 1000;
const CATALOG_TTL_MS = 15 * 60 * 1000;
const RATE_LIMITED_STATUS = 409;
const TRANSIENT_STATUSES = [502, 503, 504];
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 2000;
const RATE_LIMIT_PADDING_MS = 1000;
// A flow step has a budget, so a long lockout should fail with the reset time rather than hang.
const MAX_RATE_LIMIT_WAIT_MS = 120 * 1000;

export const sellercloudClient = {
    getToken,
    invalidateToken,
    tryGetToken,
    request,
    listWarehouses,
    listCatalogProductIds,
    apiBase,
};

export type SellercloudAuthProps = {
    serverUrl: string;
    username: string;
    password: string;
    pinCode?: string;
};

export type SellercloudWarehouse = {
    ID: number;
    Name: string;
    IsDefault?: boolean;
    WarehouseType?: number;
    IsSellAble?: boolean;
};

type PagedResponse<T> = {
    Items: T[] | null;
    TotalResults: number;
};

type FetchPagesParams<T> = {
    auth: SellercloudAuthProps;
    token?: string;
    path: string;
    pageNumber?: number;
    collected?: T[];
};

export type TokenStore = {
    get: <T>(key: string) => Promise<T | null>;
    put: (key: string, value: unknown) => Promise<unknown>;
};

type CreateTokenResponse = {
    access_token: string;
    expires_in?: number;
};

type SellercloudRequest = {
    auth: SellercloudAuthProps;
    token?: string;
    store?: TokenStore;
    method: HttpMethod;
    path: string;
    queryParams?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
};
