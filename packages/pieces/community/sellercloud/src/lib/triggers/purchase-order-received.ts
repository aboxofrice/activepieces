import { createTrigger, Property, TriggerStrategy } from '@activepieces/pieces-framework';
import { sellercloudAuth, sellercloudAuthProps, SellercloudAuthValue } from '../auth';
import { sellercloudDropdowns } from '../common/dropdowns';
import { FetchItems, PollStore, sellercloudPoller } from '../common/poller';
import { sellercloudRecords } from '../common/records';
import { sellercloudSamples } from '../common/sample-data';
import { sellercloudFeeds } from '../common/trigger-feeds';

export const purchaseOrderReceived = createTrigger({
    auth: sellercloudAuth,
    name: 'purchase_order_received',
    displayName: 'Purchase Order Received',
    description: 'Triggers when a purchase order is received into a warehouse.',
    props: {
        includePartial: Property.Checkbox({
            displayName: 'Include Partial Receipts',
            description: 'Also trigger when a PO is partially received. A PO received in several steps then triggers once when partial and again when fully received.',
            required: false,
            defaultValue: false,
        }),
        warehouses: sellercloudDropdowns.warehouses({ required: false, description: 'Only include POs received into these warehouses. Leave empty for all.' }),
        companies: sellercloudDropdowns.companies({ required: false }),
        otherCompanyIds: sellercloudDropdowns.otherCompanyIds,
    },
    sampleData: sellercloudSamples.purchaseOrder,
    type: TriggerStrategy.POLLING,
    async onEnable(context) {
        await sellercloudPoller.baseline({
            store: context.store,
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue }),
            retentionMs: RETENTION_MS,
            sinceMs: Date.now(),
        });
    },
    async onDisable(context) {
        await sellercloudPoller.clear({ store: context.store });
    },
    async test(context) {
        const items = await buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue })({ since: new Date() });
        return items.filter((item) => item.eligible).slice(0, 5).map((item) => item.data);
    },
    async run(context) {
        const emissions = await sellercloudPoller.poll({
            store: context.store,
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue }),
            emitUnseen: true,
            retentionMs: RETENTION_MS,
        });
        return emissions.map((emission) => emission.item);
    },
});

// Receive dates can be date-only, so read a few days back and dedupe on PO + receiving
// state: the PO fires once per state it reaches (partial, then full).
function buildFetch({ auth, store, propsValue }: BuildFetchParams): FetchItems<Record<string, unknown>> {
    return async ({ since }) => {
        const pos = await sellercloudFeeds.receivedPurchaseOrders({
            auth: sellercloudAuthProps(auth),
            store,
            since: new Date(since.getTime() - WINDOW_MS),
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds }),
            warehouses: (propsValue.warehouses ?? []).map(Number),
            maxPages: MAX_PAGES,
        });
        return pos.map((po) => {
            const fullyReceived = po.PurchaseOrderStatus === PO_STATUS_RECEIVED || po.ReceivingStatus === RECEIVING_FULL;
            const partiallyReceived = po.ReceivingStatus === RECEIVING_PARTIAL;
            const state = fullyReceived ? 'full' : partiallyReceived ? 'partial' : 'none';
            return {
                key: String(po.ID),
                state,
                eligible: fullyReceived || (propsValue.includePartial === true && partiallyReceived),
                data: sellercloudRecords.flattenPurchaseOrder({ po }),
            };
        });
    };
}

const PO_STATUS_RECEIVED = 3;
const RECEIVING_PARTIAL = 1;
const RECEIVING_FULL = 2;
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const RETENTION_MS = 10 * 24 * 60 * 60 * 1000;
const MAX_PAGES = 10;

type BuildFetchParams = {
    auth: SellercloudAuthValue;
    store: PollStore;
    propsValue: {
        includePartial?: boolean;
        warehouses?: unknown[];
        companies?: unknown[];
        otherCompanyIds?: string;
    };
};
