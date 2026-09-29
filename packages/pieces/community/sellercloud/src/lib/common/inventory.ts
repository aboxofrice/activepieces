import { HttpMethod } from '@activepieces/pieces-common';
import { SellercloudAuthProps, sellercloudClient } from './client';

async function submitImport({ auth, token, warehouse, rows, updateType, inventoryDate }: SubmitImportParams): Promise<SubmittedJob> {
    const csv = buildTemplateCsv({ warehouseName: warehouse.Name, rows, inventoryDate });
    const response = await sellercloudClient.request<{ ID: number; QueuedJobLink?: string; Message?: string }>({
        auth,
        token,
        method: HttpMethod.PUT,
        path: '/Inventory/ImportPhysicalInventory',
        body: {
            FileContent: Buffer.from(csv, 'utf8').toString('base64'),
            Format: CSV_FORMAT,
            WarehouseID: warehouse.ID,
            UpdateType: updateType === 'FULL' ? 1 : 0,
            InventoryDate: inventoryDate.toISOString(),
            MergeDefaultWarehouseInventoryIntoShadowParent: true,
            ...(auth.pinCode ? { PinCode: auth.pinCode } : {}),
        },
    });
    return { id: response.ID, link: response.QueuedJobLink ?? null, message: response.Message ?? null };
}

async function getJob({ auth, token, jobId }: { auth: SellercloudAuthProps; token?: string; jobId: number }): Promise<JobSummary> {
    const job = await sellercloudClient.request<QueuedJobDto>({
        auth,
        token,
        method: HttpMethod.GET,
        path: `/QueuedJobs/${jobId}`,
    });
    const status = statusName({ raw: job.Basic?.Status });
    return {
        id: jobId,
        status,
        finished: TERMINAL_STATUSES.includes(status),
        succeeded: status === 'Completed',
        errorMessage: job.Basic?.ErrorMessage || null,
        totalRecords: job.TotalRecords ?? null,
        totalProcessed: job.TotalProcessed ?? null,
        totalSucceeded: job.TotalSucceeded ?? null,
        totalFailed: job.TotalFailure ?? null,
        submittedOn: job.Basic?.SubmittedOn ?? null,
        completedOn: job.Basic?.CompletedOn ?? null,
    };
}

async function getJobErrors({ auth, token, jobId, limit }: { auth: SellercloudAuthProps; token?: string; jobId: number; limit: number }): Promise<string[]> {
    const logs = await sellercloudClient.request<{ Items: { Message: string; IsError: boolean }[] | null }>({
        auth,
        token,
        method: HttpMethod.GET,
        path: `/QueuedJobs/${jobId}/Logs`,
        queryParams: { 'model.isError': true, 'model.pageSize': limit, 'model.pageNumber': 1 },
    });
    return (logs.Items ?? []).map((log) => log.Message);
}

async function waitForJob({ auth, token, jobId, timeoutSeconds }: WaitParams): Promise<JobResult> {
    const deadline = Date.now() + timeoutSeconds * 1000;
    const poll = async (): Promise<JobSummary> => {
        const job = await getJob({ auth, token, jobId });
        if (job.finished || Date.now() + POLL_INTERVAL_MS > deadline) {
            return job;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        return poll();
    };
    const job = await poll();
    const errors = job.finished && !job.succeeded
        ? await getJobErrors({ auth, token, jobId, limit: 50 })
        : [];
    return { ...job, timedOut: !job.finished, errors };
}

function buildTemplateCsv({ warehouseName, rows, inventoryDate }: { warehouseName: string; rows: InventoryRow[]; inventoryDate: Date }): string {
    const date = formatTemplateDate({ date: inventoryDate });
    const lines = rows.map((row) => [row.productId, warehouseName, String(row.quantity), date, ''].map(csvCell).join(','));
    return [TEMPLATE_HEADER, ...lines].join('\r\n') + '\r\n';
}

function csvCell(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Matches the template SellerCloud hands out, e.g. "9/1/2026 10:45:20 PM".
function formatTemplateDate({ date }: { date: Date }): string {
    return date.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true }).replace(',', '');
}

function statusName({ raw }: { raw: number | string | undefined }): string {
    if (typeof raw === 'number') {
        return JOB_STATUSES[raw] ?? `Unknown(${raw})`;
    }
    return raw ?? 'Unknown';
}

const CSV_FORMAT = 1;
const POLL_INTERVAL_MS = 5000;
const TEMPLATE_HEADER = 'ProductID,Warehouse,PhysicalInventoryQty,InventoryDate,LocationNotes';
const JOB_STATUSES = [
    'Submitted', 'Processing', 'Completed', 'Failed', 'PartialSuccess', 'OnHold',
    'Cancelled', 'Cancelled_Service_Restarted', 'Aborted_Too_Much_Time_Consumed', 'Cancelled_While_Running',
];
const TERMINAL_STATUSES = ['Completed', 'Failed', 'PartialSuccess', 'Cancelled', 'Cancelled_Service_Restarted', 'Aborted_Too_Much_Time_Consumed', 'Cancelled_While_Running'];

export const inventoryImport = {
    submitImport,
    getJob,
    waitForJob,
    buildTemplateCsv,
};

export type InventoryRow = {
    productId: string;
    quantity: number;
};

export type UpdateType = 'PARTIAL' | 'FULL';

export type JobSummary = {
    id: number;
    status: string;
    finished: boolean;
    succeeded: boolean;
    errorMessage: string | null;
    totalRecords: number | null;
    totalProcessed: number | null;
    totalSucceeded: number | null;
    totalFailed: number | null;
    submittedOn: string | null;
    completedOn: string | null;
};

export type JobResult = JobSummary & {
    timedOut: boolean;
    errors: string[];
};

type SubmittedJob = {
    id: number;
    link: string | null;
    message: string | null;
};

type SubmitImportParams = {
    auth: SellercloudAuthProps;
    token?: string;
    warehouse: { ID: number; Name: string };
    rows: InventoryRow[];
    updateType: UpdateType;
    inventoryDate: Date;
};

type WaitParams = {
    auth: SellercloudAuthProps;
    token?: string;
    jobId: number;
    timeoutSeconds: number;
};

type QueuedJobDto = {
    Basic?: {
        Status?: number | string;
        ErrorMessage?: string | null;
        SubmittedOn?: string;
        CompletedOn?: string;
    };
    TotalRecords?: number;
    TotalProcessed?: number;
    TotalSucceeded?: number;
    TotalFailure?: number;
};
