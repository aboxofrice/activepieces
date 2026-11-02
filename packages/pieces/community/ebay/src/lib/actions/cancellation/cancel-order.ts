import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { ebayAuth } from '../../auth';
import { EbayAuthProps } from '../../common/client';
import { orderCommon } from '../../common/order';
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
        const payment = await paymentInfo({ auth: context.auth.props, orderId });

// The Post-Order docs make buyerPaid conditional on payment ("include it, true if the buyer
// has paid, false if not") and buyerPaidDate required when paid. Read both from the order.
// The Fulfillment read needs the sell.fulfillment scope; without it the request goes out
// as before, without the fields.
async function paymentInfo({ auth, orderId }: { auth: EbayAuthProps; orderId: string }): Promise<{ buyerPaid: boolean; buyerPaidDate: string | null } | null> {
    const { data: order, error } = await tryCatch(() => orderCommon.getOrder({ auth, orderId }));
    if (error) {
        return null;
    }
    const buyerPaid = PAID_STATUSES.includes(order.orderPaymentStatus ?? '');
    const paidDates = (order.paymentSummary?.payments ?? [])
        .map((payment) => payment.paymentDate)
        .filter((date): date is string => typeof date === 'string' && !Number.isNaN(Date.parse(date)))
        .sort((a, b) => Date.parse(a) - Date.parse(b));
    return { buyerPaid, buyerPaidDate: buyerPaid && paidDates[0] ? new Date(paidDates[0]).toISOString() : null };
}

const PAID_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED'];
        const response = await postOrderCommon.request<{ cancelId?: string }>({
            auth: context.auth.props,
            method: HttpMethod.POST,
            path: '/cancellation',
            body: {
                legacyOrderId: orderId,
                cancelReason: context.propsValue.reason,
                ...(payment === null ? {} : { buyerPaid: payment.buyerPaid }),
                ...(payment?.buyerPaidDate ? { buyerPaidDate: { value: payment.buyerPaidDate } } : {}),
            },
        });
        return {
            order_id: orderId,
            cancel_id: response.cancelId ?? null,
            reason: context.propsValue.reason,
            buyer_paid: payment?.buyerPaid ?? null,
        };
    },
});
