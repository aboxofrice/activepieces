import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { postOrderCommon } from '../../common/post-order';

export const cancelOrder = createAction({
    auth: ebayAuth,
    name: 'cancellation_cancel_order',
    displayName: 'Cancellation · Cancel Order',
    description: 'Cancel an unshipped order as the seller. eBay refunds the buyer. Run Check Eligibility first — eBay only allows this for orders that have not shipped, within its cancellation window.',
    props: {
        orderId: Property.ShortText({
            displayName: 'Order ID',
            description: 'The eBay order number, e.g. 12-34567-89012.',
            required: true,
        }),
        reason: Property.StaticDropdown({
            displayName: 'Reason',
            description: '"Out of stock" counts against your seller performance; the other reasons do not.',
            required: true,
            defaultValue: 'BUYER_ASKED_CANCEL',
            options: {
                options: [
                    { label: 'Buyer asked to cancel', value: 'BUYER_ASKED_CANCEL' },
                    { label: 'Out of stock / cannot fulfill', value: 'OUT_OF_STOCK_OR_CANNOT_FULFILL' },
                    { label: 'Problem with the buyer\'s address', value: 'ADDRESS_ISSUES' },
                ],
            },
        }),
    },
    async run(context) {
        const orderId = context.propsValue.orderId.trim();
        const response = await postOrderCommon.request<{ cancelId?: string }>({
            auth: context.auth.props,
            method: HttpMethod.POST,
            path: '/cancellation',
            body: { legacyOrderId: orderId, cancelReason: context.propsValue.reason },
        });
        return { order_id: orderId, cancel_id: response.cancelId ?? null, reason: context.propsValue.reason };
    },
});
