import { gunzipSync } from 'zlib';
import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { AmazonSellerAuthProps, spApiClient } from './client';
import { REQUEST_TIMEOUT_MS } from './retry';

async function submitFeed({ auth, feedType, marketplaceId, content, contentType }: SubmitFeedParams): Promise<string> {
    const document = await spApiClient.request<{ feedDocumentId: string; url: string }>({
        auth,
        method: HttpMethod.POST,
        path: '/feeds/2021-06-30/documents',
        body: { contentType },
    });
    // The upload URL is pre-signed for this exact Content-Type; any other value is rejected by S3.
    await httpClient.sendRequest({
        method: HttpMethod.PUT,
        url: document.url,
        headers: { 'Content-Type': contentType },
        body: content,
        timeout: REQUEST_TIMEOUT_MS,
    });
    const feed = await spApiClient.request<{ feedId: string }>({
        auth,
        method: HttpMethod.POST,
        path: '/feeds/2021-06-30/feeds',
        body: { feedType, marketplaceIds: [marketplaceId], inputFeedDocumentId: document.feedDocumentId },
    });
    return feed.feedId;
}

async function getFeed({ auth, feedId, includeResult }: { auth: AmazonSellerAuthProps; feedId: string; includeResult: boolean }): Promise<FeedStatus> {
    const feed = await spApiClient.request<SpApiFeed>({
        auth,
        method: HttpMethod.GET,
        path: `/feeds/2021-06-30/feeds/${encodeURIComponent(feedId.trim())}`,
    });
    const status: FeedStatus = {
        feed_id: feed.feedId,
        feed_type: feed.feedType,
        processing_status: feed.processingStatus,
        created_time: feed.createdTime ?? null,
        processing_end_time: feed.processingEndTime ?? null,
        result_document_id: feed.resultFeedDocumentId ?? null,
        result: null,
    };
    if (!includeResult || !feed.resultFeedDocumentId) {
        return status;
    }
    const document = await spApiClient.request<DocumentLink>({
        auth,
        method: HttpMethod.GET,
        path: `/feeds/2021-06-30/documents/${encodeURIComponent(feed.resultFeedDocumentId)}`,
    });
    return { ...status, result: await download({ document }) };
}

async function createReport({ auth, reportType, marketplaceId, dataStartTime, dataEndTime }: CreateReportParams): Promise<string> {
    const response = await spApiClient.request<{ reportId: string }>({
        auth,
        method: HttpMethod.POST,
        path: '/reports/2021-06-30/reports',
        body: { reportType, marketplaceIds: [marketplaceId], dataStartTime, dataEndTime },
    });
    return response.reportId;
}

// Reports are generated asynchronously; most small ones finish within a minute or two.
async function waitForReport({ auth, reportId, timeoutMs }: { auth: AmazonSellerAuthProps; reportId: string; timeoutMs: number }): Promise<SpApiReport> {
    const deadline = Date.now() + timeoutMs;
    const poll = async (): Promise<SpApiReport> => {
        const report = await spApiClient.request<SpApiReport>({
            auth,
            method: HttpMethod.GET,
            path: `/reports/2021-06-30/reports/${encodeURIComponent(reportId)}`,
        });
        if (TERMINAL_REPORT_STATUSES.includes(report.processingStatus)) {
            return report;
        }
        if (Date.now() + REPORT_POLL_MS > deadline) {
            throw new Error(`Report ${reportId} is still ${report.processingStatus} after ${Math.round(timeoutMs / 1000)}s. Run again later with this report ID.`);
        }
        await new Promise((resolve) => setTimeout(resolve, REPORT_POLL_MS));
        return poll();
    };
    return poll();
}

async function downloadReport({ auth, reportDocumentId }: { auth: AmazonSellerAuthProps; reportDocumentId: string }): Promise<string> {
    const document = await spApiClient.request<DocumentLink>({
        auth,
        method: HttpMethod.GET,
        path: `/reports/2021-06-30/documents/${encodeURIComponent(reportDocumentId)}`,
    });
    return download({ document });
}

async function download({ document }: { document: DocumentLink }): Promise<string> {
    const response = await httpClient.sendRequest<ArrayBuffer>({ method: HttpMethod.GET, url: document.url, responseType: 'arraybuffer', timeout: REQUEST_TIMEOUT_MS });
    const bytes = Buffer.from(response.body);
    return (document.compressionAlgorithm === 'GZIP' ? gunzipSync(bytes) : bytes).toString('utf8');
}

// Amazon's flat-file reports are tab-separated with a header row.
function parseTsv({ text }: { text: string }): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
        return [];
    }
    const headers = lines[0].split('\t').map((header) => header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    return lines.slice(1).map((line) => {
        const cells = line.split('\t');
        return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? '').trim()]));
    });
}

function escapeXml({ value }: { value: string }): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const TERMINAL_REPORT_STATUSES = ['DONE', 'CANCELLED', 'FATAL'];
const REPORT_POLL_MS = 15000;

export const spApiDocuments = { submitFeed, getFeed, createReport, waitForReport, downloadReport, parseTsv, escapeXml };

export type FeedStatus = {
    feed_id: string;
    feed_type: string;
    processing_status: string;
    created_time: string | null;
    processing_end_time: string | null;
    result_document_id: string | null;
    result: string | null;
};

export type SpApiReport = {
    reportId: string;
    reportType: string;
    processingStatus: string;
    reportDocumentId?: string;
    dataStartTime?: string;
    dataEndTime?: string;
};

type SpApiFeed = {
    feedId: string;
    feedType: string;
    processingStatus: string;
    createdTime?: string;
    processingEndTime?: string;
    resultFeedDocumentId?: string;
};

type DocumentLink = { url: string; compressionAlgorithm?: string };

type SubmitFeedParams = {
    auth: AmazonSellerAuthProps;
    feedType: string;
    marketplaceId: string;
    content: string;
    contentType: string;
};

type CreateReportParams = {
    auth: AmazonSellerAuthProps;
    reportType: string;
    marketplaceId: string;
    dataStartTime?: string;
    dataEndTime?: string;
};
