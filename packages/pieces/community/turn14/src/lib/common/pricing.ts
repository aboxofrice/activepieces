import { tryCatch } from '@activepieces/shared';
import { Turn14AuthProps, turn14Client } from './client';

// /v1/pricing/{id} takes a single item (a comma list is a 404), so items are fetched one by one;
// the client spaces requests to stay under Turn14's 5 requests/second limit. With a deadline, no
// new lookup starts after it and only the items looked up so far are returned, in order.
async function getPricing({ auth, itemIds, deadline }: { auth: Turn14AuthProps; itemIds: string[]; deadline?: number }): Promise<PricingResult[]> {
    return itemIds.reduce<Promise<PricingResult[]>>(async (previous, itemId, index) => {
        const collected = await previous;
        if (collected.length < index || (deadline !== undefined && Date.now() >= deadline)) {
            return collected;
        }
        if (!/^\d+$/.test(itemId)) {
            return [...collected, { itemId, pricing: null, error: 'Not a Turn14 item ID (item IDs are numeric, e.g. 078595).' }];
        }
        const { data, error } = await tryCatch(() => turn14Client.request({ auth, method: 'GET', path: `/v1/pricing/${encodeURIComponent(itemId)}`, validate: turn14Client.isSingleResponse<Turn14Pricing> }));
        return [...collected, error ? { itemId, pricing: null, error: error.message } : { itemId, pricing: data.data, error: null }];
    }, Promise.resolve([]));
}

async function getPriceChanges({ auth, startDate, endDate, maxPages, deadline }: { auth: Turn14AuthProps; startDate: string; endDate?: string; maxPages: number; deadline?: number }): Promise<PriceChanges> {
    const { rows, totalPages, pagesRead, truncated } = await turn14Client.fetchPages<{ id: string | number; attributes?: { itemcode?: string } }>({
        auth,
        path: '/v1/pricing/changes',
        queryParams: { start_date: startDate, end_date: endDate },
        maxPages,
        deadline,
    });
    return { itemIds: [...new Set(rows.map((row) => row.attributes?.itemcode ?? String(row.id)))], totalPages, pagesRead, truncated };
}

// Price list names ("MAP", "Retail", "Jobber"...) become columns, unioned across the result so
// every row has the same keys.
function flattenPricing({ results }: { results: PricingResult[] }): FlatPricing[] {
    const listNames = [...new Set(results.flatMap((result) => (result.pricing?.attributes?.pricelists ?? []).map((list) => list.name)))].sort();
    return results.map(({ itemId, pricing, error }) => {
        const lists = pricing?.attributes?.pricelists ?? [];
        const priceColumns = listNames.reduce<Record<string, number | null>>((columns, name) => ({
            ...columns,
            [`price_${columnName({ name })}`]: lists.find((list) => list.name === name)?.price ?? null,
        }), {});
        return {
            item_id: pricing?.id ?? itemId,
            purchase_cost: pricing?.attributes?.purchase_cost ?? null,
            has_map: pricing?.attributes?.has_map ?? null,
            can_purchase: pricing?.attributes?.can_purchase ?? null,
            ...priceColumns,
            error,
        };
    });
}

function columnName({ name }: { name: string }): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export const turn14Pricing = { getPricing, getPriceChanges, flattenPricing };

export type Turn14Pricing = {
    id: string;
    type?: string;
    attributes?: {
        has_map?: boolean;
        can_purchase?: boolean;
        purchase_cost?: number;
        pricelists?: { name: string; price: number }[];
    };
};

export type PriceChanges = { itemIds: string[]; totalPages: number; pagesRead: number; truncated: boolean };

export type PricingResult = { itemId: string; pricing: Turn14Pricing | null; error: string | null };

export type FlatPricing = Record<string, string | number | boolean | null>;
