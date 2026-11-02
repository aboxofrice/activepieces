import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonOrders, FULFILLMENT_CHANNELS, ORDER_STATUSES } from '../common/orders';
import { amazonProps } from '../common/props';

export const listOrders = createAction({
    auth: amazonSellerAuth,
    name: 'list_orders',
    displayName: 'List Orders',
    description: 'Find orders created or updated in a date range, optionally filtered by status and fulfillment channel. All pages are fetched up to the maximum you set.',
    props: {
        createdAfter: Property.DateTime({
            displayName: 'Created After',
            description: 'Orders placed at or after this time. Either this or Updated After is required.',
            required: false,
        }),
        createdBefore: Property.DateTime({
            displayName: 'Created Before',
            description: 'Must be at least 2 minutes in the past.',
            required: false,
        }),
        lastUpdatedAfter: Property.DateTime({
            displayName: 'Updated After',
            description: 'Orders changed (status, shipment, refund...) at or after this time. Cannot be combined with Created After.',
            required: false,
        }),
        lastUpdatedBefore: Property.DateTime({
            displayName: 'Updated Before',
            description: 'Must be at least 2 minutes in the past.',
            required: false,
        }),
        orderStatuses: Property.StaticMultiSelectDropdown({
            displayName: 'Order Statuses',
            description: 'Leave empty for every status.',
            required: false,
            options: { options: ORDER_STATUSES },
        }),
        fulfillmentChannels: Property.StaticMultiSelectDropdown({
            displayName: 'Fulfillment Channels',
            description: 'Leave empty for both FBA and merchant-fulfilled orders.',
            required: false,
            options: { options: FULFILLMENT_CHANNELS },
        }),
        marketplaceId: amazonProps.marketplace(),
        maxResults: Property.Number({
            displayName: 'Maximum Orders',
            description: 'Stops paging once this many orders are collected. getOrders allows about one page of 100 per minute after a short burst, so large ranges take a while.',
            required: false,
            defaultValue: 500,
        }),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const { createdAfter, createdBefore, lastUpdatedAfter, lastUpdatedBefore, orderStatuses, fulfillmentChannels, maxResults } = context.propsValue;
        if (!createdAfter && !lastUpdatedAfter) {
            throw new Error('Set either Created After or Updated After.');
        }
        if (createdAfter && lastUpdatedAfter) {
            throw new Error('Amazon accepts Created After or Updated After, not both.');
        }
        const orders = await amazonOrders.listOrders({
            auth,
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
            maxRows: maxResults ?? undefined,
            filters: {
                CreatedAfter: toIso({ value: createdAfter }),
                CreatedBefore: toIso({ value: createdBefore }),
                LastUpdatedAfter: toIso({ value: lastUpdatedAfter }),
                LastUpdatedBefore: toIso({ value: lastUpdatedBefore }),
                OrderStatuses: orderStatuses ?? undefined,
                FulfillmentChannels: fulfillmentChannels ?? undefined,
            },
        });
        return orders.map((order) => amazonOrders.flattenOrder({ order }));
    },
});

function toIso({ value }: { value: string | undefined | null }): string | undefined {
    return value ? new Date(value).toISOString() : undefined;
}
