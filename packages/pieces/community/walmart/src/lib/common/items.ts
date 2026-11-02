import { HttpMethod } from '@activepieces/pieces-common';
import { WalmartAuthProps, walmartClient } from './client';
import { walmartJson } from './json';

const { stringAt, numberAt, arrayAt, valueAt } = walmartJson;

// Offset paging rather than nextCursor: Walmart's item cursor stays the same from page to
// page (it is server-side state valid for two minutes), so it cannot tell us when to stop.
async function listItems({ auth, filters, maxItems }: { auth: WalmartAuthProps; filters: ItemFilters; maxItems: number }): Promise<FlatItem[]> {
    const pageSize = Math.min(ITEMS_PAGE_SIZE, Math.max(1, maxItems));
    const collect = async ({ offset, collected }: { offset: number; collected: FlatItem[] }): Promise<FlatItem[]> => {
        const page = await walmartClient.request<unknown>({
            auth,
            method: HttpMethod.GET,
            path: '/v3/items',
            queryParams: { ...filters, limit: pageSize, offset },
        });
        const items = arrayAt({ value: page, path: ['ItemResponse'] }).map((item) => flattenItem({ item }));
        const all = [...collected, ...items];
        const total = numberAt({ value: page, path: ['totalItems'] }) ?? 0;
        const nextOffset = offset + items.length;
        if (all.length >= maxItems || items.length < pageSize || nextOffset >= total || nextOffset > MAX_ITEMS_OFFSET) {
            return all.slice(0, maxItems);
        }
        return collect({ offset: nextOffset, collected: all });
    };
    return collect({ offset: 0, collected: [] });
}

async function getItem({ auth, id, productIdType }: { auth: WalmartAuthProps; id: string; productIdType: string }): Promise<FlatItem> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        path: `/v3/items/${encodeURIComponent(id)}`,
        queryParams: { productIdType },
    });
    const item = arrayAt({ value: response, path: ['ItemResponse'] })[0];
    if (!item) {
        throw new Error(`Walmart returned no item for ${productIdType} ${id}`);
    }
    return flattenItem({ item });
}

// Searches the public Walmart.com catalog (any seller), not just your own items. This is
// the only API surface that returns a listing's brand and description text.
async function searchCatalog({ auth, query, gtin, upc }: { auth: WalmartAuthProps; query?: string; gtin?: string; upc?: string }): Promise<CatalogItem[]> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        path: '/v3/items/walmart/search',
        queryParams: { query, gtin, upc },
    });
    return arrayAt({ value: response, path: ['items'] }).map((item) => ({
        item_id: stringAt({ value: item, path: ['itemId'] }) ?? '',
        title: stringAt({ value: item, path: ['title'] }) ?? '',
        brand: stringAt({ value: item, path: ['brand'] }) ?? null,
        product_type: stringAt({ value: item, path: ['productType'] }) ?? null,
        price: numberAt({ value: item, path: ['price', 'amount'] }) ?? null,
        currency: stringAt({ value: item, path: ['price', 'currency'] }) ?? null,
        is_marketplace_item: valueAt({ value: item, path: ['isMarketPlaceItem'] }) === true,
        image_url: stringAt({ value: arrayAt({ value: item, path: ['images'] })[0], path: ['url'] }) ?? null,
        description_text: htmlToText({ html: stringAt({ value: item, path: ['description'] }) ?? '' }),
        url: `https://www.walmart.com/ip/${stringAt({ value: item, path: ['itemId'] }) ?? ''}`,
    }));
}

function flattenItem({ item }: { item: Record<string, unknown> }): FlatItem {
    const reasons = valueAt({ value: item, path: ['unpublishedReasons', 'reason'] });
    return {
        sku: stringAt({ value: item, path: ['sku'] }) ?? '',
        item_id: stringAt({ value: item, path: ['itemId'] }) ?? null,
        wpid: stringAt({ value: item, path: ['wpid'] }) ?? null,
        gtin: stringAt({ value: item, path: ['gtin'] }) ?? null,
        upc: stringAt({ value: item, path: ['upc'] }) || null,
        product_name: stringAt({ value: item, path: ['productName'] }) ?? '',
        product_type: stringAt({ value: item, path: ['productType'] }) ?? null,
        condition: stringAt({ value: item, path: ['condition'] }) ?? null,
        availability: stringAt({ value: item, path: ['availability'] }) ?? null,
        price: numberAt({ value: item, path: ['price', 'amount'] }) ?? null,
        currency: stringAt({ value: item, path: ['price', 'currency'] }) ?? null,
        published_status: stringAt({ value: item, path: ['publishedStatus'] }) ?? null,
        lifecycle_status: stringAt({ value: item, path: ['lifecycleStatus'] }) ?? null,
        unpublished_reasons: (Array.isArray(reasons) ? reasons : reasons === undefined ? [] : [reasons]).filter((reason) => typeof reason === 'string').join(' | '),
        url: stringAt({ value: item, path: ['itemId'] }) ? `https://www.walmart.com/ip/${stringAt({ value: item, path: ['itemId'] })}` : null,
    };
}

function htmlToText({ html }: { html: string }): string {
    return html
        .replace(/<\/(tr|p|li|div|h\d)>|<br\s*\/?>/gi, '\n')
        .replace(/<\/t[dh]>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}

const ITEMS_PAGE_SIZE = 200;
const MAX_ITEMS_OFFSET = 10000;

export const walmartItems = {
    listItems,
    getItem,
    searchCatalog,
};

export type ItemFilters = {
    sku?: string;
    lifecycleStatus?: string;
    publishedStatus?: string;
};

export type FlatItem = {
    sku: string;
    item_id: string | null;
    wpid: string | null;
    gtin: string | null;
    upc: string | null;
    product_name: string;
    product_type: string | null;
    condition: string | null;
    availability: string | null;
    price: number | null;
    currency: string | null;
    published_status: string | null;
    lifecycle_status: string | null;
    unpublished_reasons: string;
    url: string | null;
};

export type CatalogItem = {
    item_id: string;
    title: string;
    brand: string | null;
    product_type: string | null;
    price: number | null;
    currency: string | null;
    is_marketplace_item: boolean;
    image_url: string | null;
    description_text: string;
    url: string;
};
