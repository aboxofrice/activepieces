import { createAction } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonFinances } from '../common/finances';
import { amazonProps } from '../common/props';

export const getOrderFinancials = createAction({
    auth: amazonSellerAuth,
    name: 'get_order_financials',
    displayName: 'Get Order Fees & Refunds',
    description: 'Get the settled charges, Amazon fees and refunds of an order (one row per item and event). Fees usually post 1-3 days after shipment.',
    props: {
        orderId: amazonProps.amazonOrderId(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const orderId = context.propsValue.orderId.trim();
        const events = await amazonFinances.listOrderFinancialEvents({ auth, orderId });
        return amazonFinances.flattenFinancialEvents({ events, orderId });
    },
});
