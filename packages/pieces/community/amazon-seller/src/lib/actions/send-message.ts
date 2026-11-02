import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonMessaging, MAX_MESSAGE_TEXT_LENGTH, TEXT_MESSAGE_TYPES } from '../common/messaging';
import { amazonProps } from '../common/props';

export const sendMessage = createAction({
    auth: amazonSellerAuth,
    name: 'send_buyer_message',
    displayName: 'Send Message to Buyer',
    description: 'Send an order-related message to the buyer through Amazon Buyer-Seller Messaging. Amazon only allows certain message types per order; this checks first and fails with the allowed list if the type is not available.',
    props: {
        orderId: amazonProps.amazonOrderId(),
        messageType: Property.StaticDropdown({
            displayName: 'Message Type',
            description: 'Amazon restricts what each type may be used for. Confirm Order Details is for questions needed to fulfil the order (e.g. asking for a vehicle VIN to confirm fitment); no marketing or feedback requests.',
            required: true,
            defaultValue: 'confirmOrderDetails',
            options: { options: TEXT_MESSAGE_TYPES },
        }),
        text: Property.LongText({
            displayName: 'Message',
            description: `Plain text, up to ${MAX_MESSAGE_TEXT_LENGTH} characters. Links and contact details are not allowed by Amazon policy.`,
            required: true,
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const { orderId, messageType } = context.propsValue;
        const text = context.propsValue.text.trim();
        if (text.length === 0) {
            throw new Error('The message is empty.');
        }
        if (text.length > MAX_MESSAGE_TEXT_LENGTH) {
            throw new Error(`The message is ${text.length} characters; Amazon allows at most ${MAX_MESSAGE_TEXT_LENGTH}.`);
        }
        return amazonMessaging.sendTextMessage({
            auth,
            orderId,
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
            messageType,
            text,
        });
    },
});
