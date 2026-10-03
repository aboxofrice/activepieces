import { HttpMethod } from '@activepieces/pieces-common';
import { isNil, tryCatch } from '@activepieces/shared';
import { SellercloudAuthProps, sellercloudClient, TokenStore } from './client';
import { InventoryRow } from './inventory';

// ImportPhysicalInventory ADDS to the existing quantity, so "set this warehouse to N"
// has to be expressed as a delta. AdjustPhysicalInventory takes one, and unlike
// SetPhysicalInventory it is not blocked for shadow SKUs.
async function setQuantities({ auth, token, store, warehouseId, rows, reason, verify, onProgress }: SetQuantitiesParams): Promise<SetOutcome> {
    const current = await readQuantities({ auth, token, store, warehouseId, productIds: rows.map((row) => row.productId) });
    const planned = rows.map((row) => plan({ row, current: current.get(row.productId) }));

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
    return {
        warehouseId,
        requested: rows.length,
        changed: applied.filter((item) => item.delta !== 0 && isNil(item.error)).length,
        unchanged: applied.filter((item) => item.delta === 0).length,
        failed: applied.filter((item) => !isNil(item.error)).length,
        adjustments: applied,
        verified,
    };
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
    const expected = planned.filter((item) => isNil(item.error));
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

export type SetOutcome = {
    warehouseId: number;
    requested: number;
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
    onProgress?: (progress: { done: number; total: number }) => void;
};

type ReadQuantitiesParams = Omit<SetQuantitiesParams, 'rows' | 'reason' | 'verify' | 'onProgress'> & { productIds: string[] };
type ReadQuantityParams = Omit<ReadQuantitiesParams, 'productIds'> & { productId: string };
type AdjustParams = Omit<SetQuantitiesParams, 'rows' | 'verify' | 'onProgress'> & { item: PlannedAdjustment };
type VerifyParams = Omit<SetQuantitiesParams, 'rows' | 'reason' | 'verify' | 'onProgress'> & { planned: PlannedAdjustment[] };
