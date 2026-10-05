import { HttpMethod } from '@activepieces/pieces-common';
import { isNil, tryCatch } from '@activepieces/shared';
import { SellercloudAuthProps, sellercloudClient, TokenStore } from './client';
import { InventoryRow } from './inventory';
import { quantityLedger } from './quantity-ledger';
import { WarehouseSnapshot } from './warehouse-snapshot';

// ImportPhysicalInventory ADDS to the existing quantity, so "set this warehouse to N"
// has to be expressed as a delta. AdjustPhysicalInventory takes one, and unlike
// SetPhysicalInventory it is not blocked for shadow SKUs.
async function setQuantities({ auth, token, store, warehouseId, rows, reason, verify, useLedger, zeroMissing, onProgress, snapshot, shadowSuffix }: SetQuantitiesParams): Promise<SetOutcome> {
    // A snapshot is a reading of SellerCloud's own state, so zeroing from it needs no
    // verification; the ledger is a record of intent and still does.
    if (((zeroMissing && isNil(snapshot)) || useLedger) && !verify) {
        throw new Error('Trusting or extending the last-written history requires "Verify After Writing": without it the history records intent rather than confirmed quantities.');
    }
    const targets = zeroMissing
        ? await withMissingZeroed({ store, warehouseId, rows, snapshot, shadowSuffix })
        : rows;
    const current = await currentQuantities({ auth, token, store, warehouseId, rows: targets, useLedger, snapshot });
    const planned = targets.map((row) => plan({ row, current: current.quantities.get(row.productId) }));

    const applied: AppliedAdjustment[] = [];
    for (const [index, item] of planned.entries()) {
        if (item.delta !== 0 && isNil(item.error)) {
            const { error } = await adjust({ auth, token, store, warehouseId, item, reason });
            applied.push({ ...item, error: error?.message ?? null });
        }
        else {
            applied.push({ ...item, error: item.error ?? null });
        }
        onProgress?.({ done: index + 1, total: planned.length });
    }

    const verified = verify
        ? await verifyQuantities({ auth, token, store, warehouseId, planned })
        : null;
    // The ledger is a claim about SellerCloud's state, so only verified quantities may
    // enter it. Recording intent instead let an adjustment that lagged or failed leave a
    // false baseline, and the next run then computed its delta from a number that was
    // never true. Without verification nothing is recorded at all.
    if (!isNil(store) && !isNil(verified)) {
        const unconfirmed = new Set(verified.mismatches.map((mismatch) => mismatch.productId));
        const confirmed = Object.fromEntries(
            applied
                .filter((item) => isNil(item.error) && !unconfirmed.has(item.productId))
                .map((item) => [item.productId, item.to] as const),
        );
        await quantityLedger.merge({ store, warehouseId, applied: confirmed });
        // A SKU that did not land must not keep a stale claim either.
        if (unconfirmed.size > 0) {
            await quantityLedger.forget({ store, warehouseId, productIds: [...unconfirmed] });
        }
    }
    return {
        warehouseId,
        source: current.source,
        requested: targets.length,
        zeroedMissing: targets.length - rows.length,
        changed: applied.filter((item) => item.delta !== 0 && isNil(item.error)).length,
        unchanged: applied.filter((item) => item.delta === 0).length,
        failed: applied.filter((item) => !isNil(item.error)).length,
        adjustments: applied,
        verified,
    };
}

// The snapshot already carries this warehouse's quantities, so when one was taken there is
// nothing left to read: it replaces a request per SKU (1,505 across the PDCs) with none.
// With the ledger, a SKU this integration has written before needs no read at all; the
// rest still do, so a first run or a newly added part stays correct.
// A part that drops out of the file has not gone to zero on its own: replacing the
// warehouse would zero it, but that import takes hours, so the ledger of what this flow
// wrote last time stands in for it and those products are set to 0 explicitly.
// With a snapshot, "missing" is every product actually holding stock in this warehouse that
// today's file does not mention — the same set a Full import would zero, but reached without
// making SellerCloud enumerate all 241,029 product/warehouse records (~2 hours). Without one
// it falls back to the ledger, which only knows what this integration wrote before.
async function withMissingZeroed({ store, warehouseId, rows, snapshot, shadowSuffix }: WithMissingZeroedParams): Promise<InventoryRow[]> {
    if (!isNil(snapshot)) {
        // A shadow and its parent are one holding, so a part listed under either spelling
        // counts as present; keying on the parent stops the file's shadow row from leaving
        // the parent to be zeroed.
        const holding = (productId: string) => holdingKey({ productId, shadowSuffix });
        const present = new Set(rows.map((row) => holding(row.productId)));
        const missing: InventoryRow[] = [];
        for (const [productId, quantity] of snapshot.quantities) {
            if (quantity !== 0 && !present.has(holding(productId))) {
                missing.push({ productId, quantity: 0 });
            }
        }
        return [...rows, ...missing];
    }
    if (isNil(store)) {
        return rows;
    }
    const ledger = await quantityLedger.read({ store, warehouseId });
    const present = new Set(rows.map((row) => row.productId));
    const missing = Object.keys(ledger)
        .filter((productId) => !present.has(productId) && ledger[productId] !== 0)
        .map((productId) => ({ productId, quantity: 0 }));
    return [...rows, ...missing];
}

