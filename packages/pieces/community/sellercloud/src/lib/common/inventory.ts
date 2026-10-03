import { HttpError, HttpMethod } from '@activepieces/pieces-common';
import { isNil, tryCatch } from '@activepieces/shared';
import { SellercloudAuthProps, sellercloudClient } from './client';

// SellerCloud permits one physical-inventory import in flight per account and answers
// 500 "You are not allowed to import physical inventory because N jobs are already
// submitted" otherwise. Several PDC warehouses therefore cannot import in parallel; wait
// for the slot instead of failing the run.
async function submitImport({ auth, token, warehouse, rows, updateType, inventoryDate, waitForSlotSeconds }: SubmitImportParams): Promise<SubmittedJob> {
    const deadline = Date.now() + (waitForSlotSeconds ?? DEFAULT_SLOT_WAIT_S) * 1000;
    for (;;) {
        const { data, error } = await tryCatch(() => submitOnce({ auth, token, warehouse, rows, updateType, inventoryDate }));
        if (!error) {
            return data;
        }
        const blockingJob = blockedByJob({ error });
        if (isNil(blockingJob) || Date.now() > deadline) {
            throw error;
        }
        await waitForJob({ auth, token, jobId: blockingJob, timeoutSeconds: Math.max(1, Math.round((deadline - Date.now()) / 1000)) });
    }
}

function blockedByJob({ error }: { error: Error }): number | null {
    const body = error instanceof HttpError ? String(error.response.body ?? '') : '';
    const match = /already submitted[\s\S]*?(\d+)/.exec(body);
    return match ? Number(match[1]) : null;
}

async function submitOnce({ auth, token, warehouse, rows, updateType, inventoryDate }: SubmitOnceParams): Promise<SubmittedJob> {
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
            InventoryDate: localIsoDate({ date: inventoryDate }),
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
    return date.toLocaleString('en-US', { timeZone: TENANT_TIME_ZONE, hour12: true }).replace(',', '');
}

// SellerCloud reads InventoryDate as tenant-local time and rejects anything ahead of
// "now" with 500 "Future date is not allowed.", so sending a UTC instant fails for any
// tenant behind UTC. Send wall-clock time in the tenant's zone, unsuffixed.
function localIsoDate({ date }: { date: Date }): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TENANT_TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

function statusName({ raw }: { raw: number | string | undefined }): string {
    if (typeof raw === 'number') {
        return JOB_STATUSES[raw] ?? `Unknown(${raw})`;
    }
    return raw ?? 'Unknown';
}

const TENANT_TIME_ZONE = 'America/New_York';
const CSV_FORMAT = 1;
const DEFAULT_SLOT_WAIT_S = 1800;
const POLL_INTERVAL_MS = 5000;
const TEMPLATE_HEADER = 'ProductID,Warehouse,PhysicalInventoryQty,InventoryDate,LocationNotes';
// The documented enum has no 2, so a dense array silently reads Completed (3) as Failed.
const JOB_STATUSES: Record<number, string> = {
    0: 'Submitted',
    1: 'Processing',
    3: 'Completed',
    4: 'Failed',
    5: 'PartialSuccess',
    6: 'OnHold',
    7: 'Cancelled',
    8: 'Cancelled_Service_Restarted',
    9: 'Aborted_Too_Much_Time_Consumed',
    10: 'Cancelled_While_Running',
};
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

type SubmitOnceParams = {
    auth: SellercloudAuthProps;
    token?: string;
    warehouse: { ID: number; Name: string };
    rows: InventoryRow[];
    updateType: UpdateType;
    inventoryDate: Date;
};

type SubmitImportParams = SubmitOnceParams & { waitForSlotSeconds?: number };

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
