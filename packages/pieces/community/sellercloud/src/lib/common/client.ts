import { createHash } from 'crypto';
import { HttpError, HttpMethod, QueryParams, httpClient } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';

// Tokens last an hour and /token is itself rate limited, so a flow that runs many
// actions must not log in once per request.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// `store` is the flow's key-value store. The engine forks a process per sandbox, so the
// module cache dies with the run; passing the store keeps one login alive across runs.
async function getToken({ auth, store }: { auth: SellercloudAuthProps; store?: TokenStore }): Promise<string> {
    const cacheKey = connectionKey({ auth });
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const stored = store ? await readStoredToken({ store, cacheKey }) : null;
    if (stored && stored.expiresAt > Date.now()) {
        tokenCache.set(cacheKey, stored);
        return stored.token;
    }
    const response = await fetchToken({ auth });
    const entry = { token: response.access_token, expiresAt: expiryFrom({ response }), connection: cacheKey };
    tokenCache.set(cacheKey, entry);
    if (store) {
        await store.put(tokenStoreKey({ cacheKey }), entry);
    }
    return entry.token;
}

// The framework's HttpError serialises the request body into its message, and the login
// body is the password. Only the status and SellerCloud's own reply may leave this function.
async function fetchToken({ auth }: { auth: SellercloudAuthProps }): Promise<CreateTokenResponse> {
    const { data, error } = await tryCatch(() => sendWithRetry<CreateTokenResponse>({
        request: {
            method: HttpMethod.POST,
            url: `${apiBase({ auth })}/token`,
            headers: { 'Content-Type': 'application/json' },
            body: { Username: auth.username, Password: auth.password },
        },
    }));
    if (error) {
        throw new Error(`SellerCloud login failed: ${safeErrorMessage({ error, auth })}`);
    }
    return data;
}

// A flow can hold steps on different SellerCloud connections, and the store is shared by
// every step of the flow, so each connection gets its own key. Hashed so the username is
// not written into the key.
function connectionKey({ auth }: { auth: SellercloudAuthProps }): string {
    return createHash('sha256').update(`${apiBase({ auth })}|${auth.username.trim().toLowerCase()}`).digest('hex').slice(0, 24);
}

function tokenStoreKey({ cacheKey }: { cacheKey: string }): string {
    return `${TOKEN_STORE_KEY_PREFIX}${cacheKey}`;
}

