import { HttpError, HttpMethod, QueryParams, httpClient } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';

async function getToken({ auth }: { auth: SellercloudAuthProps }): Promise<string> {
    const response = await httpClient.sendRequest<{ access_token: string }>({
        method: HttpMethod.POST,
        url: `${apiBase({ auth })}/token`,
        headers: { 'Content-Type': 'application/json' },
        body: { Username: auth.username, Password: auth.password },
    });
    return response.body.access_token;
}

async function tryGetToken({ auth }: { auth: SellercloudAuthProps }): Promise<{ error: string | null }> {
    const { error } = await tryCatch(() => getToken({ auth }));
    return { error: error ? describeError({ error }) : null };
}

// Callers that make many requests (catalog paging, job polling) pass `token` so one run logs in once; tokens last an hour.
async function request<T>({ auth, token, method, path, queryParams, body }: SellercloudRequest): Promise<T> {
    const accessToken = token ?? await getToken({ auth });
    const { data, error } = await tryCatch(() => httpClient.sendRequest<T>({
        method,
        url: `${apiBase({ auth })}${path}`,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        queryParams: compactQuery({ queryParams }),
        body,
    }));
    if (error) {
        throw new Error(`SellerCloud ${method} ${path} failed: ${describeError({ error })}`);
    }
    return data.body;
}

async function listWarehouses({ auth, token }: { auth: SellercloudAuthProps; token?: string }): Promise<SellercloudWarehouse[]> {
    return fetchAllPages<SellercloudWarehouse>({ auth, token, path: '/Warehouses' });
}

async function listCatalogProductIds({ auth, token }: { auth: SellercloudAuthProps; token?: string }): Promise<string[]> {
    const products = await fetchAllPages<{ ID: string }>({ auth, token, path: '/Catalog' });
    return products.map((product) => product.ID);
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
    if (error instanceof HttpError) {
        return `${error.response.status} ${JSON.stringify(error.response.body)}`;
    }
    return error.message;
}

const MAX_PAGE_SIZE = 500;

export const sellercloudClient = {
    getToken,
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

type SellercloudRequest = {
    auth: SellercloudAuthProps;
    token?: string;
    method: HttpMethod;
    path: string;
    queryParams?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
};
