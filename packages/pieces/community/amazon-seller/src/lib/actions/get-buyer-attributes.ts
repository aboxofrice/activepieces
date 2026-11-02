import { createAction } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonMessaging } from '../common/messaging';
import { amazonProps } from '../common/props';

export const getBuyerAttributes = createAction({
    auth: amazonSellerAuth,
    name: 'get_buyer_attributes',
    displayName: 'Get Buyer Language',
    description: "Get the buyer's preferred locale (e.g. en-US) for an order, so a message can be written in their language.",
    props: {
        orderId: amazonProps.amazonOrderId(),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const orderId = context.propsValue.orderId.trim();
        const attributes = await amazonMessaging.getBuyerAttributes({
            auth,
            orderId,
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
        });
        return { amazon_order_id: orderId, ...attributes };
    },
});
