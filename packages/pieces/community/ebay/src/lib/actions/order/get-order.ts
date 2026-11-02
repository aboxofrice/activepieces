import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { orderCommon } from '../../common/order';

export const getOrder = createAction({
    auth: ebayAuth,
    name: 'order_get_order',
    displayName: 'Order · Get Order',
    description: 'Get one order by its order ID, with buyer, ship-to, totals, fees and line items.',
    props: {
        orderId: Property.ShortText({
            displayName: 'Order ID',
            description: 'The eBay order number, e.g. 12-34567-89012 (shown in Seller Hub → Orders, or the order_id from New Order / List Orders).',
            required: true,
        }),
    },
    async run(context) {
        const order = await orderCommon.getOrder({ auth: context.auth.props, orderId: context.propsValue.orderId });
        return orderCommon.flattenOrder({ order });
    },
});
