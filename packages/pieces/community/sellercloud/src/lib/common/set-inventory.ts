import { HttpMethod } from '@activepieces/pieces-common';
import { isNil, tryCatch } from '@activepieces/shared';
import { SellercloudAuthProps, sellercloudClient, TokenStore } from './client';
import { InventoryRow } from './inventory';
import { quantityLedger } from './quantity-ledger';
import { WarehouseSnapshot } from './warehouse-snapshot';

// ImportPhysicalInventory ADDS to the existing quantity, so "set this warehouse to N"
// has to be expressed as a delta. AdjustPhysicalInventory takes one, and unlike
// SetPhysicalInventory it is not blocked for shadow SKUs.
async function setQuantities({ auth, token, store, warehouseId, rows, reason, verify, useLedger, zeroMissing, onProgress, snapshot, shadowSuffix, maxWrites, deadline }: SetQuantitiesParams): Promise<SetOutcome> {
    // A snapshot is a reading of SellerCloud's own state, so zeroing from it needs no
    // verification; the ledger is a record of intent and still does.
    if (((zeroMissing && isNil(snapshot)) || useLedger) && !verify) {
        throw new Error('Trusting or extending the last-written history requires "Verify After Writing": without it the history records intent rather than confirmed quantities.');
    }
    const chunking = !isNil(maxWrites) && maxWrites > 0;
    // Chunking has no checkpoint of its own: the next run recomputes the deltas from a
    // fresh snapshot, and what this run wrote is simply no longer a delta. That only holds
    // if the writes have landed before the next snapshot is taken, which is what the
    // verification poll waits for.
    if (chunking && !verify) {
        throw new Error('Limiting writes per run requires "Verify After Writing": the next run re-reads SellerCloud to find the remaining work, so this run\'s adjustments have to have landed first.');
    }
    if (chunking && isNil(snapshot)) {
        throw new Error('Limiting writes per run requires a warehouse snapshot: without one the remaining work cannot be recomputed on the next run.');
    }
    const targets = zeroMissing
        ? await withMissingZeroed({ store, warehouseId, rows, snapshot, shadowSuffix })
        : rows;
    const current = await currentQuantities({ auth, token, store, warehouseId, rows: targets, useLedger, snapshot });
    const planned = targets.map((row) => plan({ row, current: current.quantities.get(row.productId) }));
    const chunk = writeChunk({ planned, maxWrites });
    // Measured from the start of the run, not from here: fetching the ~350 MB template takes
    // SellerCloud up to ~200s before a single quantity is known, so a budget counted from the
    // first write overran AP_FLOW_TIMEOUT_SECONDS and the engine killed the run - losing the
    // report for adjustments that had already landed.
    const runDeadline = deadline ?? Date.now() + DEFAULT_RUN_BUDGET_MS;
    const writeDeadline = chunking ? runDeadline - VERIFY_RESERVE_MS : null;

    const applied: AppliedAdjustment[] = [];
    for (const [index, item] of planned.entries()) {
        // The engine kills a run at AP_FLOW_TIMEOUT_SECONDS, which would lose the report
        // for writes that did land, so stop starting new ones before that.
        const outOfTime = !isNil(writeDeadline) && Date.now() > writeDeadline;
        if (chunk.has(item.productId) && !outOfTime) {
            const { error } = await adjust({ auth, token, store, warehouseId, item, reason });
            applied.push({ ...item, error: error?.message ?? null, deferred: false });
        }
        else if (chunk.has(item.productId)) {
            chunk.delete(item.productId);
            applied.push({ ...item, error: null, deferred: true });
        }
        else {
            applied.push({ ...item, error: item.error ?? null, deferred: isNil(item.error) && item.delta !== 0 });
        }
        onProgress?.({ done: index + 1, total: planned.length });
    }

    // Only what this run actually submitted: a deferred adjustment has nothing to confirm,
    // and re-reading one costs a request against an hourly budget.
    const attempted = applied.filter((item) => chunk.has(item.productId));
    const verified = verify
        ? await verifyQuantities({ auth, token, store, warehouseId, expected: attempted, deadline: runDeadline })
        : null;
    // The ledger is a claim about SellerCloud's state, so only verified quantities may
    // enter it. Recording intent instead let an adjustment that lagged or failed leave a
    // false baseline, and the next run then computed its delta from a number that was
    // never true. Without verification nothing is recorded at all.
    if (!isNil(store) && !isNil(verified)) {
        const unconfirmed = new Set(verified.mismatches.map((mismatch) => mismatch.productId));
        const confirmed = Object.fromEntries(
            applied
                .filter((item) => isNil(item.error) && !item.deferred && !unconfirmed.has(item.productId))
                .map((item) => [item.productId, item.to] as const),
        );
        // The adjustments have already landed by now, so failing here would report a run that
        // changed SellerCloud as one that did not. Centerline's ~39k parts outgrew the store's
        // 512 KB per-key cap this way. A ledger that could not be updated is cleared instead,
        // so it cannot leave a stale baseline behind; runs with a snapshot do not need it.
        const { error: ledgerError } = await tryCatch(async () => {
            await quantityLedger.merge({ store, warehouseId, applied: confirmed });
            // A SKU that did not land must not keep a stale claim either.
            if (unconfirmed.size > 0) {
                await quantityLedger.forget({ store, warehouseId, productIds: [...unconfirmed] });
            }
        });
        if (!isNil(ledgerError)) {
            await tryCatch(() => quantityLedger.write({ store, warehouseId, quantities: {} }));
        }
    }
    const deferred = applied.filter((item) => item.deferred).length;
    return {
        warehouseId,
        source: current.source,
        requested: targets.length,
        zeroedMissing: targets.length - rows.length,
        changed: applied.filter((item) => item.delta !== 0 && isNil(item.error) && !item.deferred).length,
        unchanged: applied.filter((item) => item.delta === 0).length,
        failed: applied.filter((item) => !isNil(item.error)).length,
        deferred,
        // The caller re-runs until this is true. A failed write is not deferred work: the
        // next snapshot still shows the old quantity, so it reappears as a delta on its own.
        complete: deferred === 0,
        adjustments: applied,
        verified,
    };
}

