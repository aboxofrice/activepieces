import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { orderCommon } from '../../common/order';

export const listOrders = createAction({
    auth: ebayAuth,
    name: 'order_list_orders',
    displayName: 'Order · List Orders',
    description: 'List orders (one row per order, newest first) filtered by creation or last-modified date and fulfillment status. Pages through results automatically up to the max you set.',
    props: {
        dateField: Property.StaticDropdown({
            displayName: 'Date Filter',
            description: 'Which order date From/To apply to. eBay only returns orders from the last 2 years.',
            required: true,
            defaultValue: 'creationdate',
            options: {
                options: [
                    { label: 'Created', value: 'creationdate' },
                    { label: 'Last modified', value: 'lastmodifieddate' },
                ],
            },
        }),
        from: Property.DateTime({
            displayName: 'From',
            description: 'Leave empty with To empty to get the most recent orders (eBay defaults to the last 90 days).',
            required: false,
        }),
        to: Property.DateTime({
            displayName: 'To',
            description: 'Leave empty for "until now".',
            required: false,
        }),
        fulfillmentStatus: orderCommon.fulfillmentStatusProp(),
        orderIds: Property.ShortText({
            displayName: 'Order IDs',
            description: 'Optional comma-separated order IDs (up to 50). When set, every other filter is ignored.',
            required: false,
        }),
        maxOrders: Property.Number({
            displayName: 'Max Orders',
            description: 'Stop after this many orders (default 200, max 5000).',
            required: false,
            defaultValue: 200,
        }),
    },
    async run(context) {
        const { dateField, from, to, fulfillmentStatus, orderIds, maxOrders } = context.propsValue;
        const filter = orderCommon.buildFilter({
            dateField: dateField === 'lastmodifieddate' ? 'lastmodifieddate' : 'creationdate',
            from,
            to,
            fulfillmentStatus,
        });
        const { orders, total } = await orderCommon.listOrders({
            auth: context.auth.props,
            filter,
            orderIds: orderIds?.split(',').map((id) => id.trim()).filter((id) => id !== '').join(',') || undefined,
            maxOrders: Math.min(Math.max(maxOrders ?? DEFAULT_MAX_ORDERS, 1), MAX_ORDERS),
        });
        return {
            total_matching: total,
            returned: orders.length,
            orders: orders.map((order) => orderCommon.flattenOrder({ order })),
        };
    },
});

const DEFAULT_MAX_ORDERS = 200;
const MAX_ORDERS = 5000;