function holdingKey({ productId, shadowSuffix }: { productId: string; shadowSuffix?: string }): string {
    const suffix = shadowSuffix?.trim();
    return !isNil(suffix) && suffix.length > 0 && productId.endsWith(suffix) && productId.length > suffix.length
        ? productId.slice(0, -suffix.length)
        : productId;
}

async function currentQuantities({ auth, token, store, warehouseId, rows, useLedger, snapshot }: CurrentQuantitiesParams): Promise<{ quantities: Map<string, number | null>; source: QuantitySource }> {
    if (!isNil(snapshot)) {
        const quantities = new Map<string, number | null>();
        for (const row of rows) {
            const quantity = snapshot.quantities.get(row.productId);
            quantities.set(row.productId, quantity ?? null);
        }
        return { quantities, source: 'snapshot' };
    }
    if (!useLedger || isNil(store)) {
        return { quantities: await readQuantities({ auth, token, store, warehouseId, productIds: rows.map((row) => row.productId) }), source: 'read' };
    }
    const ledger = await quantityLedger.read({ store, warehouseId });
    const missing = rows.filter((row) => isNil(ledger[row.productId])).map((row) => row.productId);
    const read = missing.length > 0
        ? await readQuantities({ auth, token, store, warehouseId, productIds: missing })
        : new Map<string, number | null>();
    const quantities = new Map<string, number | null>();
    for (const row of rows) {
        quantities.set(row.productId, read.has(row.productId) ? read.get(row.productId) ?? null : ledger[row.productId]);
    }
    return { quantities, source: missing.length === rows.length ? 'read' : 'ledger' };
}

function plan({ row, current }: { row: InventoryRow; current: number | null | undefined }): PlannedAdjustment {
    if (isNil(current)) {
        return { productId: row.productId, from: null, to: row.quantity, delta: 0, error: 'no inventory row in this warehouse' };
    }
    return { productId: row.productId, from: current, to: row.quantity, delta: row.quantity - current, error: null };
}

// A shadow SKU reports 0 on the bulk /Inventory listing but its parent's quantity here,
// and the parent's is the number an import actually moves, so read per product.
async function readQuantities({ auth, token, store, warehouseId, productIds }: ReadQuantitiesParams): Promise<Map<string, number | null>> {
    const entries = new Map<string, number | null>();
    for (const productId of productIds) {
        // SellerCloud answers 500 for an unknown productID, and one unreadable SKU must
        // not abandon a part-written batch: record it as unknown and carry on.
        const { data, error } = await tryCatch(() => readQuantity({ auth, token, store, warehouseId, productId }));
        entries.set(productId, error ? null : data);
    }
    return entries;
}

async function readQuantity({ auth, token, store, warehouseId, productId }: ReadQuantityParams): Promise<number | null> {
    const rows = await sellercloudClient.request<WarehouseQtyRow[] | { Items: WarehouseQtyRow[] | null }>({
        auth,
        token,
        store,
        method: HttpMethod.GET,
        path: '/Inventory/Warehouses',
        queryParams: { productID: productId, warehouseID: warehouseId },
    });
    const items = Array.isArray(rows) ? rows : rows.Items ?? [];
    const match = items.find((item) => item.WarehouseID === warehouseId);
    return match ? match.PhysicalQty : null;
}

async function adjust({ auth, token, store, warehouseId, item, reason }: AdjustParams): Promise<{ error: Error | null }> {
    try {
        await sellercloudClient.request({
            auth,
            token,
            store,
            method: HttpMethod.PUT,
            path: '/Inventory/AdjustPhysicalInventory',
            body: {
                WarehouseID: warehouseId,
                ProductID: item.productId,
                Qty: Math.abs(item.delta),
                AdjustmentType: item.delta > 0 ? ADJUSTMENT_ADD : ADJUSTMENT_SUBTRACT,
                Reason: reason,
                ...(auth.pinCode ? { PinCode: auth.pinCode } : {}),
            },
        });
        return { error: null };
    }
    catch (error) {
        return { error: error as Error };
    }
}

