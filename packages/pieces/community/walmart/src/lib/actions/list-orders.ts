import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { ORDER_STATUSES, SHIP_NODE_TYPES, walmartOrders } from '../common/orders';

export const listOrders = createAction({
    auth: walmartAuth,
    name: 'list_orders',
    displayName: 'List Orders',
    description: 'List Walmart orders created in a date range, following pagination until the maximum is reached.',
    props: {
        createdStartDate: Property.DateTime({
            displayName: 'Created After',
            description: 'Only orders created on or after this time. Walmart defaults to 7 days ago and keeps 180 days of orders.',
            required: false,
        }),
        createdEndDate: Property.DateTime({
            displayName: 'Created Before',
            description: 'Only orders created on or before this time. Defaults to now.',
            required: false,
        }),
        status: Property.StaticDropdown({
            displayName: 'Status',
            description: 'Leave empty for every status.',
            required: false,
            options: { disabled: false, options: ORDER_STATUSES.map((status) => ({ label: status, value: status })) },
        }),
        shipNodeType: Property.StaticDropdown({
            displayName: 'Fulfillment',
            description: 'Seller Fulfilled (default), Walmart Fulfillment Services (WFS) or 3PL.',
            required: false,
            defaultValue: 'SellerFulfilled',
            options: { disabled: false, options: SHIP_NODE_TYPES.map((type) => ({ label: type, value: type })) },
        }),
        sku: Property.ShortText({
            displayName: 'SKU',
            description: 'Only orders containing this seller SKU.',
            required: false,
        }),
        maxOrders: Property.Number({
            displayName: 'Maximum Orders',
            description: 'Stop after this many orders (pages of up to 200 are fetched until reached).',
            required: false,
            defaultValue: 100,
        }),
    },
    async run(context) {
        const { createdStartDate, createdEndDate, status, shipNodeType, sku, maxOrders } = context.propsValue;
        const orders = await walmartOrders.listOrders({
            auth: walmartAuthProps(context.auth),
            filters: {
                createdStartDate: toIso({ value: createdStartDate }),
                createdEndDate: toIso({ value: createdEndDate }),
                status: status ?? undefined,
                shipNodeType: shipNodeType ?? undefined,
                sku: sku ?? undefined,
            },
            maxOrders: Math.max(1, maxOrders ?? 100),
        });
        return orders.map((order) => walmartOrders.flattenOrder({ order }));
    },
});

function toIso({ value }: { value: string | undefined }): string | undefined {
    return value ? new Date(value).toISOString() : undefined;
}
