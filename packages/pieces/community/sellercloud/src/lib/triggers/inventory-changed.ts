import { createTrigger, Property, TriggerStrategy } from '@activepieces/pieces-framework';
import { isNil, tryCatch } from '@activepieces/shared';
import { sellercloudAuth, sellercloudAuthProps, SellercloudAuthValue } from '../auth';
import { sellercloudDropdowns } from '../common/dropdowns';
import { sellercloudClient } from '../common/client';
import { lowStock } from '../common/low-stock';
import { FetchItems, PolledItem, PollStore, sellercloudPoller } from '../common/poller';
import { InventoryRecord, sellercloudFeeds } from '../common/trigger-feeds';

export const inventoryChanged = createTrigger({
    auth: sellercloudAuth,
    name: 'inventory_changed',
    displayName: 'Inventory Changed / Low Stock',
    description: 'Triggers when the physical quantity of watched products changes, or when it drops to or below a low-stock threshold.',
    props: {
        mode: Property.StaticDropdown({
            displayName: 'Trigger When',
            required: true,
            defaultValue: 'LOW_STOCK',
            options: {
                options: [
                    { label: 'Quantity drops to or below the threshold (low stock)', value: 'LOW_STOCK' },
                    { label: 'Quantity changes (any change)', value: 'CHANGED' },
                ],
            },
        }),
        skus: Property.Array({
            displayName: 'SKUs to Watch',
            description: `Product SKUs (up to 200). Required for "Quantity changes". For low stock, leave empty to watch every product in the chosen warehouse that SellerCloud reports as updated since the last check (can be noisy for warehouses that are bulk-updated daily).`,
            required: false,
        }),
        warehouse: sellercloudDropdowns.warehouse({
            required: false,
            description: 'Watch the quantity in this warehouse. Leave empty to watch the total physical quantity across warehouses.',
        }),
        threshold: Property.Number({
            displayName: 'Low-Stock Threshold',
            description: 'Low stock means a physical quantity at or below this number.',
            required: false,
            defaultValue: 0,
        }),
        companies: sellercloudDropdowns.companies({ required: false, description: 'Only include products of these companies (stores). Leave empty for all.' }),
        otherCompanyIds: sellercloudDropdowns.otherCompanyIds,
    },
    sampleData: {
        event: 'low_stock',
        sku: 'SAMPLE-SKU-1',
        product_name: 'Sample Product',
        warehouse_id: 1,
        warehouse_name: 'Main Warehouse',
        physical_qty: 0,
        previous_physical_qty: 3,
        available_qty: 0,
        threshold: 0,
        company_id: 100,
        company_name: 'Your Company',
        brand: 'Sample Brand',
        last_modified: '2026-11-01T10:03:06.14',
    },
    type: TriggerStrategy.POLLING,
    async onEnable(context) {
        await sellercloudPoller.enable({
            store: context.store,
            fingerprint: fingerprint({ auth: context.auth, propsValue: context.propsValue }),
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue }),
            retentionMs: RETENTION_MS,
            sinceMs: Date.now() - sellercloudPoller.OVERLAP_MS,
        });
    },
    async onDisable() {
        await sellercloudPoller.disable();
    },
    async test(context) {
        const { items } = await buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue })({ since: new Date(Date.now() - TEST_LOOKBACK_MS), startPage: 1, seen: {} });
        return items.slice(0, 5).map((item) => ({ ...item.data, previous_physical_qty: null }));
    },
    async run(context) {
        const watchingWarehouseOnly = parseSkus({ value: context.propsValue.skus }).length === 0;
        const emissions = await sellercloudPoller.poll({
            store: context.store,
            fingerprint: fingerprint({ auth: context.auth, propsValue: context.propsValue }),
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue }),
            overlapMs: sellercloudPoller.OVERLAP_MS,
            // Watching a warehouse by "updated since", a product is often first seen when it
            // is already low; that is the event, so report it.
            emitUnseen: watchingWarehouseOnly,
            retentionMs: RETENTION_MS,
        });
        return emissions.map((emission) => ({
            ...emission.item,
            previous_physical_qty: context.propsValue.mode === 'CHANGED' && emission.previousState !== null ? Number(emission.previousState) : null,
        }));
    },
});

