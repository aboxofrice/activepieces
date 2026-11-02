import { tryCatch } from '@activepieces/shared';
import { EbayAuthProps } from './client';
import { EbayOrder, orderCommon } from './order';

// The Post-Order docs make buyerPaid conditional on payment ("include it, true if the buyer
// has paid, false if not") and buyerPaidDate required when paid. Read both from the order.
// The Fulfillment read needs the sell.fulfillment scope; without it the request goes out
// as before, without the fields.
async function fetchPaymentInfo({ auth, orderId }: { auth: EbayAuthProps; orderId: string }): Promise<PaymentInfo | null> {
    const { data: order, error } = await tryCatch(() => orderCommon.getOrder({ auth, orderId }));
    return error ? null : paymentInfoFromOrder({ order });
}

function paymentInfoFromOrder({ order }: { order: EbayOrder }): PaymentInfo {
    const buyerPaid = PAID_STATUSES.includes(order.orderPaymentStatus ?? '');
    const paidDates = (order.paymentSummary?.payments ?? [])
        .map((payment) => payment.paymentDate)
        .filter((date): date is string => typeof date === 'string' && !Number.isNaN(Date.parse(date)))
        .sort((a, b) => Date.parse(a) - Date.parse(b));
    return { buyerPaid, buyerPaidDate: buyerPaid && paidDates[0] ? new Date(paidDates[0]).toISOString() : null };
}

function cancelBody({ orderId, reason, payment }: { orderId: string; reason: string; payment: PaymentInfo | null }): Record<string, unknown> {
    return {
        legacyOrderId: orderId,
        cancelReason: reason,
        ...(payment === null ? {} : { buyerPaid: payment.buyerPaid }),
        ...(payment?.buyerPaidDate ? { buyerPaidDate: { value: payment.buyerPaidDate } } : {}),
    };
}

const PAID_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED'];

export const cancellationCommon = { fetchPaymentInfo, paymentInfoFromOrder, cancelBody };

export type PaymentInfo = { buyerPaid: boolean; buyerPaidDate: string | null };