// Which adjustments this run may send. Ordering by product id keeps the split stable, so
// a run that gets through only part of the work always resumes where the last one stopped
// instead of reshuffling what is left.
function writeChunk({ planned, maxWrites }: { planned: PlannedAdjustment[]; maxWrites?: number }): Set<string> {
    const writable = planned
        .filter((item) => isNil(item.error) && item.delta !== 0)
        .map((item) => item.productId)
        .sort((a, b) => a.localeCompare(b));
    const budget = isNil(maxWrites) || maxWrites <= 0 ? writable.length : maxWrites;
    return new Set(writable.slice(0, budget));
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
// A SKU whose delta was 0 was not written, and a deferred one was not either, so the
// caller passes only what it submitted: polling the whole batch made the first round
// re-read every row, which on a 466-SKU warehouse is ~320 wasted calls against an hourly
// request budget.
async function verifyQuantities({ auth, token, store, warehouseId, expected, deadline }: VerifyParams): Promise<VerifyResult> {
    // Whichever comes first: the usual settling allowance, or what is left of the run.
    const until = Math.min(Date.now() + VERIFY_TIMEOUT_MS, deadline ?? Number.MAX_SAFE_INTEGER);
    const observed = new Map<string, number | null>();
    const unreadableRounds = new Map<string, number>();
    // Re-reading every SKU each round is the bulk of a large batch's cost, so each round
    // only polls what has not landed yet.
    let outstanding = expected;
    const settled = new Set<string>();

    // Only an exact match counts as settled. Two identical reads are NOT evidence of
    // completion: a pending adjustment reads as the old value for as long as a minute,
    // so "stopped changing" is indistinguishable from "has not started".
    while (outstanding.length > 0 && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, VERIFY_POLL_MS));
        const round = await readQuantities({ auth, token, store, warehouseId, productIds: outstanding.map((item) => item.productId) });
        for (const [productId, quantity] of round) {
            observed.set(productId, quantity);
            unreadableRounds.set(productId, quantity === null ? (unreadableRounds.get(productId) ?? 0) + 1 : 0);
        }
        for (const item of outstanding) {
            if (round.get(item.productId) === item.to) {
                settled.add(item.productId);
            }
        }
        // A pending adjustment reads as the OLD value, never as null, so a SKU that keeps
        // coming back null is an error or a missing row and will not improve by asking again.
        // Re-reading it every 15s until the deadline is what turned Sherwood's 58 writes into
        // enough requests to lock the whole account out for an hour.
        outstanding = outstanding.filter((item) => !settled.has(item.productId)
            && (unreadableRounds.get(item.productId) ?? 0) < MAX_UNREADABLE_ROUNDS);
    }

    const mismatches = expected
        .filter((item) => !settled.has(item.productId))
        .map((item) => ({
            productId: item.productId,
            expected: item.to,
            actual: observed.get(item.productId) ?? null,
        }));
    return { settled: mismatches.length === 0, timedOut: outstanding.length > 0, mismatches };
}