function buildFetch({ auth, store, propsValue }: BuildFetchParams): FetchItems<InventoryEvent> {
    const skus = parseSkus({ value: propsValue.skus });
    const mode = propsValue.mode === 'CHANGED' ? 'CHANGED' : 'LOW_STOCK';
    const threshold = propsValue.threshold ?? 0;
    const warehouseId = isNil(propsValue.warehouse) ? null : Number(propsValue.warehouse);
    if (skus.length > MAX_SKUS) {
        throw new Error(`SellerCloud: watch at most ${MAX_SKUS} SKUs per trigger (got ${skus.length}).`);
    }
    if (skus.length === 0 && (mode === 'CHANGED' || warehouseId === null)) {
        throw new Error('SellerCloud: list the SKUs to watch. Without SKUs this trigger can only watch a warehouse for low stock.');
    }
    const companies = sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds });
    const toItem = (record: InventoryRecord): PolledItem<InventoryEvent> => {
        const qty = (warehouseId === null ? record.PhysicalQty : record.WarehousePhysicalQty) ?? 0;
        const low = qty <= threshold;
        return {
            key: itemKey({ sku: record.ID, warehouseId }),
            state: mode === 'CHANGED' ? String(qty) : low ? 'low' : 'ok',
            eligible: mode === 'CHANGED' || low,
            eventTime: sellercloudPoller.toEventTime({ tenantLocal: record.LastModifiedDate }),
            data: toEvent({ record, qty, mode, threshold, warehouseId }),
        };
    };
    return async ({ since, startPage, seen }) => {
        const page = await sellercloudFeeds.inventory({
            auth: sellercloudAuthProps(auth),
            store,
            since,
            skus,
            warehouseId,
            companies,
            maxQty: skus.length === 0 ? threshold : null,
            maxPages: MAX_PAGES,
            startPage,
        });
        const lowItems = page.items.map(toItem);
        const recheck = skus.length === 0 && warehouseId !== null
            ? lowStock.skusToRecheck({ seen, returned: new Set(lowItems.map((item) => item.key)), warehouseId })
            : [];
        // The recovery re-read is best effort: failing it must not cost the low-stock results.
        const { data: rechecked, error: recheckError } = recheck.length === 0 ? { data: [], error: null } : await tryCatch(async () => (await sellercloudFeeds.inventoryBySku({
            auth: sellercloudAuthProps(auth),
            token: await sellercloudClient.getToken({ auth: sellercloudAuthProps(auth), store }),
            skus: recheck,
            warehouseId,
            companies,
        })).map(toItem));
        if (recheckError) {
            console.warn(`SellerCloud low stock: re-reading remembered low products failed (${recheckError.message}); retried next poll.`);
        }
        return { truncated: page.truncated, nextPage: page.nextPage, partialError: page.partialError, items: [...lowItems, ...(rechecked ?? [])] };
    };
}

function itemKey({ sku, warehouseId }: { sku: string; warehouseId: number | null }): string {
    return `${sku}|${warehouseId ?? 'all'}`;
}

function fingerprint({ auth, propsValue }: { auth: SellercloudAuthValue; propsValue: BuildFetchParams['propsValue'] }): string {
    return sellercloudPoller.fingerprintOf({
        trigger: 'inventory_changed',
        settings: {
            connection: sellercloudClient.connectionKey({ auth: sellercloudAuthProps(auth) }),
            mode: propsValue.mode === 'CHANGED' ? 'CHANGED' : 'LOW_STOCK',
            skus: parseSkus({ value: propsValue.skus }).sort(),
            warehouse: isNil(propsValue.warehouse) ? null : Number(propsValue.warehouse),
            threshold: propsValue.threshold ?? 0,
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds })?.sort() ?? null,
        },
    });
}

function toEvent({ record, qty, mode, threshold, warehouseId }: { record: InventoryRecord; qty: number; mode: 'CHANGED' | 'LOW_STOCK'; threshold: number; warehouseId: number | null }): InventoryEvent {
    return {
        event: mode === 'CHANGED' ? 'quantity_changed' : 'low_stock',
        sku: record.ID,
        product_name: record.ProductName ?? null,
        warehouse_id: warehouseId,
        warehouse_name: warehouseId === null ? null : record.WarehouseName ?? null,
        physical_qty: qty,
        available_qty: record.InventoryAvailableQty ?? null,
        threshold: mode === 'LOW_STOCK' ? threshold : null,
        company_id: record.CompanyID ?? null,
        company_name: record.CompanyName ?? null,
        brand: record.BrandName || null,
        last_modified: record.LastModifiedDate ?? null,
    };
}

function parseSkus({ value }: { value: unknown }): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return [...new Set(value.map((item) => String(item ?? '').trim()).filter((sku) => sku !== ''))];
}

const MAX_SKUS = 200;
const MAX_PAGES = 10;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TEST_LOOKBACK_MS = 24 * 60 * 60 * 1000;

type InventoryEvent = {
    event: 'quantity_changed' | 'low_stock';
    sku: string;
    product_name: string | null;
    warehouse_id: number | null;
    warehouse_name: string | null;
    physical_qty: number;
    available_qty: number | null;
    threshold: number | null;
    company_id: number | null;
    company_name: string | null;
    brand: string | null;
    last_modified: string | null;
};

type BuildFetchParams = {
    auth: SellercloudAuthValue;
    store: PollStore;
    propsValue: {
        mode?: string;
        skus?: unknown[];
        warehouse?: unknown;
        threshold?: number;
        companies?: unknown[];
        otherCompanyIds?: string;
    };
};
