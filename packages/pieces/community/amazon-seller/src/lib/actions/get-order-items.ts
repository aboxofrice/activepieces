import { createAction } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonOrders } from '../common/orders';
import { amazonProps } from '../common/props';

export const getOrderItems = createAction({
    auth: amazonSellerAuth,
    name: 'get_order_items',
    displayName: 'Get Order Items',
    description: 'List the line items (SKU, ASIN, quantity, prices) of an order.',
    props: {
        orderId: amazonProps.amazonOrderId(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const orderId = context.propsValue.orderId.trim();
        const items = await amazonOrders.getOrderItems({ auth, orderId });
        return items.map((item) => amazonOrders.flattenOrderItem({ item, orderId }));
    },
});
