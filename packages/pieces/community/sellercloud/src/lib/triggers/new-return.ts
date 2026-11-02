import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
import { sellercloudAuth, sellercloudAuthProps, SellercloudAuthValue } from '../auth';
import { sellercloudDropdowns } from '../common/dropdowns';
import { FetchItems, PollStore, sellercloudPoller } from '../common/poller';
import { sellercloudRecords } from '../common/records';
import { sellercloudSamples } from '../common/sample-data';
import { sellercloudFeeds } from '../common/trigger-feeds';

export const newReturn = createTrigger({
    auth: sellercloudAuth,
    name: 'new_return',
    displayName: 'New Return (RMA)',
    description: 'Triggers when a new return (RMA) is created in SellerCloud.',
    props: {
        channels: sellercloudDropdowns.channels({ description: 'Only include returns from these sales channels. Leave empty for all.' }),
        companies: sellercloudDropdowns.companies({ required: false }),
        otherCompanyIds: sellercloudDropdowns.otherCompanyIds,
    },
    sampleData: sellercloudSamples.rma,
    type: TriggerStrategy.POLLING,
    async onEnable(context) {
        await sellercloudPoller.enable({
            store: context.store,
            fingerprint: fingerprint({ propsValue: context.propsValue }),
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue }),
            retentionMs: RETENTION_MS,
            sinceMs: Date.now(),
        });
    },
    async onDisable() {
        await sellercloudPoller.disable();
    },
    async test(context) {
        const { items } = await buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue })({ since: new Date(), startPage: 1, seen: {} });
        return items.slice(0, 5).map((item) => item.data);
    },
    async run(context) {
        const emissions = await sellercloudPoller.poll({
            store: context.store,
            fingerprint: fingerprint({ propsValue: context.propsValue }),
            fetchItems: buildFetch({ auth: context.auth, store: context.store, propsValue: context.propsValue }),
            emitUnseen: true,
            retentionMs: RETENTION_MS,
            overlapMs: sellercloudPoller.OVERLAP_MS,
        });
        return emissions.map((emission) => emission.item);
    },
});

// Channel-imported RMAs (e.g. Amazon) are dated at midnight of the day they were opened,
// so a "created since the last poll" window misses them. Always read the last few days and
// let the remembered IDs do the dedupe.
function buildFetch({ auth, store, propsValue }: BuildFetchParams): FetchItems<Record<string, unknown>> {
    return async ({ since, startPage }) => {
        const page = await sellercloudFeeds.returns({
            auth: sellercloudAuthProps(auth),
            store,
            since: new Date(since.getTime() - WINDOW_MS),
            channels: (propsValue.channels ?? []).map(Number),
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds }),
            maxPages: MAX_PAGES,
            startPage,
        });
        return {
            truncated: page.truncated,
            nextPage: page.nextPage,
            items: page.items.map((rma) => ({
                key: String(rma.ID),
                state: 'seen',
                eligible: true,
                eventTime: sellercloudPoller.toEventTime({ tenantLocal: rma.CreatedOn }),
                data: sellercloudRecords.flattenRma({ rma }),
            })),
        };
    };
}

function fingerprint({ propsValue }: { propsValue: BuildFetchParams['propsValue'] }): string {
    return sellercloudPoller.fingerprintOf({
        trigger: 'new_return',
        settings: {
            channels: (propsValue.channels ?? []).map(Number).sort(),
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: propsValue.companies, other: propsValue.otherCompanyIds })?.sort() ?? null,
        },
    });
}

const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const RETENTION_MS = 10 * 24 * 60 * 60 * 1000;
const MAX_PAGES = 10;

type BuildFetchParams = {
    auth: SellercloudAuthValue;
    store: PollStore;
    propsValue: {
        channels?: unknown[];
        companies?: unknown[];
        otherCompanyIds?: string;
    };
};