// How many adjustments a delta would send, from the snapshot alone (no requests), so the
// caller can choose between adjustments and a full import before spending any budget.
async function countChanges({ store, warehouseId, rows, snapshot, shadowSuffix }: WithMissingZeroedParams & { snapshot: WarehouseSnapshot }): Promise<number> {
    const targets = await withMissingZeroed({ store, warehouseId, rows, snapshot, shadowSuffix });
    return targets.filter((row) => {
        const current = snapshot.quantities.get(row.productId);
        return !isNil(current) && current !== row.quantity;
    }).length;
}

export const inventorySetter = { setQuantities, readQuantity, countChanges };

const ADJUSTMENT_SUBTRACT = 0;
const ADJUSTMENT_ADD = 1;
const VERIFY_POLL_MS = 15000;
const VERIFY_TIMEOUT_MS = 300000;
const MAX_UNREADABLE_ROUNDS = 3;
// Held back from the run's budget so there is time to confirm the writes that were made.
const VERIFY_RESERVE_MS = 150000;
// Only used when the caller passes no deadline; a flow action always does.
const DEFAULT_RUN_BUDGET_MS = 540000;

export type PlannedAdjustment = {
    productId: string;
    from: number | null;
    to: number;
    delta: number;
    error: string | null;
};

// `deferred` is an adjustment this run chose not to send because it was over its write
// budget. It is not an error and not a no-op: the work is still outstanding.
export type AppliedAdjustment = PlannedAdjustment & { deferred: boolean };

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
    deferred: number;
    complete: boolean;
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
    maxWrites?: number;
    // When this run has to be finished, as an absolute timestamp.
    deadline?: number;
};

type WithMissingZeroedParams = {
    store?: TokenStore;
    warehouseId: number;
    rows: InventoryRow[];
    snapshot?: WarehouseSnapshot;
    shadowSuffix?: string;
};

type WriteParams = Omit<SetQuantitiesParams, 'rows' | 'reason' | 'verify' | 'useLedger' | 'zeroMissing' | 'onProgress' | 'maxWrites' | 'deadline'>;

type CurrentQuantitiesParams = Omit<SetQuantitiesParams, 'reason' | 'verify' | 'zeroMissing' | 'onProgress' | 'maxWrites' | 'deadline'>;

type ReadQuantitiesParams = WriteParams & { productIds: string[] };
type ReadQuantityParams = Omit<ReadQuantitiesParams, 'productIds'> & { productId: string };
type AdjustParams = WriteParams & { reason: string; item: PlannedAdjustment };
type VerifyParams = WriteParams & { expected: AppliedAdjustment[]; deadline?: number };
