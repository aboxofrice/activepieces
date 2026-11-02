import { tryCatch } from '@activepieces/shared';
import { Turn14AuthProps, turn14Client } from './client';

// /v1/pricing/{id} takes a single item (a comma list is a 404), so items are fetched one by one;
// the client spaces requests to stay under Turn14's 5 requests/second limit. With a deadline, no
// lookup runs past it and only the items looked up so far are returned, in order.
async function getPricing({ auth, itemIds, deadline }: { auth: Turn14AuthProps; itemIds: string[]; deadline?: number }): Promise<PricingResult[]> {
    const { results } = await itemIds.reduce<Promise<{ results: PricingResult[]; stopped: boolean }>>(async (previous, itemId) => {
        const acc = await previous;
        if (acc.stopped || (deadline !== undefined && Date.now() >= deadline)) {
            return { ...acc, stopped: true };
        }
        if (!/^\d+$/.test(itemId)) {
            return { ...acc, results: [...acc.results, { itemId, pricing: null, error: 'Not a Turn14 item ID (item IDs are numeric, e.g. 078595).' }] };
        }
        const { data, error } = await tryCatch(() => turn14Client.request({ auth, method: 'GET', path: `/v1/pricing/${encodeURIComponent(itemId)}`, validate: turn14Client.isSingleResponse<Turn14Pricing>, deadline }));
        if (error instanceof turn14Client.Turn14DeadlineError) {
            return { ...acc, stopped: true };
        }
        return { ...acc, results: [...acc.results, error ? { itemId, pricing: null, error: error.message } : { itemId, pricing: data.data, error: null }] };
    }, Promise.resolve({ results: [], stopped: false }));
    return results;
}

// One page window of a day's (or range's) change list. nextPage is null once the last page was read.
async function getPriceChanges({ auth, startDate, endDate, maxPages, startPage, deadline }: { auth: Turn14AuthProps; startDate: string; endDate?: string; maxPages: number; startPage?: number; deadline?: number }): Promise<PriceChanges> {
    const { rows, totalPages, pagesRead, truncated, nextPage } = await turn14Client.fetchPages<{ id: string | number; attributes?: { itemcode?: string } }>({
        auth,
        path: '/v1/pricing/changes',
        queryParams: { start_date: startDate, end_date: endDate },
        maxPages,
        startPage,
        deadline,
    });
    return { itemIds: [...new Set(rows.map((row) => row.attributes?.itemcode ?? String(row.id)))], totalPages, pagesRead, truncated, nextPage };
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

export type PriceChanges = { itemIds: string[]; totalPages: number; pagesRead: number; truncated: boolean; nextPage: number | null };

export type PricingResult = { itemId: string; pricing: Turn14Pricing | null; error: string | null };

export type FlatPricing = Record<string, string | number | boolean | null>;
