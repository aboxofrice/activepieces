import { SellercloudAuthProps, TokenStore, sellercloudClient } from './client';
import { InventoryRow, JobResult, inventoryImport } from './inventory';
import { SetOutcome, inventorySetter } from './set-inventory';
import { WarehouseSnapshot } from './warehouse-snapshot';

async function runImport({ auth, token, store, warehouseId, rows, inventoryDate, waitForCompletion, timeoutSeconds, writeMode, adjustmentReason, verifyAfterWrite, trustLastWritten, zeroMissing, snapshot, shadowSuffix }: RunImportParams): Promise<ImportOutcome> {
    const warehouse = await findWarehouse({ auth, token, warehouseId });
    if (rows.length === 0) {
        return { warehouse, submitted: false, job: null };
    }
    // Only the delta path needs reads; both import modes are a single queued job.
    if (writeMode === 'SET_LISTED') {
        const set = await inventorySetter.setQuantities({
            auth,
            token,
            store,
            warehouseId,
            rows,
            reason: adjustmentReason ?? 'Inventory import',
            verify: verifyAfterWrite ?? true,
            useLedger: trustLastWritten ?? false,
            zeroMissing: zeroMissing ?? false,
            snapshot,
            shadowSuffix,
        });
        return { warehouse, submitted: true, job: null, set };
    }
    // A Full import replaces the warehouse; a Partial one adds to what is already there.
    const submitted = await inventoryImport.submitImport({
        auth, token, warehouse, rows, inventoryDate,
        updateType: writeMode === 'REPLACE_WAREHOUSE' ? 'FULL' : 'PARTIAL',
    });
    if (!waitForCompletion) {
        return { warehouse, submitted: true, job: { id: submitted.id, status: 'Submitted', message: submitted.message } };
    }
    const job = await inventoryImport.waitForJob({ auth, token, jobId: submitted.id, timeoutSeconds });
    if (job.finished && !job.succeeded && job.status !== 'PartialSuccess') {
        throw new Error(`SellerCloud import job ${job.id} ended as ${job.status}: ${job.errorMessage ?? job.errors.slice(0, 5).join('; ')}`);
    }
    return { warehouse, submitted: true, job };
}

async function findWarehouse({ auth, token, warehouseId }: { auth: SellercloudAuthProps; token: string; warehouseId: number }): Promise<{ ID: number; Name: string }> {
    const warehouses = await sellercloudClient.listWarehouses({ auth, token });
    const warehouse = warehouses.find((w) => w.ID === warehouseId);
    if (!warehouse) {
        throw new Error(`Warehouse ${warehouseId} not found. Available: ${warehouses.map((w) => `${w.ID} ${w.Name}`).join(', ')}`);
    }
    return { ID: warehouse.ID, Name: warehouse.Name };
}

export const importRunner = {
    runImport,
    findWarehouse,
};

export type ImportOutcome = {
    warehouse: { ID: number; Name: string };
    submitted: boolean;
    job: JobResult | { id: number; status: string; message: string | null } | null;
    set?: SetOutcome;
};

export type WriteMode = 'REPLACE_WAREHOUSE' | 'SET_LISTED' | 'ADD';

type RunImportParams = {
    snapshot?: WarehouseSnapshot;
    shadowSuffix?: string;
    auth: SellercloudAuthProps;
    token: string;
    store?: TokenStore;
    writeMode: WriteMode;
    adjustmentReason?: string;
    verifyAfterWrite?: boolean;
    trustLastWritten?: boolean;
    zeroMissing?: boolean;
    warehouseId: number;
    rows: InventoryRow[];
    inventoryDate: Date;
    waitForCompletion: boolean;
    timeoutSeconds: number;
};
