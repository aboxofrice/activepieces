import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
import { sellercloudAuth, sellercloudAuthProps, SellercloudAuthValue } from '../auth';
import { sellercloudDropdowns } from '../common/dropdowns';
import { FetchItems, PollStore, sellercloudPoller } from '../common/poller';
import { FlatOrder, sellercloudRecords } from '../common/records';
import { sellercloudSamples } from '../common/sample-data';
import { sellercloudFeeds } from '../common/trigger-feeds';

export const newOrder = createTrigger({
    auth: sellercloudAuth,
    name: 'new_order',
    displayName: 'New Order',
    description: 'Triggers when a new sales order is created in SellerCloud (checked every few minutes).',
    props: {
        channels: sellercloudDropdowns.channels({}),
        companies: sellercloudDropdowns.companies({ required: false }),
        otherCompanyIds: sellercloudDropdowns.otherCompanyIds,
        excludeStatuses: sellercloudDropdowns.orderStatuses({
            displayName: 'Skip Orders With Status',
            description: 'Orders in these statuses when first seen are skipped (and never reported later).',
            defaultValue: [-1, 999],
        }),
    },
    sampleData: sellercloudSamples.order,
    type: TriggerStrategy.POLLING,
    async onEnable(context) {
        await sellercloudPoller.baseline({
            store: context.store,
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue, maxPages: MAX_PAGES }),
            retentionMs: RETENTION_MS,
            sinceMs: Date.now() - sellercloudPoller.OVERLAP_MS,
        });
    },
    async onDisable(context) {
        await sellercloudPoller.clear({ store: context.store });
    },
    async test(context) {
        const fetchItems = buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue, maxPages: 1 });
        const items = await fetchItems({ since: new Date(Date.now() - TEST_LOOKBACK_MS) });
        return items.filter((item) => item.eligible).slice(0, 5).map((item) => item.data);
    },
    async run(context) {
        const emissions = await sellercloudPoller.poll({
            store: context.store,
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue, maxPages: MAX_PAGES }),
            emitUnseen: true,
            retentionMs: RETENTION_MS,
        });
        return emissions.map((emission) => emission.item);
    },
});

function buildFetch({ auth, store, propsValue, maxPages }: BuildFetchParams): FetchItems<FlatOrder> {
    const excluded = new Set((propsValue.excludeStatuses ?? []).map(Number));
    return async ({ since }) => {
        const orders = await sellercloudFeeds.orders({
            auth: sellercloudAuthProps(auth),
            store,
            since,
            dateField: 'created',
            channels: (propsValue.channels ?? []).map(Number),
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds }),
            maxPages,
        });
        return orders.map((order) => ({
            key: String(order.ID),
            state: 'seen',
            eligible: !excluded.has(Number(order.StatusCode)),
            data: sellercloudRecords.flattenOrder({ order }),
        }));
    };
}

const MAX_PAGES = 20;
const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const TEST_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

type BuildFetchParams = {
    auth: SellercloudAuthValue;
    store: PollStore;
    propsValue: {
        channels?: unknown[];
        companies?: unknown[];
        otherCompanyIds?: string;
        excludeStatuses?: unknown[];
    };
    maxPages: number;
};
