import { HttpMethod } from '@activepieces/pieces-common';
import { WalmartAuthProps, walmartClient } from './client';
import { walmartJson } from './json';

const { stringAt } = walmartJson;

// On-demand reports are generated asynchronously: request, poll the status until READY,
// then fetch a short-lived download URL.
async function requestReport({ auth, reportType, reportVersion }: { auth: WalmartAuthProps; reportType: string; reportVersion: string }): Promise<ReportRequest> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.POST,
        path: '/v3/reports/reportRequests',
        queryParams: { reportType, reportVersion },
        body: {},
    });
    return toReportRequest({ response, fallbackType: reportType });
}

async function getReportStatus({ auth, requestId }: { auth: WalmartAuthProps; requestId: string }): Promise<ReportRequest & { download_url: string | null; download_url_expires_at: string | null }> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        path: `/v3/reports/reportRequests/${encodeURIComponent(requestId)}`,
    });
    const status = toReportRequest({ response, fallbackType: '' });
    if (status.status !== 'READY') {
        return { ...status, download_url: null, download_url_expires_at: null };
    }
    const download = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        path: '/v3/reports/downloadReport',
        queryParams: { requestId },
    });
    return {
        ...status,
        download_url: stringAt({ value: download, path: ['downloadURL'] }) ?? null,
        download_url_expires_at: stringAt({ value: download, path: ['downloadURLExpirationTime'] }) ?? null,
    };
}

function toReportRequest({ response, fallbackType }: { response: unknown; fallbackType: string }): ReportRequest {
    return {
        request_id: stringAt({ value: response, path: ['requestId'] }) ?? '',
        report_type: stringAt({ value: response, path: ['reportType'] }) ?? fallbackType,
        report_version: stringAt({ value: response, path: ['reportVersion'] }) ?? null,
        status: stringAt({ value: response, path: ['requestStatus'] }) ?? stringAt({ value: response, path: ['status'] }) ?? '',
        requested_at: stringAt({ value: response, path: ['requestSubmissionDate'] }) ?? null,
    };
}

export const walmartReports = {
    requestReport,
    getReportStatus,
};

export type ReportRequest = {
    request_id: string;
    report_type: string;
    report_version: string | null;
    status: string;
    requested_at: string | null;
};