// SellerCloud reports expires_in (seconds). This is an optimisation only — a stale token
// is recovered by the 401 retry in request(), so the arithmetic need not be exact.
function expiryFrom({ response }: { response: CreateTokenResponse }): number {
    const lifetimeMs = (response.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000;
    return Date.now() + Math.max(MIN_TOKEN_TTL_MS, lifetimeMs - TOKEN_RENEW_EARLY_MS);
}

async function readStoredToken({ store, cacheKey }: { store: TokenStore; cacheKey: string }): Promise<{ token: string; expiresAt: number } | null> {
    const { data } = await tryCatch(() => store.get<StoredToken>(tokenStoreKey({ cacheKey })));
    if (!data || typeof data.token !== 'string' || typeof data.expiresAt !== 'number' || data.connection !== cacheKey) {
        return null;
    }
    return { token: data.token, expiresAt: data.expiresAt };
}

// SellerCloud answers 409 {"Error":"Too many requests.","RateLimitResetTime":"..."} when
// throttling, so the reset time in the body is what to wait for, not a fixed backoff.
async function sendWithRetry<T>({ request, attempt = 1 }: { request: Parameters<typeof httpClient.sendRequest>[0]; attempt?: number }): Promise<T> {
    const { data, error } = await tryCatch(() => httpClient.sendRequest<T>(request));
    if (!error) {
        return data.body;
    }
    const delay = retryDelayMs({ error, attempt, safeToRepeat: isSafeToRepeat({ request }) });
    if (delay === null) {
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return sendWithRetry({ request, attempt: attempt + 1 });
}

// A 502/503/504 says the gateway gave up, not that the server did nothing: the request may
// well have been processed. Repeating a read or fetching a token is harmless; repeating an
// inventory adjustment applies the same delta twice. That is how a run's zero-writes left 41
// SKUs at minus their original stock. A write is only retried on SellerCloud's rate-limit
// reply, which it sends before doing any work; any other 409 is a real conflict.
function isSafeToRepeat({ request }: { request: Parameters<typeof httpClient.sendRequest>[0] }): boolean {
    return request.method === HttpMethod.GET || /\/token\/?$/.test(request.url);
}

function retryDelayMs({ error, attempt, safeToRepeat }: { error: Error; attempt: number; safeToRepeat: boolean }): number | null {
    if (attempt >= MAX_ATTEMPTS || !(error instanceof HttpError)) {
        return null;
    }
    const { status, body } = error.response;
    if (isRateLimited({ status, body })) {
        const wait = rateLimitWaitMs({ body });
        return wait <= MAX_RATE_LIMIT_WAIT_MS ? wait : null;
    }
    if (safeToRepeat && (TRANSIENT_STATUSES.includes(status) || status === CONFLICT_STATUS)) {
        return BASE_BACKOFF_MS * 2 ** (attempt - 1);
    }
    return null;
}

function isRateLimited({ status, body }: { status: number; body: unknown }): boolean {
    if (status === 429) {
        return true;
    }
    if (status !== CONFLICT_STATUS) {
        return false;
    }
    const errorText = recordField({ value: body, field: 'Error' });
    return recordField({ value: body, field: 'RateLimitResetTime' }) !== null || (errorText !== null && /too many requests/i.test(errorText));
}

function rateLimitWaitMs({ body }: { body: unknown }): number {
    const resetTime = recordField({ value: body, field: 'RateLimitResetTime' });
    const resetAt = resetTime === null ? Number.NaN : Date.parse(resetTime);
    if (Number.isNaN(resetAt)) {
        return BASE_BACKOFF_MS;
    }
    return Math.max(BASE_BACKOFF_MS, resetAt - Date.now() + RATE_LIMIT_PADDING_MS);
}

function recordField({ value, field }: { value: unknown; field: string }): string | null {
    if (typeof value !== 'object' || value === null || !(field in value)) {
        return null;
    }
    const found: unknown = Object.entries(value).find(([key]) => key === field)?.[1];
    return typeof found === 'string' && found !== '' ? found : null;
}

async function tryGetToken({ auth }: { auth: SellercloudAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getToken({ auth }));
    return { error: error ? safeErrorMessage({ error, auth }) : null };
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
        throw new Error(`SellerCloud ${method} ${path} failed: ${safeErrorMessage({ error: first.error, auth })}`);
    }
    await invalidateToken({ auth, store });
    const freshToken = await getToken({ auth, store });
    const retry = await tryCatch(() => send({ accessToken: freshToken }));
    if (retry.error) {
        throw new Error(`SellerCloud ${method} ${path} failed: ${safeErrorMessage({ error: retry.error, auth })}`);
    }
    return retry.data;
}

function isUnauthorized({ error }: { error: Error }): boolean {
    return error instanceof HttpError && error.response.status === 401;
}

async function invalidateToken({ auth, store }: { auth: SellercloudAuthProps; store?: TokenStore }): Promise<void> {
    const cacheKey = connectionKey({ auth });
    tokenCache.delete(cacheKey);
    if (store) {
        await tryCatch(() => store.put(tokenStoreKey({ cacheKey }), null));
    }
}

async function listWarehouses({ auth, token }: { auth: SellercloudAuthProps; token?: string }): Promise<SellercloudWarehouse[]> {
    return fetchAllPages<SellercloudWarehouse>({ auth, token, path: '/Warehouses' });
}

// /Catalog pages 50 at a time, so one match pass is ~50 requests against a rate-limited
// API. Six PDC flows rebuilding the same list would spend most of the budget on it.
const catalogCache = new Map<string, { ids: string[]; expiresAt: number }>();

// The engine forks a process per sandbox, so the module cache above dies with the run and
// every flow run re-paid the ~53 pages. Keep it in the flow store too.
async function listCatalogProductIds({ auth, token, store }: { auth: SellercloudAuthProps; token?: string; store?: TokenStore }): Promise<string[]> {
    const cacheKey = connectionKey({ auth });
    const cached = catalogCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.ids;
    }
    const stored = store ? await readStoredCatalog({ store, cacheKey }) : null;
    if (stored && stored.expiresAt > Date.now()) {
        catalogCache.set(cacheKey, stored);
        return stored.ids;
    }
    const products = await fetchAllPages<{ ID: string }>({ auth, token, path: '/Catalog' });
    const ids = products.map((product) => product.ID);
    const entry = { ids, expiresAt: Date.now() + CATALOG_TTL_MS, connection: cacheKey };
    catalogCache.set(cacheKey, entry);
    if (store) {
        await store.put(`${CATALOG_STORE_KEY_PREFIX}${cacheKey}`, entry);
    }
    return ids;
}

