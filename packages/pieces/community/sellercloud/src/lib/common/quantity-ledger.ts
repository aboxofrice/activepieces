import { isNil, tryCatch } from '@activepieces/shared';

// Reading a shadow SKU's warehouse quantity costs one request each, and no bulk endpoint
// exposes it, so a 466-SKU warehouse costs ~466 reads per run. When this integration is
// the only writer to a warehouse, the quantity it last wrote is already known, and the
// delta can be computed from that instead. The ledger is per warehouse so two PDCs never
// read each other's numbers.
async function read({ store, warehouseId }: LedgerRef): Promise<Record<string, number>> {
    const { data } = await tryCatch(() => store.get<Record<string, number>>(key({ warehouseId })));
    return isNil(data) ? {} : data;
}

async function write({ store, warehouseId, quantities }: LedgerRef & { quantities: Record<string, number> }): Promise<void> {
    await store.put(key({ warehouseId }), quantities);
}

// Only the SKUs just written are updated: a SKU missing from this run keeps whatever the
// previous run recorded, so dropping out of one file does not erase its history.
async function merge({ store, warehouseId, applied }: LedgerRef & { applied: Record<string, number> }): Promise<Record<string, number>> {
    const existing = await read({ store, warehouseId });
    const merged = { ...existing, ...applied };
    await write({ store, warehouseId, quantities: merged });
    return merged;
}

async function forget({ store, warehouseId, productIds }: LedgerRef & { productIds: string[] }): Promise<void> {
    const existing = await read({ store, warehouseId });
    const remaining = Object.fromEntries(Object.entries(existing).filter(([productId]) => !productIds.includes(productId)));
    await write({ store, warehouseId, quantities: remaining });
}

function key({ warehouseId }: { warehouseId: number }): string {
    return `${LEDGER_PREFIX}${warehouseId}`;
}

export const quantityLedger = { read, write, merge, forget };

const LEDGER_PREFIX = 'sellercloud_last_written_wh';

type LedgerRef = {
    store: LedgerStore;
    warehouseId: number;
};

export type LedgerStore = {
    get: <T>(key: string) => Promise<T | null>;
    put: (key: string, value: unknown) => Promise<unknown>;
};
