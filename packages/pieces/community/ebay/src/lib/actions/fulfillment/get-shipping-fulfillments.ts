import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { orderCommon } from '../../common/order';

export const getShippingFulfillments = createAction({
    auth: ebayAuth,
    name: 'fulfillment_get_shipping_fulfillments',
    displayName: 'Fulfillment · Get Shipments',
    description: 'List the shipments (carrier + tracking number) already recorded on an order.',
    props: {
        orderId: Property.ShortText({
            displayName: 'Order ID',
            description: 'The eBay order number, e.g. 12-34567-89012.',
            required: true,
        }),
    },
    async run(context) {
        const fulfillments = await orderCommon.listShippingFulfillments({ auth: context.auth.props, orderId: context.propsValue.orderId });
        return { order_id: context.propsValue.orderId.trim(), count: fulfillments.length, fulfillments };
    },
});
