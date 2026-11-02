import { createAction } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonMessaging } from '../common/messaging';
import { amazonProps } from '../common/props';

export const getMessageTypes = createAction({
    auth: amazonSellerAuth,
    name: 'get_message_types_for_order',
    displayName: 'Get Available Message Types for Order',
    description: 'List the buyer message types Amazon currently allows for an order. Use it to branch before Send Message.',
    props: {
        orderId: amazonProps.amazonOrderId(),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const orderId = context.propsValue.orderId.trim();
        const types = await amazonMessaging.getAvailableMessageTypes({
            auth,
            orderId,
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
        });
        return {
            amazon_order_id: orderId,
            message_types: types,
            can_confirm_order_details: types.includes('confirmOrderDetails'),
            can_report_unexpected_problem: types.includes('unexpectedProblem'),
            can_confirm_delivery_details: types.includes('confirmDeliveryDetails'),
        };
    },
});