async function readStoredCatalog({ store, cacheKey }: { store: TokenStore; cacheKey: string }): Promise<{ ids: string[]; expiresAt: number } | null> {
    const { data } = await tryCatch(() => store.get<StoredCatalog>(`${CATALOG_STORE_KEY_PREFIX}${cacheKey}`));
    if (!data || !Array.isArray(data.ids) || typeof data.expiresAt !== 'number' || data.connection !== cacheKey) {
        return null;
    }
    return { ids: data.ids, expiresAt: data.expiresAt };
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

// Never reads HttpError.message: the framework puts the request body (credentials, PINs) in
// it. The status and SellerCloud's reply are enough to act on.
function describeError({ error }: { error: Error }): string {
    if (!(error instanceof HttpError)) {
        return error.message;
    }
    const { status, body } = error.response;
    if (isRateLimited({ status, body })) {
        const resetTime = recordField({ value: body, field: 'RateLimitResetTime' });
        return `rate limited by SellerCloud${resetTime ? `, resets at ${resetTime}` : ''}`;
    }
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? null);
    return `${status} ${text.length > MAX_ERROR_BODY_CHARS ? `${text.slice(0, MAX_ERROR_BODY_CHARS)}…` : text}`;
}

// Every message that can reach a step error or a dropdown goes through here, so a reply
// that echoes a credential back is masked as well.
function safeErrorMessage({ error, auth }: { error: unknown; auth?: SellercloudAuthProps }): string {
    const message = error instanceof Error ? describeError({ error }) : String(error);
    const secrets = [auth?.password, auth?.pinCode].filter((secret): secret is string => typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH);
    return secrets.reduce((text, secret) => text.split(secret).join('[redacted]'), message);
}

const MAX_PAGE_SIZE = 500;
const TOKEN_STORE_KEY_PREFIX = 'sellercloud_token_';
const DEFAULT_TOKEN_LIFETIME_S = 3600;
const TOKEN_RENEW_EARLY_MS = 5 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 60 * 1000;
// One PDC day runs five workers over several hours, so the list has to outlive a single
// morning's ticks to be worth caching at all.
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const CATALOG_STORE_KEY_PREFIX = 'sellercloud_catalog_ids_';
const CONFLICT_STATUS = 409;
const MAX_ERROR_BODY_CHARS = 600;
const MIN_SECRET_LENGTH = 3;
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
    safeErrorMessage,
    isRateLimited,
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

type StoredToken = { token?: unknown; expiresAt?: unknown; connection?: unknown };

type StoredCatalog = { ids?: string[]; expiresAt?: unknown; connection?: unknown };

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
