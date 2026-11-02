import { createHash } from 'crypto';
import { HttpError, HttpMethod, QueryParams, httpClient } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';

async function getAccessToken({ auth }: { auth: EbayAuthProps }): Promise<string> {
    // Paginated actions make many calls per run; reuse the 2-hour user token instead of minting one per request.
    const cacheKey = cacheKeyFor({ parts: [auth.environment ?? 'production', auth.appId, auth.refreshToken] });
    // Omitting `scope` makes eBay return a token carrying every scope the refresh token was granted.
    return cachedToken({ cache: userTokenCache, cacheKey, auth, form: { grant_type: 'refresh_token', refresh_token: auth.refreshToken } });
}

// Buy APIs (e.g. Browse check_compatibility) take an application token, not the seller's user token.
async function getApplicationToken({ auth }: { auth: EbayAuthProps }): Promise<string> {
    const cacheKey = cacheKeyFor({ parts: [auth.environment ?? 'production', auth.appId, auth.certId] });
    return cachedToken({ cache: applicationTokenCache, cacheKey, auth, form: { grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' } });
}

async function cachedToken({ cache, cacheKey, auth, form }: { cache: Map<string, CachedToken>; cacheKey: string; auth: EbayAuthProps; form: Record<string, string> }): Promise<string> {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const body = await fetchToken({ auth, form });
    const lifetimeMs = (body.expires_in ?? DEFAULT_TOKEN_LIFETIME_SECONDS) * 1000;
    cache.set(cacheKey, { token: body.access_token, expiresAt: Date.now() + Math.max(MIN_TOKEN_TTL_MS, lifetimeMs - TOKEN_EXPIRY_MARGIN_MS) });
    return body.access_token;
}

// The framework's HttpError serialises the request body into its message, and this body
// is the refresh token. Only the status and eBay's reply may leave this function. Minting
// a token changes nothing on eBay's side, so a 5xx is retried like a read.
async function fetchToken({ auth, form }: { auth: EbayAuthProps; form: Record<string, string> }): Promise<{ access_token: string; expires_in?: number }> {
    const { data, error } = await withRetry({ attempts: MAX_READ_ATTEMPTS, fn: () => httpClient.sendRequest<{ access_token: string; expires_in?: number }>({
        method: HttpMethod.POST,
        url: `${hosts({ auth }).api}/identity/v1/oauth2/token`,
        headers: {
            Authorization: `Basic ${basicCredentials({ auth })}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(form).toString(),
    }) });
    if (error) {
        throw new Error(`eBay token request failed: ${safeErrorMessage({ error, auth })}`);
    }
    return data.body;
}

function cacheKeyFor({ parts }: { parts: string[] }): string {
    return createHash('sha256').update(parts.join('|')).digest('hex');
}

async function tryGetAccessToken({ auth }: { auth: EbayAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getAccessToken({ auth }));
    return { error: error ? safeErrorMessage({ error, auth }) : null };
}

async function request<T>(params: EbayRequest): Promise<T> {
    const response = await requestWithHeaders<T>(params);
    return response.body;
}

// For calls whose result is only in a header, e.g. createShippingFulfillment's Location.
async function requestWithHeaders<T>({ auth, method, path, queryParams, body, host = 'api', tokenType = 'user', authScheme = 'Bearer' }: EbayRequest): Promise<{ body: T; headers: Record<string, unknown> }> {
    const accessToken = tokenType === 'application' ? await getApplicationToken({ auth }) : await getAccessToken({ auth });
    // Only reads are retried: replaying a POST could double-send a message or double-apply a change.
    const attempts = method === HttpMethod.GET ? MAX_READ_ATTEMPTS : 1;
    const { data, error } = await withRetry({ attempts, fn: () => httpClient.sendRequest<T>({
        method,
        url: `${hosts({ auth })[host]}${path}`,
        headers: {
            Authorization: `${authScheme} ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        queryParams: compactQuery({ queryParams }),
        body,
    }) });
    if (error) {
        throw new Error(`eBay ${method} ${path} failed: ${safeErrorMessage({ error, auth })}`);
    }
    return { body: data.body, headers: { ...(data.headers ?? {}) } };
}

// Some seller data (e.g. a Trading-created listing's fitment chart) has no REST equivalent, so call the Trading XML API with the OAuth user token.
async function tradingCall({ auth, callName, innerXml, readOnly = false }: { auth: EbayAuthProps; callName: string; innerXml: string; readOnly?: boolean }): Promise<string> {
    const accessToken = await getAccessToken({ auth });
    const { data, error } = await withRetry({ attempts: readOnly ? MAX_READ_ATTEMPTS : 1, fn: () => httpClient.sendRequest<string>({
        method: HttpMethod.POST,
        url: `${hosts({ auth }).api}/ws/api.dll`,
        headers: {
            'X-EBAY-API-SITEID': '0',
            'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_COMPATIBILITY_LEVEL,
            'X-EBAY-API-CALL-NAME': callName,
            'X-EBAY-API-IAF-TOKEN': accessToken,
            'Content-Type': 'text/xml',
        },
        body: `<?xml version="1.0" encoding="utf-8"?><${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">${innerXml}</${callName}Request>`,
        responseType: 'text',
    }) });
    if (error) {
        throw new Error(`eBay Trading ${callName} failed: ${safeErrorMessage({ error, auth })}`);
    }
    return String(data.body);
}

async function getUsername({ auth }: { auth: EbayAuthProps }): Promise<string> {
    const user = await request<{ username: string }>({
        auth,
        method: HttpMethod.GET,
        path: '/commerce/identity/v1/user/',
        host: 'apiz',
    });
    return user.username;
}

async function withRetry<T>({ attempts, fn }: { attempts: number; fn: () => Promise<T> }): Promise<{ data: T; error: null } | { data: null; error: Error }> {
    const result = await tryCatch(fn);
    if (!result.error || attempts <= 1 || !isRetryable({ error: result.error })) {
        return result;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (MAX_READ_ATTEMPTS - attempts + 1)));
    return withRetry({ attempts: attempts - 1, fn });
}

function isRetryable({ error }: { error: Error }): boolean {
    if (!(error instanceof HttpError)) {
        return true;
    }
    return RETRYABLE_STATUSES.includes(error.response.status);
}

function basicCredentials({ auth }: { auth: EbayAuthProps }): string {
    return Buffer.from(`${auth.appId}:${auth.certId}`).toString('base64');
}

function hosts({ auth }: { auth: EbayAuthProps }): Record<EbayHost, string> {
    return auth.environment === 'sandbox'
        ? { api: 'https://api.sandbox.ebay.com', apiz: 'https://apiz.sandbox.ebay.com' }
        : { api: 'https://api.ebay.com', apiz: 'https://apiz.ebay.com' };
}

function compactQuery({ queryParams }: { queryParams?: Record<string, string | number | undefined | null> }): QueryParams {
    return Object.fromEntries(
        Object.entries(queryParams ?? {})
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)]),
    );
}

