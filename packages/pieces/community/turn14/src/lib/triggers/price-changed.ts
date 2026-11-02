import { createTrigger, Property, Store, TriggerStrategy } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { Turn14AuthProps, turn14Client } from '../common/client';
import { turn14Inventory } from '../common/inventory';
import { turn14Orders } from '../common/orders';
import { turn14Polling } from '../common/polling';
import { turn14Pricing } from '../common/pricing';
import { turn14Props } from '../common/props';

export const priceChanged = createTrigger({
    auth: turn14Auth,
    name: 'price_changed',
    displayName: 'Price Changed',
    description: 'Fires when Turn14 reports a pricing change for an item (from /v1/pricing/changes, which is tracked per day). Without an item or brand filter this can be 20,000+ items on a busy day - use the filters or the batch mode.',
    props: {
        itemIds: turn14Props.itemIdsProperty({ displayName: 'Only These Item IDs', required: false }),
        brandId: turn14Props.brandDropdown({ required: false, description: 'Only items of this brand.' }),
        includePricing: Property.Checkbox({
            displayName: 'Include New Prices',
            description: 'Look up cost, MAP and price lists for changed items (one request per item, about 5 per second).',
            required: false,
            defaultValue: true,
        }),
        maxPricingLookups: Property.Number({
            displayName: 'Max Price Lookups per Check',
            description: 'Items beyond this are still reported, with pricing_included = false.',
            required: false,
            defaultValue: 50,
        }),
        emitMode: Property.StaticDropdown({
            displayName: 'Output',
            required: true,
            defaultValue: 'per_item',
            options: {
                options: [
                    { label: 'One flow run per changed item', value: 'per_item' },
                    { label: 'One flow run per check, with all changed items', value: 'batch' },
                ],
            },
        }),
    },
    type: TriggerStrategy.POLLING,
    sampleData: {
        item_id: '078595',
        change_date: '2026-11-01',
        pricing_included: true,
        purchase_cost: 29.16,
        has_map: true,
        can_purchase: true,
        price_map: 37.95,
        price_retail: 39.95,
        error: null,
    },
    async onEnable(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const filter = await filterFor({ auth, store: context.store, propsValue: context.propsValue });
        const dates = datesToCheck({ now });
        await Promise.all(dates.map(async (date) => {
            const ids = await changedIds({ auth, date, filter });
            await turn14Polling.writeIdSet({ store: context.store, prefix: seenPrefix({ date }), ids });
        }));
        await context.store.put(STATE_KEY, { dates });
    },
    async onDisable(context) {
        const state = await turn14Polling.readState({ store: context.store, key: STATE_KEY, isValid: isState });
        await Promise.all((state?.dates ?? []).map((date) => turn14Polling.deleteIdSet({ store: context.store, prefix: seenPrefix({ date }) })));
        await context.store.delete(STATE_KEY);
        await turn14Polling.clearBrandCache({ store: context.store });
    },
    async test(context) {
        const auth = turn14AuthProps(context.auth);
        const filter = await filterFor({ auth, store: context.store, propsValue: context.propsValue });
        const dates = datesToCheck({ now: Date.now() }).reverse();
        const found = await dates.reduce<Promise<{ itemId: string; date: string }[]>>(async (previous, date) => {
            const collected = await previous;
            if (collected.length >= TEST_LIMIT) {
                return collected;
            }
            // A filtered test has to read the whole day to find a match; an unfiltered one needs one page.
            const ids = await changedIds({ auth, date, filter, maxPages: filter === null ? 1 : MAX_PAGES });
            return [...collected, ...ids.map((itemId) => ({ itemId, date }))];
        }, Promise.resolve([]));
        const rows = await enrich({ auth, changes: found.slice(0, TEST_LIMIT), propsValue: context.propsValue });
        return context.propsValue.emitMode === 'batch' ? [batchOf({ rows })] : rows;
    },
    async run(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const filter = await filterFor({ auth, store: context.store, propsValue: context.propsValue });
        const state = await turn14Polling.readState({ store: context.store, key: STATE_KEY, isValid: isState });
        const dates = datesToCheck({ now });
        const perDate = await dates.reduce<Promise<{ itemId: string; date: string }[]>>(async (previous, date) => {
            const collected = await previous;
            const ids = await changedIds({ auth, date, filter });
            const seen = await turn14Polling.readIdSet({ store: context.store, prefix: seenPrefix({ date }) });
            await turn14Polling.writeIdSet({ store: context.store, prefix: seenPrefix({ date }), ids: [...new Set([...seen, ...ids])] });
            return [...collected, ...ids.filter((id) => !seen.has(id)).map((itemId) => ({ itemId, date }))];
        }, Promise.resolve([]));
        const expired = (state?.dates ?? []).filter((date) => !dates.includes(date));
        await Promise.all(expired.map((date) => turn14Polling.deleteIdSet({ store: context.store, prefix: seenPrefix({ date }) })));
        await context.store.put(STATE_KEY, { dates });
        if (perDate.length === 0) {
            return [];
        }
        const rows = await enrich({ auth, changes: perDate, propsValue: context.propsValue });
        return context.propsValue.emitMode === 'batch' ? [batchOf({ rows })] : rows;
    },
});

