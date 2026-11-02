import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Orders } from '../common/orders';

export const getOrder = createAction({
    auth: turn14Auth,
    name: 'get_order',
    displayName: 'Get Order',
    description: 'Get one Turn14 order: status, lines with open/fulfilled quantities, tracking numbers and invoice IDs.',
    props: {
        orderId: Property.ShortText({
            displayName: 'Order ID',
            description: 'The Turn14 order ID (order_id from Place Order, an invoice, or tracking). Turn14 rejects the printed order number here; if you only have that (e.g. from SellerCloud\'s TURN14_ORDER_NUMBER column), look the order ID up on Get Tracking or List Invoices.',
            required: true,
        }),
    },
    async run(context) {
        const order = await turn14Orders.getOrder({ auth: turn14AuthProps(context.auth), orderId: context.propsValue.orderId.trim() });
        return turn14Orders.flattenOrder({ order });
    },
});