// Never reads HttpError.message: the framework puts the request body (the refresh token on
// a token call, a message body or listing XML otherwise) in it.
function describeError({ error }: { error: Error }): string {
    if (!(error instanceof HttpError)) {
        return error.message;
    }
    const { status, body } = error.response;
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? null);
    return `${status} ${text.length > MAX_ERROR_BODY_CHARS ? `${text.slice(0, MAX_ERROR_BODY_CHARS)}…` : text}`;
}

// Every message that can reach a step error goes through here, so a reply that echoes a
// credential back is masked as well.
function safeErrorMessage({ error, auth }: { error: unknown; auth?: EbayAuthProps }): string {
    const message = error instanceof Error ? describeError({ error }) : String(error);
    const secrets = [auth?.refreshToken, auth?.certId].filter((secret): secret is string => typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH);
    return secrets.reduce((text, secret) => text.split(secret).join('[redacted]'), message);
}

const TRADING_COMPATIBILITY_LEVEL = '1331';
const DEFAULT_TOKEN_LIFETIME_SECONDS = 7200;
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const MAX_READ_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const MIN_TOKEN_TTL_MS = 60 * 1000;
const MAX_ERROR_BODY_CHARS = 600;
const MIN_SECRET_LENGTH = 3;
const userTokenCache = new Map<string, CachedToken>();
const applicationTokenCache = new Map<string, CachedToken>();

export const ebayClient = {
    getAccessToken,
    getApplicationToken,
    tryGetAccessToken,
    request,
    requestWithHeaders,
    tradingCall,
    getUsername,
    safeErrorMessage,
    baseUrl: ({ auth }: { auth: EbayAuthProps }) => hosts({ auth }).api,
};

export type EbayAuthProps = {
    appId: string;
    certId: string;
    refreshToken: string;
    environment?: string;
};

type EbayHost = 'api' | 'apiz';

type CachedToken = { token: string; expiresAt: number };

type EbayRequest = {
    auth: EbayAuthProps;
    method: HttpMethod;
    path: string;
    queryParams?: Record<string, string | number | undefined | null>;
    body?: unknown;
    host?: EbayHost;
    tokenType?: 'user' | 'application';
    // The Post-Order API (cancellations, returns) takes the OAuth user token as `IAF <token>`.
    authScheme?: 'Bearer' | 'IAF';
};
