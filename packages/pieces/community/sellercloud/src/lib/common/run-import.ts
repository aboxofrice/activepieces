import { isNil, tryCatch } from '@activepieces/shared';
import { SellercloudAuthProps, TokenStore, sellercloudClient } from './client';
import { InventoryRow, JobResult, inventoryImport } from './inventory';
import { SetOutcome, inventorySetter } from './set-inventory';
import { WarehouseSnapshot } from './warehouse-snapshot';

async function runImport({ auth, token, store, warehouseId, rows, inventoryDate, waitForCompletion, timeoutSeconds, writeMode, adjustmentReason, verifyAfterWrite, trustLastWritten, zeroMissing, snapshot, shadowSuffix, maxWritesPerRun, fullImportAbove, deadline }: RunImportParams): Promise<ImportOutcome> {
    const warehouse = await findWarehouse({ auth, token, warehouseId });
    if (rows.length === 0) {
        return { warehouse, submitted: false, job: null, complete: true, pendingJobId: null };
    }
    // A delta costs about two requests per changed part against an hourly budget, a full
    // import a handful regardless of size. On a day with a big swing the import is the
    // faster way to the same end state - which it only is when missing parts are zeroed too.
    const changes = writeMode === 'SET_LISTED' && !isNil(snapshot) && (fullImportAbove ?? 0) > 0 && (zeroMissing ?? false)
        ? await inventorySetter.countChanges({ store, warehouseId, rows, snapshot, shadowSuffix })
        : null;
    if (!isNil(changes) && changes > (fullImportAbove ?? 0)) {
        // SellerCloud allows one physical-inventory import in flight per account, and a full
        // import runs for hours. When another PDC already holds that slot, waiting is not an
        // option inside a 10-minute run (and the refusal names no job to wait on), so the delta
        // is written in chunks instead - slower, but it needs no slot and it makes progress.
        // Without this the second PDC to want an import failed outright and was retried into the
        // same refusal until the first job ended.
        const { data: submitted, error } = await tryCatch(() => inventoryImport.submitImport({ auth, token, warehouse, rows, inventoryDate, updateType: 'FULL', waitForSlotSeconds: 0 }));
        if (!isNil(submitted)) {
            // Hours of processing on SellerCloud's side: hand the job back to be polled rather than wait.
            return {
                warehouse, submitted: true, complete: false, pendingJobId: submitted.id, switchedToFullImport: { changes, threshold: fullImportAbove ?? 0 },
                job: { id: submitted.id, status: 'Submitted', message: submitted.message },
            };
        }
        if (!isNil(error) && !importSlotIsTaken({ error })) {
            throw error;
        }
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
            maxWrites: maxWritesPerRun,
            deadline,
        });
        return { warehouse, submitted: true, job: null, set, complete: set.complete, pendingJobId: null, ...(isNil(changes) ? {} : { changes }) };
    }
    // A Full import replaces the warehouse; a Partial one adds to what is already there.
    const submitted = await inventoryImport.submitImport({
        auth, token, warehouse, rows, inventoryDate,
        updateType: writeMode === 'REPLACE_WAREHOUSE' ? 'FULL' : 'PARTIAL',
    });
    // A full import runs for hours, far past AP_FLOW_TIMEOUT_SECONDS, so the caller submits
    // and exits. That is not a finished import: `complete` stays false and the job id comes
    // back so whoever runs this can poll it and only then treat the file as imported.
    if (!waitForCompletion) {
        return {
            warehouse, submitted: true, complete: false, pendingJobId: submitted.id,
            job: { id: submitted.id, status: 'Submitted', message: submitted.message },
        };
    }
    const job = await inventoryImport.waitForJob({ auth, token, jobId: submitted.id, timeoutSeconds });
    if (job.finished && !job.succeeded && job.status !== 'PartialSuccess') {
        throw new Error(`SellerCloud import job ${job.id} ended as ${job.status}: ${job.errorMessage ?? job.errors.slice(0, 5).join('; ')}`);
    }
    return { warehouse, submitted: true, job, complete: job.finished, pendingJobId: job.finished ? null : job.id };
}

async function findWarehouse({ auth, token, warehouseId }: { auth: SellercloudAuthProps; token: string; warehouseId: number }): Promise<{ ID: number; Name: string }> {
    const warehouses = await sellercloudClient.listWarehouses({ auth, token });
    const warehouse = warehouses.find((w) => w.ID === warehouseId);
    if (!warehouse) {
        throw new Error(`Warehouse ${warehouseId} not found. Available: ${warehouses.map((w) => `${w.ID} ${w.Name}`).join(', ')}`);
    }
    return { ID: warehouse.ID, Name: warehouse.Name };
}

function importSlotIsTaken({ error }: { error: Error }): boolean {
    return /not allowed to import physical inventory/i.test(error.message);
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
    // Set when a delta was large enough that one full import replaced it.
    switchedToFullImport?: { changes: number; threshold: number };
    changes?: number;
    // False means work is still outstanding — a queued import that has not finished, or
    // adjustments deferred past this run's write budget. Run it again.
    complete: boolean;
    pendingJobId: number | null;
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
    maxWritesPerRun?: number;
    fullImportAbove?: number;
    deadline?: number;
    warehouseId: number;
    rows: InventoryRow[];
    inventoryDate: Date;
    waitForCompletion: boolean;
    timeoutSeconds: number;
};
