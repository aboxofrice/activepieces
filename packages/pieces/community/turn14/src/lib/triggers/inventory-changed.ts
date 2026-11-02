import { createTrigger, Property, Store, TriggerStrategy } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps, Turn14AuthValue } from '../auth';
import { Turn14AuthProps, turn14Client } from '../common/client';
import { Turn14Inventory, turn14Inventory } from '../common/inventory';
import { ReadUpdates, turn14InventoryCheck } from '../common/inventory-check';
import { turn14Polling } from '../common/polling';
import { turn14Props } from '../common/props';

export const inventoryChanged = createTrigger({
    auth: turn14Auth,
    name: 'inventory_changed',
    displayName: 'Inventory Changed',
    description: 'Fires once per item whose Turn14 stock changed since the last check (from Turn14\'s inventory update feed). Optionally limit it to a list of items or one brand. Turn14 posts most updates in one daily burst; a check that cannot read it all in time continues where it stopped on the next check. Turn14 keeps one day of updates, so after more than 24 hours without a check older changes are lost (outputs carry truncated = true). State survives a republish; after the flow has been off for more than 15 minutes it starts fresh.',
    props: {
        itemIds: turn14Props.itemIdsProperty({ displayName: 'Only These Item IDs', required: false }),
        brandId: turn14Props.brandDropdown({ required: false, description: 'Only items of this brand.' }),
        includeEtaChanges: Property.Checkbox({
            displayName: 'Also Fire on ETA / On-Order Changes',
            description: 'By default only quantity changes (Turn14 warehouses and manufacturer stock) fire.',
            required: false,
            defaultValue: false,
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
        total_quantity: 10,
        previous_total_quantity: 12,
        total_on_order: 10,
        earliest_eta: '2026-11-11',
        manufacturer_stock: 25,
        manufacturer_esd: '2026-11-04',
        qty_location_01: 4,
        on_order_location_01: 9,
        eta_location_01: '2026-11-11',
        qty_location_02: 0,
        on_order_location_02: 1,
        eta_location_02: '2026-11-11',
        qty_location_03: 1,
        on_order_location_03: 0,
        eta_location_03: null,
        qty_location_59: 5,
        on_order_location_59: 0,
        eta_location_59: null,
        detected_at: '2026-11-01T15:05:00.000Z',
        truncated: false,
    },
    async onEnable(context) {
        const now = Date.now();
        if (await turn14Polling.resumeAfterRepublish({ store: context.store, now }) && await turn14InventoryCheck.hasInventoryState({ store: context.store })) {
            return;
        }
        await turn14InventoryCheck.seedInventoryState(await checkParams({ context, now }));
    },
    async onDisable(context) {
        await turn14Polling.markDisabled({ store: context.store, now: Date.now() });
    },
    async test(context) {
        const now = Date.now();
        const params = await checkParams({ context, now });
        const { rows } = await params.readUpdates({ window: TEST_WINDOW_MINUTES, startPage: 1, deadline: params.deadline });
        const changes = turn14InventoryCheck.detectChanges({ rows: rows.filter((row) => params.filter === null || params.filter.has(row.id)), seen: new Map(), includeEta: params.includeEta, now, truncated: false });
        const outputs = changes.slice(0, TEST_LIMIT).map((change) => change.output);
        return context.propsValue.emitMode === 'batch' ? [batchOf({ outputs, truncated: false, finished: true })] : outputs;
    },
    async run(context) {
        const result = await turn14InventoryCheck.runInventoryCheck(await checkParams({ context, now: Date.now() }));
        if (result.outputs.length === 0) {
            return [];
        }
        return context.propsValue.emitMode === 'batch' ? [batchOf(result)] : result.outputs;
    },
});

async function checkParams({ context, now }: { context: TriggerContext; now: number }) {
    const auth = turn14AuthProps(context.auth);
    const deadline = now + turn14Polling.POLL_BUDGET_MS;
    const filter = await turn14Polling.resolveItemFilter({
        auth,
        store: context.store,
        itemIds: turn14Inventory.parseIdList({ values: context.propsValue.itemIds }),
        brandId: context.propsValue.brandId ? String(context.propsValue.brandId) : undefined,
        deadline,
    });
    return { store: context.store, now, deadline, filter, includeEta: context.propsValue.includeEtaChanges === true, readUpdates: updatesReader({ auth }) };
}

function updatesReader({ auth }: { auth: Turn14AuthProps }): ReadUpdates {
    return async ({ window, startPage, deadline }) => {
        const { rows, nextPage } = await turn14Client.fetchPages<Turn14Inventory>({ auth, path: '/v1/inventory/updates', queryParams: { minutes: window }, maxPages: MAX_PAGES_PER_CHECK, startPage, deadline });
        return { rows, nextPage };
    };
}

function batchOf({ outputs, truncated, finished }: { outputs: Record<string, unknown>[]; truncated: boolean; finished: boolean }): Record<string, unknown> {
    return { changed_count: outputs.length, item_ids: outputs.map((output) => output['item_id']), items: outputs, truncated, more_pending: !finished };
}

const MAX_PAGES_PER_CHECK = 150;
const TEST_WINDOW_MINUTES = 60;
const TEST_LIMIT = 5;

type TriggerContext = {
    auth: Turn14AuthValue;
    store: Store;
    propsValue: { itemIds?: unknown[]; brandId?: unknown; includeEtaChanges?: boolean };
};
