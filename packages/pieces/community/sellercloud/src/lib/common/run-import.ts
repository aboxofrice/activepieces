import { SellercloudAuthProps, sellercloudClient } from './client';
import { InventoryRow, JobResult, UpdateType, inventoryImport } from './inventory';

async function runImport({ auth, token, warehouseId, rows, updateType, inventoryDate, waitForCompletion, timeoutSeconds }: RunImportParams): Promise<ImportOutcome> {
    const warehouse = await findWarehouse({ auth, token, warehouseId });
    if (rows.length === 0) {
        return { warehouse, submitted: false, job: null };
    }
    const submitted = await inventoryImport.submitImport({ auth, token, warehouse, rows, updateType, inventoryDate });
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
};

type RunImportParams = {
    auth: SellercloudAuthProps;
    token: string;
    warehouseId: number;
    rows: InventoryRow[];
    updateType: UpdateType;
    inventoryDate: Date;
    waitForCompletion: boolean;
    timeoutSeconds: number;
};
