import { createTrigger, Property, TriggerStrategy } from '@activepieces/pieces-framework';
import { sellercloudAuth, sellercloudAuthProps, SellercloudAuthValue } from '../auth';
import { sellercloudClient } from '../common/client';
import { sellercloudDropdowns } from '../common/dropdowns';
import { sellercloudEnums } from '../common/enums';
import { FetchItems, PollStore, sellercloudPoller } from '../common/poller';
import { FlatOrder, sellercloudRecords } from '../common/records';
import { sellercloudSamples } from '../common/sample-data';
import { sellercloudFeeds } from '../common/trigger-feeds';

export const orderStatusChanged = createTrigger({
    auth: sellercloudAuth,
    name: 'order_status_changed',
    displayName: 'Order Status Changed',
    description: 'Triggers when a sales order moves to a different status (for example In Process → Completed).',
    props: {
        info: Property.MarkDown({
            value: 'Watches orders updated since the last check. An order\'s status is remembered the first time the trigger sees it (on enable, the orders updated in the last 2 days are recorded), and a change is reported from then on. Changes are remembered for 30 days.',
        }),
        targetStatuses: sellercloudDropdowns.orderStatuses({
            displayName: 'Only When New Status Is',
            description: 'Only trigger when the order changes into one of these statuses. Leave empty for any change.',
        }),
        channels: sellercloudDropdowns.channels({}),
        companies: sellercloudDropdowns.companies({ required: false }),
        otherCompanyIds: sellercloudDropdowns.otherCompanyIds,
    },
    sampleData: { ...sellercloudSamples.order, status_code: 3, status: 'Completed', previous_status_code: 2, previous_status: 'In Process' },
    type: TriggerStrategy.POLLING,
    async onEnable(context) {
        await sellercloudPoller.enable({
            store: context.store,
            fingerprint: fingerprint({ auth: context.auth, propsValue: context.propsValue }),
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue, maxPages: MAX_PAGES }),
            retentionMs: RETENTION_MS,
            sinceMs: Date.now() - BASELINE_LOOKBACK_MS,
        });
    },
    async onDisable() {
        await sellercloudPoller.disable();
    },
    async test(context) {
        const fetchItems = buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue, maxPages: 1 });
        const { items } = await fetchItems({ since: new Date(Date.now() - TEST_LOOKBACK_MS), startPage: 1, seen: {} });
        return items.filter((item) => item.eligible).slice(0, 5).map((item) => withPrevious({ order: item.data, previousState: null }));
    },
    async run(context) {
        const emissions = await sellercloudPoller.poll({
            store: context.store,
            fingerprint: fingerprint({ auth: context.auth, propsValue: context.propsValue }),
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue, maxPages: MAX_PAGES }),
            emitUnseen: false,
            retentionMs: RETENTION_MS,
            overlapMs: sellercloudPoller.OVERLAP_MS,
        });
        return emissions.map((emission) => withPrevious({ order: emission.item, previousState: emission.previousState }));
    },
});

function withPrevious({ order, previousState }: { order: FlatOrder; previousState: string | null }): FlatOrder & { previous_status_code: number | null; previous_status: string | null } {
    const previousCode = previousState === null ? null : Number(previousState);
    return {
        ...order,
        previous_status_code: previousCode,
        previous_status: sellercloudEnums.label({ map: sellercloudEnums.ORDER_STATUSES, code: previousCode }),
    };
}

function buildFetch({ auth, store, propsValue, maxPages }: BuildFetchParams): FetchItems<FlatOrder> {
    const targets = new Set((propsValue.targetStatuses ?? []).map(Number));
    return async ({ since, startPage }) => {
        const page = await sellercloudFeeds.orders({
            auth: sellercloudAuthProps(auth),
            store,
            since,
            dateField: 'updated',
            channels: (propsValue.channels ?? []).map(Number),
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds }),
            maxPages,
            startPage,
        });
        return {
            truncated: page.truncated,
            nextPage: page.nextPage,
            partialError: page.partialError,
            items: page.items.map((order) => ({
                key: String(order.ID),
                state: String(order.StatusCode),
                eligible: targets.size === 0 || targets.has(Number(order.StatusCode)),
                eventTime: sellercloudPoller.toEventTime({ tenantLocal: order.LastUpdated }),
                data: sellercloudRecords.flattenOrder({ order }),
            })),
        };
    };
}

// The target statuses only decide what is reported, not what is remembered, so they are
// left out: changing them keeps the remembered statuses.
function fingerprint({ auth, propsValue }: { auth: SellercloudAuthValue; propsValue: BuildFetchParams['propsValue'] }): string {
    return sellercloudPoller.fingerprintOf({
        trigger: 'order_status_changed',
        settings: {
            connection: sellercloudClient.connectionKey({ auth: sellercloudAuthProps(auth) }),
            channels: (propsValue.channels ?? []).map(Number).sort(),
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds })?.sort() ?? null,
        },
    });
}

// Updated-since results are ordered by order ID, not by update time, so the whole window
// has to be read; this bounds one poll, and a busier window is finished by the next polls.
const MAX_PAGES = 30;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const BASELINE_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000;
const TEST_LOOKBACK_MS = 24 * 60 * 60 * 1000;

type BuildFetchParams = {
    auth: SellercloudAuthValue;
    store: PollStore;
    propsValue: {
        targetStatuses?: unknown[];
        channels?: unknown[];
        companies?: unknown[];
        otherCompanyIds?: string;
    };
    maxPages: number;
};
