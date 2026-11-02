import { HttpMethod } from '@activepieces/pieces-common';
import { WalmartAuthProps, walmartClient } from './client';
import { walmartJson } from './json';

const { stringAt, numberAt, arrayAt } = walmartJson;

async function submitFeed({ auth, feedType, payload, itemCount }: { auth: WalmartAuthProps; feedType: string; payload: unknown; itemCount: number }): Promise<SubmittedFeed> {
    const form = new FormData();
    form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }), `${feedType}.json`);
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.POST,
        path: '/v3/feeds',
        queryParams: { feedType },
        body: form,
    });
    const feedId = stringAt({ value: response, path: ['feedId'] });
    if (!feedId) {
        throw new Error(`Walmart accepted the feed but returned no feed id: ${JSON.stringify(response)}`);
    }
    return { feed_id: feedId, feed_type: feedType, item_count: itemCount };
}

async function getFeedStatus({ auth, feedId, includeDetails }: { auth: WalmartAuthProps; feedId: string; includeDetails: boolean }): Promise<FeedStatus> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        path: `/v3/feeds/${encodeURIComponent(feedId)}`,
        queryParams: { includeDetails: includeDetails ? 'true' : 'false', limit: includeDetails ? FEED_DETAIL_LIMIT : undefined },
    });
    return {
        feed_id: stringAt({ value: response, path: ['feedId'] }) ?? feedId,
        feed_status: stringAt({ value: response, path: ['feedStatus'] }) ?? '',
        feed_type: stringAt({ value: response, path: ['feedType'] }) ?? null,
        items_received: numberAt({ value: response, path: ['itemsReceived'] }) ?? 0,
        items_succeeded: numberAt({ value: response, path: ['itemsSucceeded'] }) ?? 0,
        items_failed: numberAt({ value: response, path: ['itemsFailed'] }) ?? 0,
        items_processing: numberAt({ value: response, path: ['itemsProcessing'] }) ?? 0,
        items: arrayAt({ value: response, path: ['itemDetails', 'itemIngestionStatus'] }).map((item) => ({
            sku: stringAt({ value: item, path: ['sku'] }) ?? '',
            status: stringAt({ value: item, path: ['ingestionStatus'] }) ?? '',
            errors: arrayAt({ value: item, path: ['ingestionErrors', 'ingestionError'] })
                .map((error) => [stringAt({ value: error, path: ['code'] }), stringAt({ value: error, path: ['description'] })].filter(Boolean).join(': '))
                .join('; '),
        })),
        raw: walmartClient.isRecord(response) ? response : {},
    };
}

const FEED_DETAIL_LIMIT = 1000;

export const walmartFeeds = {
    submitFeed,
    getFeedStatus,
};

export type SubmittedFeed = { feed_id: string; feed_type: string; item_count: number };

export type FeedStatus = {
    feed_id: string;
    feed_status: string;
    feed_type: string | null;
    items_received: number;
    items_succeeded: number;
    items_failed: number;
    items_processing: number;
    items: { sku: string; status: string; errors: string }[];
    raw: Record<string, unknown>;
};