// Adjustments land ~30-60s later, so a read taken straight after a write returns the old
// value. Acting on one double-applies; wait for the number to stop moving instead.
async function verifyQuantities({ auth, token, store, warehouseId, planned }: VerifyParams): Promise<VerifyResult> {
    // A SKU whose delta was 0 was not written, so there is nothing to confirm; including
    // them made the first poll re-read the whole batch, which on a 466-SKU warehouse is
    // ~320 wasted calls against an hourly request budget.
    const expected = planned.filter((item) => isNil(item.error) && item.delta !== 0);
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    const observed = new Map<string, number | null>();
    // Re-reading every SKU each round is the bulk of a large batch's cost, so each round
    // only polls what has not landed yet.
    let outstanding = expected;

    // Only an exact match counts as settled. Two identical reads are NOT evidence of
    // completion: a pending adjustment reads as the old value for as long as a minute,
    // so "stopped changing" is indistinguishable from "has not started".
    while (outstanding.length > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, VERIFY_POLL_MS));
        const round = await readQuantities({ auth, token, store, warehouseId, productIds: outstanding.map((item) => item.productId) });
        for (const [productId, quantity] of round) {
            observed.set(productId, quantity);
        }
        outstanding = outstanding.filter((item) => round.get(item.productId) !== item.to);
    }

    const mismatches = outstanding.map((item) => ({
        productId: item.productId,
        expected: item.to,
        actual: observed.get(item.productId) ?? null,
    }));
    return { settled: outstanding.length === 0, timedOut: outstanding.length > 0, mismatches };
}

export const inventorySetter = { setQuantities, readQuantity };

const ADJUSTMENT_SUBTRACT = 0;
const ADJUSTMENT_ADD = 1;
const VERIFY_POLL_MS = 15000;
const VERIFY_TIMEOUT_MS = 300000;

export type PlannedAdjustment = {
    productId: string;
    from: number | null;
    to: number;
    delta: number;
    error: string | null;
};

export type AppliedAdjustment = PlannedAdjustment;

export type VerifyResult = {
    settled: boolean;
    timedOut: boolean;
    mismatches: { productId: string; expected: number; actual: number | null }[];
};

export type QuantitySource = 'read' | 'ledger' | 'snapshot';

export type SetOutcome = {
    warehouseId: number;
    source: QuantitySource;
    requested: number;
    zeroedMissing: number;
    changed: number;
    unchanged: number;
    failed: number;
    adjustments: AppliedAdjustment[];
    verified: VerifyResult | null;
};

type WarehouseQtyRow = { WarehouseID: number; PhysicalQty: number };

type SetQuantitiesParams = {
    auth: SellercloudAuthProps;
    token?: string;
    store?: TokenStore;
    warehouseId: number;
    rows: InventoryRow[];
    reason: string;
    verify: boolean;
    useLedger: boolean;
    zeroMissing: boolean;
    onProgress?: (progress: { done: number; total: number }) => void;
    snapshot?: WarehouseSnapshot;
    shadowSuffix?: string;
};

type WithMissingZeroedParams = {
    store?: TokenStore;
    warehouseId: number;
    rows: InventoryRow[];
    snapshot?: WarehouseSnapshot;
    shadowSuffix?: string;
};

type CurrentQuantitiesParams = Omit<SetQuantitiesParams, 'reason' | 'verify' | 'zeroMissing' | 'onProgress'>;

type ReadQuantitiesParams = Omit<SetQuantitiesParams, 'rows' | 'reason' | 'verify' | 'useLedger' | 'zeroMissing' | 'onProgress'> & { productIds: string[] };
type ReadQuantityParams = Omit<ReadQuantitiesParams, 'productIds'> & { productId: string };
type AdjustParams = Omit<SetQuantitiesParams, 'rows' | 'verify' | 'useLedger' | 'zeroMissing' | 'onProgress'> & { item: PlannedAdjustment };
type VerifyParams = Omit<SetQuantitiesParams, 'rows' | 'reason' | 'verify' | 'useLedger' | 'zeroMissing' | 'onProgress'> & { planned: PlannedAdjustment[] };
