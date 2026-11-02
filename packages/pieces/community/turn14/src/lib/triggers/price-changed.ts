import { createTrigger, Property, Store, TriggerStrategy } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { Turn14AuthProps } from '../common/client';
import { turn14Inventory } from '../common/inventory';
import { FetchChangedIds, PriceItems, turn14PriceCheck } from '../common/price-check';
import { turn14Polling } from '../common/polling';
import { turn14Pricing } from '../common/pricing';
import { turn14Props } from '../common/props';

export const priceChanged = createTrigger({
    auth: turn14Auth,
    name: 'price_changed',
    displayName: 'Price Changed',
    description: 'Fires when Turn14 reports a pricing change for an item (from /v1/pricing/changes, which is tracked per day). Without an item or brand filter this can be 20,000+ items on a busy day - use the filters or the batch mode. Each check is time-limited: a long change list is read across checks from where the last one stopped, and price lookups that do not fit are carried to the next check. State survives a republish; after the flow has been off for more than 15 minutes it starts fresh and only later changes fire. Right after the trigger is enabled, changes that may predate enabling (Turn14 gives no timestamp) fire with possibly_before_enable = true: add a filter step on it, or use the batch output to review them together.',
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
            description: 'At most 100. Items beyond this are still reported, with pricing_included = false. Lookups that do not fit in the check\'s time limit are carried to the next check.',
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
        truncated: false,
        possibly_before_enable: false,
    },
    async onEnable(context) {
        const now = Date.now();
        if (await turn14Polling.resumeAfterRepublish({ store: context.store, now }) && await turn14PriceCheck.hasPriceState({ store: context.store })) {
            return;
        }
        const auth = turn14AuthProps(context.auth);
        const deadline = now + turn14Polling.POLL_BUDGET_MS;
        const filter = await filterFor({ auth, store: context.store, propsValue: context.propsValue, deadline });
        await turn14PriceCheck.seedPriceState({ store: context.store, now, deadline, fetchChangedIds: changedIdsFetcher({ auth, filter }) });
    },
    async onDisable(context) {
        await turn14Polling.markDisabled({ store: context.store, now: Date.now() });
    },
    async test(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const deadline = now + turn14Polling.POLL_BUDGET_MS;
        const filter = await filterFor({ auth, store: context.store, propsValue: context.propsValue, deadline });
        const dates = turn14PriceCheck.datesToCheck({ now });
        const found = await dates.reduce<Promise<{ itemId: string; date: string }[]>>(async (previous, date) => {
            const collected = await previous;
            if (collected.length >= TEST_LIMIT) {
                return collected;
            }
            // A filtered test has to read the whole day to find a match; an unfiltered one needs one page.
            const { itemIds } = await changedIds({ auth, date, filter, deadline, maxPages: filter === null ? 1 : MAX_PAGES });
            return [...collected, ...itemIds.map((itemId) => ({ itemId, date }))];
        }, Promise.resolve([]));
        const sample = found.slice(0, TEST_LIMIT);
        const priced = context.propsValue.includePricing === false ? [] : await priceItemsFetcher({ auth })({ itemIds: sample.map((change) => change.itemId), deadline });
        const rows = sample.map((change, index) => (index < priced.length
            ? { item_id: change.itemId, change_date: change.date, pricing_included: true, ...priced[index], truncated: false, possibly_before_enable: false }
            : { item_id: change.itemId, change_date: change.date, pricing_included: false, truncated: false, possibly_before_enable: false }));
        return context.propsValue.emitMode === 'batch' ? [batchOf({ rows, deferredCount: 0, truncated: false })] : rows;
    },
    async run(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const deadline = now + turn14Polling.POLL_BUDGET_MS;
        const filter = await filterFor({ auth, store: context.store, propsValue: context.propsValue, deadline });
        const { rows, deferredCount, truncated } = await turn14PriceCheck.runPriceCheck({
            store: context.store,
            now,
            deadline,
            fetchChangedIds: changedIdsFetcher({ auth, filter }),
            priceItems: priceItemsFetcher({ auth }),
            includePricing: context.propsValue.includePricing !== false,
            maxLookups: context.propsValue.maxPricingLookups ?? DEFAULT_LOOKUPS,
        });
        if (rows.length === 0) {
            return [];
        }
        return context.propsValue.emitMode === 'batch' ? [batchOf({ rows, deferredCount, truncated })] : rows;
    },
});

async function filterFor({ auth, store, propsValue, deadline }: { auth: Turn14AuthProps; store: Store; propsValue: PriceProps; deadline: number }): Promise<Set<string> | null> {
    return turn14Polling.resolveItemFilter({
        auth,
        store,
        itemIds: turn14Inventory.parseIdList({ values: propsValue.itemIds }),
        brandId: propsValue.brandId ? String(propsValue.brandId) : undefined,
        deadline,
    });
}

async function changedIds({ auth, date, filter, deadline, startPage = 1, maxPages = MAX_PAGES }: ChangedIdsParams): Promise<{ itemIds: string[]; nextPage: number | null }> {
    const { itemIds, nextPage } = await turn14Pricing.getPriceChanges({ auth, startDate: date, endDate: date, maxPages, startPage, deadline });
    return { itemIds: filter === null ? itemIds : itemIds.filter((id) => filter.has(id)), nextPage };
}

function changedIdsFetcher({ auth, filter }: { auth: Turn14AuthProps; filter: Set<string> | null }): FetchChangedIds {
    return ({ date, startPage, deadline }) => changedIds({ auth, date, filter, deadline, startPage });
}

function priceItemsFetcher({ auth }: { auth: Turn14AuthProps }): PriceItems {
    return async ({ itemIds, deadline }) => turn14Pricing.flattenPricing({ results: await turn14Pricing.getPricing({ auth, itemIds, deadline }) });
}

function batchOf({ rows, deferredCount, truncated }: { rows: Record<string, unknown>[]; deferredCount: number; truncated: boolean }): Record<string, unknown> {
    return { changed_count: rows.length, item_ids: rows.map((row) => row['item_id']), items: rows, deferred_to_next_check: deferredCount, truncated };
}

const MAX_PAGES = 60;
const DEFAULT_LOOKUPS = 50;
const TEST_LIMIT = 5;

type ChangedIdsParams = {
    auth: Turn14AuthProps;
    date: string;
    filter: Set<string> | null;
    deadline: number;
    startPage?: number;
    maxPages?: number;
};

type PriceProps = {
    itemIds?: unknown[];
    brandId?: unknown;
    includePricing?: boolean;
    maxPricingLookups?: number;
    emitMode?: string;
};
