import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonOrders } from '../common/orders';
import { amazonProps } from '../common/props';

export const getOrder = createAction({
    auth: amazonSellerAuth,
    name: 'get_order',
    displayName: 'Get Order',
    description: 'Get one order by its Amazon order ID, optionally with its line items.',
    props: {
        orderId: amazonProps.amazonOrderId(),
        includeItems: Property.Checkbox({
            displayName: 'Include Items',
            description: 'Also fetch the line items (one extra request).',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const { orderId, includeItems } = context.propsValue;
        const order = amazonOrders.flattenOrder({ order: await amazonOrders.getOrder({ auth, orderId }) });
        if (!includeItems) {
            return order;
        }
        const items = await amazonOrders.getOrderItems({ auth, orderId });
        return { ...order, items: items.map((item) => amazonOrders.flattenOrderItem({ item, orderId: order.amazon_order_id })) };
    },
});
