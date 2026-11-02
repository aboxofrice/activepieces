import { createTrigger, Property, Store, TriggerStrategy } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { Turn14AuthProps, turn14Client } from '../common/client';
import { Turn14Inventory, turn14Inventory } from '../common/inventory';
import { turn14Polling } from '../common/polling';
import { turn14Props } from '../common/props';

export const inventoryChanged = createTrigger({
    auth: turn14Auth,
    name: 'inventory_changed',
    displayName: 'Inventory Changed',
    description: 'Fires once per item whose Turn14 stock changed since the last check (from Turn14\'s inventory update feed). Optionally limit it to a list of items or one brand.',
    props: {
        itemIds: turn14Props.itemIdsProperty({ displayName: 'Only These Item IDs', required: false }),
        brandId: turn14Props.brandDropdown({ required: false, description: 'Only items of this brand.' }),
        includeEtaChanges: Property.Checkbox({
            displayName: 'Also Fire on ETA / On-Order Changes',
            description: 'By default only quantity changes (Turn14 warehouses and manufacturer stock) fire.',
            required: false,
            defaultValue: false,
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
    },
    async onEnable(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const { changes, seen } = await detectChanges({ auth, store: context.store, propsValue: context.propsValue, state: { lastPollAt: now, seen: {} }, now });
        await context.store.put(STATE_KEY, { lastPollAt: now, seen: { ...seen, ...Object.fromEntries(changes.map((change) => [change.id, change.entry])) } });
    },
    async onDisable(context) {
        await context.store.delete(STATE_KEY);
        await turn14Polling.clearBrandCache({ store: context.store });
    },
    async test(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const { changes } = await detectChanges({ auth, store: context.store, propsValue: context.propsValue, state: { lastPollAt: now - 60 * 60 * 1000, seen: {} }, now });
        return changes.slice(0, TEST_LIMIT).map((change) => change.output);
    },
    async run(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const state = (await turn14Polling.readState({ store: context.store, key: STATE_KEY, isValid: isState })) ?? { lastPollAt: now - 15 * 60 * 1000, seen: {} };
        const { changes, seen } = await detectChanges({ auth, store: context.store, propsValue: context.propsValue, state, now });
        const merged = { ...seen, ...Object.fromEntries(changes.map((change) => [change.id, change.entry])) };
        await context.store.put(STATE_KEY, { lastPollAt: now, seen: capEntries({ seen: merged }) });
        return changes.map((change) => change.output);
    },
});

async function detectChanges({ auth, store, propsValue, state, now }: DetectParams): Promise<{ changes: Change[]; seen: Record<string, SeenEntry> }> {
    const minutesSinceLastPoll = Math.ceil((now - state.lastPollAt) / 60000) + WINDOW_OVERLAP_MINUTES;
    const window = UPDATE_WINDOWS_MINUTES.find((minutes) => minutes >= minutesSinceLastPoll) ?? UPDATE_WINDOWS_MINUTES[UPDATE_WINDOWS_MINUTES.length - 1];
    const filter = await turn14Polling.resolveItemFilter({
        auth,
        store,
        itemIds: turn14Inventory.parseIdList({ values: propsValue.itemIds }),
        brandId: propsValue.brandId ? String(propsValue.brandId) : undefined,
    });
    const { rows } = await turn14Client.fetchPages<Turn14Inventory>({ auth, path: '/v1/inventory/updates', queryParams: { minutes: window }, maxPages: MAX_PAGES });
    const relevant = rows.filter((row) => filter === null || filter.has(row.id));
    // Entries only need to outlive the next window, which overlaps this one.
    const keepAfter = now - (window + WINDOW_OVERLAP_MINUTES * 2) * 60000;
    const seen = Object.fromEntries(Object.entries(state.seen).filter(([, entry]) => entry[1] >= keepAfter));
    const flat = turn14Inventory.flattenInventory({ rows: relevant });
    const changes = relevant.flatMap((row, index) => {
        const hash = turn14Polling.fingerprint({ value: fingerprintSource({ row, includeEta: propsValue.includeEtaChanges === true }) });
        const previous = seen[row.id];
        if (previous && previous[0] === hash) {
            return [];
        }
        const totalQuantity = Number(flat[index]['total_quantity'] ?? 0);
        const entry: SeenEntry = [hash, now, totalQuantity];
        return [{
            id: row.id,
            entry,
            output: { ...flat[index], previous_total_quantity: previous ? previous[2] : null, detected_at: new Date(now).toISOString() },
        }];
    });
    return { changes, seen };
}

function fingerprintSource({ row, includeEta }: { row: Turn14Inventory; includeEta: boolean }): unknown {
    const inventory = row.attributes?.inventory ?? {};
    const sortedInventory = Object.keys(inventory).sort().map((key) => [key, inventory[key]]);
    return includeEta
        ? [sortedInventory, row.attributes?.manufacturer?.stock ?? null, row.attributes?.eta ?? null, row.attributes?.manufacturer?.esd ?? null]
        : [sortedInventory, row.attributes?.manufacturer?.stock ?? null];
}

function capEntries({ seen }: { seen: Record<string, SeenEntry> }): Record<string, SeenEntry> {
    const entries = Object.entries(seen);
    if (entries.length <= MAX_SEEN_ENTRIES) {
        return seen;
    }
    return Object.fromEntries([...entries].sort((left, right) => right[1][1] - left[1][1]).slice(0, MAX_SEEN_ENTRIES));
}

function isState(value: unknown): value is InventoryState {
    return turn14Client.isRecord(value) && typeof value['lastPollAt'] === 'number' && turn14Client.isRecord(value['seen']);
}

// Turn14 only accepts these window sizes for /v1/inventory/updates.
const UPDATE_WINDOWS_MINUTES = [15, 30, 60, 240, 480, 1440];
const WINDOW_OVERLAP_MINUTES = 5;
const MAX_PAGES = 100;
const MAX_SEEN_ENTRIES = 5000;
const TEST_LIMIT = 5;
const STATE_KEY = 'turn14_inventory_changed_state';

// [fingerprint, detected at (epoch ms), total quantity]
type SeenEntry = [string, number, number];

type InventoryState = { lastPollAt: number; seen: Record<string, SeenEntry> };

type Change = { id: string; entry: SeenEntry; output: Record<string, unknown> };

type DetectParams = {
    auth: Turn14AuthProps;
    store: Store;
    propsValue: { itemIds?: unknown[]; brandId?: unknown; includeEtaChanges?: boolean };
    state: InventoryState;
    now: number;
};
