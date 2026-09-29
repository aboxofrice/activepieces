import { HttpError, HttpMethod, QueryParams, httpClient } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';

async function getAccessToken({ auth }: { auth: EbayAuthProps }): Promise<string> {
    // Omitting `scope` makes eBay return a token carrying every scope the refresh token was granted.
    const response = await httpClient.sendRequest<{ access_token: string }>({
        method: HttpMethod.POST,
        url: `${hosts({ auth }).api}/identity/v1/oauth2/token`,
        headers: {
            Authorization: `Basic ${basicCredentials({ auth })}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: auth.refreshToken,
        }).toString(),
    });
    return response.body.access_token;
}

// Buy APIs (e.g. Browse check_compatibility) take an application token, not the seller's user token.
async function getApplicationToken({ auth }: { auth: EbayAuthProps }): Promise<string> {
    const response = await httpClient.sendRequest<{ access_token: string }>({
        method: HttpMethod.POST,
        url: `${hosts({ auth }).api}/identity/v1/oauth2/token`,
        headers: {
            Authorization: `Basic ${basicCredentials({ auth })}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'https://api.ebay.com/oauth/api_scope',
        }).toString(),
    });
    return response.body.access_token;
}

async function tryGetAccessToken({ auth }: { auth: EbayAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getAccessToken({ auth }));
    return { error: error ? describeError({ error }) : null };
}

async function request<T>({ auth, method, path, queryParams, body, host = 'api', tokenType = 'user' }: EbayRequest): Promise<T> {
    const accessToken = tokenType === 'application' ? await getApplicationToken({ auth }) : await getAccessToken({ auth });
    const { data, error } = await tryCatch(() => httpClient.sendRequest<T>({
        method,
        url: `${hosts({ auth })[host]}${path}`,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        queryParams: compactQuery({ queryParams }),
        body,
    }));
    if (error) {
        throw new Error(`eBay ${method} ${path} failed: ${describeError({ error })}`);
    }
    return data.body;
}

// Some seller data (e.g. a Trading-created listing's fitment chart) has no REST equivalent, so call the Trading XML API with the OAuth user token.
async function tradingCall({ auth, callName, innerXml }: { auth: EbayAuthProps; callName: string; innerXml: string }): Promise<string> {
    const accessToken = await getAccessToken({ auth });
    const { data, error } = await tryCatch(() => httpClient.sendRequest<string>({
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
    }));
    if (error) {
        throw new Error(`eBay Trading ${callName} failed: ${describeError({ error })}`);
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

function describeError({ error }: { error: Error }): string {
    if (error instanceof HttpError) {
        return `${error.response.status} ${JSON.stringify(error.response.body)}`;
    }
    return error.message;
}

const TRADING_COMPATIBILITY_LEVEL = '1331';

export const ebayClient = {
    getAccessToken,
    getApplicationToken,
    tryGetAccessToken,
    request,
    tradingCall,
    getUsername,
    baseUrl: ({ auth }: { auth: EbayAuthProps }) => hosts({ auth }).api,
};

export type EbayAuthProps = {
    appId: string;
    certId: string;
    refreshToken: string;
    environment?: string;
};

type EbayHost = 'api' | 'apiz';

type EbayRequest = {
    auth: EbayAuthProps;
    method: HttpMethod;
    path: string;
    queryParams?: Record<string, string | number | undefined | null>;
    body?: unknown;
    host?: EbayHost;
    tokenType?: 'user' | 'application';
};