async function filterFor({ auth, store, propsValue }: { auth: Turn14AuthProps; store: Store; propsValue: PriceProps }): Promise<Set<string> | null> {
    return turn14Polling.resolveItemFilter({
        auth,
        store,
        itemIds: turn14Inventory.parseIdList({ values: propsValue.itemIds }),
        brandId: propsValue.brandId ? String(propsValue.brandId) : undefined,
    });
}

async function changedIds({ auth, date, filter, maxPages = MAX_PAGES }: { auth: Turn14AuthProps; date: string; filter: Set<string> | null; maxPages?: number }): Promise<string[]> {
    const { itemIds } = await turn14Pricing.getPriceChanges({ auth, startDate: date, endDate: date, maxPages });
    return filter === null ? itemIds : itemIds.filter((id) => filter.has(id));
}

async function enrich({ auth, changes, propsValue }: { auth: Turn14AuthProps; changes: { itemId: string; date: string }[]; propsValue: PriceProps }): Promise<Record<string, unknown>[]> {
    const lookups = propsValue.includePricing === false ? 0 : Math.max(0, Math.floor(propsValue.maxPricingLookups ?? DEFAULT_LOOKUPS));
    const toPrice = changes.slice(0, lookups);
    const priced = toPrice.length > 0 ? turn14Pricing.flattenPricing({ results: await turn14Pricing.getPricing({ auth, itemIds: toPrice.map((change) => change.itemId) }) }) : [];
    return changes.map((change, index) => (index < priced.length
        ? { item_id: change.itemId, change_date: change.date, pricing_included: true, ...priced[index] }
        : { item_id: change.itemId, change_date: change.date, pricing_included: false }));
}

function batchOf({ rows }: { rows: Record<string, unknown>[] }): Record<string, unknown> {
    return { changed_count: rows.length, item_ids: rows.map((row) => row['item_id']), items: rows };
}

// Turn14 dates its changes by day. Yesterday is re-checked so late-posted changes and the gap
// between Turn14's timezone and UTC are not missed.
function datesToCheck({ now }: { now: number }): string[] {
    return [turn14Orders.isoDate({ epochMs: now - turn14Orders.DAY_MS }), turn14Orders.isoDate({ epochMs: now })];
}

function seenPrefix({ date }: { date: string }): string {
    return `turn14_price_seen_${date}`;
}

function isState(value: unknown): value is { dates: string[] } {
    return turn14Client.isRecord(value) && Array.isArray(value['dates']) && value['dates'].every((date) => typeof date === 'string');
}

const MAX_PAGES = 60;
const DEFAULT_LOOKUPS = 50;
const TEST_LIMIT = 5;
const STATE_KEY = 'turn14_price_changed_state';

type PriceProps = {
    itemIds?: unknown[];
    brandId?: unknown;
    includePricing?: boolean;
    maxPricingLookups?: number;
    emitMode?: string;
};
