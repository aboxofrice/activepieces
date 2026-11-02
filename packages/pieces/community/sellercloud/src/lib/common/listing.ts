import { HttpMethod } from '@activepieces/pieces-common';
import { SellercloudAuthProps, sellercloudClient } from './client';

// SellerCloud list endpoints cap pageSize at 50 regardless of what is asked for, so page
// on the running total. `maxPages` bounds a single call against a rate-limited API; a
// truncated result says which page to start from to read the rest.
async function listPages<T>({ auth, token, path, query, arrayQuery, maxPages, startPage = 1 }: ListPagesParams): Promise<ListPagesResult<T>> {
    const firstPage = Math.max(1, Math.floor(startPage));
    const collect = async ({ pageNumber, collected }: { pageNumber: number; collected: T[] }): Promise<ListPagesResult<T>> => {
        const page = await sellercloudClient.request<PagedResponse<T>>({
            auth,
            token,
            method: HttpMethod.GET,
            path: path + buildArrayQuery({ arrayQuery }),
            queryParams: { ...query, 'model.pageSize': PAGE_SIZE, 'model.pageNumber': pageNumber },
        });
        const items = page.Items ?? [];
        const all = [...collected, ...items];
        const total = page.TotalResults ?? (firstPage - 1) * PAGE_SIZE + all.length;
        if (items.length === 0 || (firstPage - 1) * PAGE_SIZE + all.length >= total) {
            return { items: all, total, truncated: false, nextPage: pageNumber + 1 };
        }
        if (pageNumber - firstPage + 1 >= maxPages) {
            return { items: all, total, truncated: true, nextPage: pageNumber + 1 };
        }
        return collect({ pageNumber: pageNumber + 1, collected: all });
    };
    return collect({ pageNumber: firstPage, collected: [] });
}

// `collectionFormat: multi` array params must repeat the key; QueryParams cannot express that.
function buildArrayQuery({ arrayQuery }: { arrayQuery?: Record<string, (string | number)[] | undefined> }): string {
    const pairs = Object.entries(arrayQuery ?? {})
        .flatMap(([key, values]) => (values ?? []).map((value) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`));
    return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

const PAGE_SIZE = 50;

export const sellercloudListing = { listPages, buildArrayQuery, PAGE_SIZE };

export type ListPagesResult<T> = {
    items: T[];
    total: number;
    truncated: boolean;
    nextPage: number;
};

type PagedResponse<T> = {
    Items: T[] | null;
    TotalResults: number | null;
};

type ListPagesParams = {
    auth: SellercloudAuthProps;
    token?: string;
    path: string;
    query?: Record<string, string | number | boolean | undefined | null>;
    arrayQuery?: Record<string, (string | number)[] | undefined>;
    maxPages: number;
    startPage?: number;
};
