import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartClient } from '../common/client';
import { walmartJson } from '../common/json';
import { walmartLineMath } from '../common/line-math';
import { RawOrder, walmartOrders } from '../common/orders';

const { arrayAt, stringAt, round } = walmartJson;

const REFUNDABLE_STATUSES = ['Shipped', 'Delivered'];
const REFUND_REASONS = [
    'ItemNotReceivedByCustomer', 'DamagedItem', 'DefectiveItem', 'IncorrectItemReceived', 'ItemNotAsAdvertised',
    'CustomerChangedMind', 'CustomerReceivedItemLate', 'CancelledYetShipped', 'IncorrectShippingPrice', 'BillingError',
    'TaxExemptCustomer', 'Customer returned item', 'Buyer canceled', 'Merchandise not received', 'General adjustment',
    'Finance -> Goodwill', 'Others',
];

export const refundOrderLines = createAction({
    auth: walmartAuth,
    name: 'refund_order_lines',
    displayName: 'Refund Order Lines',
    description: 'Refund a shipped Walmart order, fully or by line and amount. Refunds are sent to the customer and cannot be undone.',
    props: {
        purchaseOrderId: Property.ShortText({
            displayName: 'Purchase Order ID',
            required: true,
        }),
        reason: Property.StaticDropdown({
            displayName: 'Refund Reason',
            required: true,
            defaultValue: 'Customer returned item',
            options: { disabled: false, options: REFUND_REASONS.map((reason) => ({ label: reason, value: reason })) },
        }),
        comments: Property.ShortText({
            displayName: 'Comment',
            required: false,
        }),
        lines: Property.Array({
            displayName: 'Partial Refunds',
            description: 'Leave empty to refund everything not yet refunded on the shipped lines (item price, shipping and their tax, read from the order, minus earlier refunds). Otherwise one row per line with the amounts to refund (positive numbers).',
            required: false,
            properties: {
                lineNumber: Property.ShortText({ displayName: 'Line Number', required: true }),
                itemAmount: Property.Number({ displayName: 'Item Amount', required: true }),
                itemTax: Property.Number({ displayName: 'Item Tax', required: false }),
                shippingAmount: Property.Number({ displayName: 'Shipping Amount', required: false }),
            },
        }),
    },
    async run(context) {
        const auth = walmartAuthProps(context.auth);
        const purchaseOrderId = context.propsValue.purchaseOrderId.trim();
        const { reason, comments } = context.propsValue;
        const order = await walmartOrders.getOrder({ auth, purchaseOrderId });
        const currency = arrayAt({ value: arrayAt({ value: order, path: ['orderLines', 'orderLine'] })[0], path: ['charges', 'charge'] })
            .map((charge) => stringAt({ value: charge, path: ['chargeAmount', 'currency'] }))
            .find((value) => value !== undefined) ?? 'USD';
        const partial = (context.propsValue.lines ?? []).map((line) => parsePartial({ value: line })).filter((line): line is PartialRefund => line !== null);
        const orderLines = partial.length > 0
            ? partial.map((line) => ({ lineNumber: line.lineNumber, charges: partialCharges({ line, reason, currency }) }))
            : fullRefundLines({ order, reason });
        if (orderLines.length === 0 || orderLines.some((line) => line.charges.length === 0)) {
            throw new Error('Nothing to refund: check the line numbers and amounts.');
        }
        await walmartClient.request<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `/v3/orders/${encodeURIComponent(purchaseOrderId)}/refund`,
            body: {
                orderRefund: {
                    purchaseOrderId,
                    orderLines: {
                        orderLine: orderLines.map((line) => ({
                            lineNumber: line.lineNumber,
                            isFullRefund: false,
                            refunds: {
                                refund: [{
                                    ...(comments ? { refundComments: comments } : {}),
                                    refundCharges: { refundCharge: line.charges },
                                }],
                            },
                        })),
                    },
                },
            },
        });
        const refunded = orderLines.flatMap((line) => line.charges).reduce((sum, charge) => sum - charge.charge.chargeAmount.amount - (charge.charge.tax?.taxAmount.amount ?? 0), 0);
        return { purchase_order_id: purchaseOrderId, refunded_lines: orderLines.length, refunded_total: round({ value: refunded }), currency };
    },
});

// Mirrors what is still unrefunded on each shipped line with a negative amount, which is how
// Walmart expresses a refund of that charge. Earlier refunds are subtracted so a re-run (or a
// full refund after a partial one) cannot refund the same money twice.
function fullRefundLines({ order, reason }: { order: RawOrder; reason: string }): RefundLine[] {
    const shipped = walmartLineMath.eligibleLines({ order, statuses: REFUNDABLE_STATUSES }).map((line) => line.lineNumber);
    const lines = arrayAt({ value: order, path: ['orderLines', 'orderLine'] })
        .filter((line) => shipped.includes(stringAt({ value: line, path: ['lineNumber'] }) ?? ''))
        .map((line) => ({
            lineNumber: stringAt({ value: line, path: ['lineNumber'] }) ?? '',
            charges: walmartLineMath.refundableCharges({ line }).map((charge) => refundCharge({
                reason,
                chargeType: charge.chargeType,
                chargeName: charge.chargeName,
                amount: charge.amount,
                currency: charge.currency,
                tax: charge.taxAmount > 0 ? { name: charge.taxName, amount: charge.taxAmount } : null,
            })),
        }))
        .filter((line) => line.charges.length > 0);
    if (lines.length === 0) {
        const current = walmartLineMath.lineStatusSummary({ order });
        throw new Error(`Nothing left to refund on this order: no shipped or delivered line has an unrefunded charge (${current || 'no lines'}).`);
    }
    return lines;
}

function partialCharges({ line, reason, currency }: { line: PartialRefund; reason: string; currency: string }): RefundCharge[] {
    const item = line.itemAmount > 0
        ? [refundCharge({ reason, chargeType: 'PRODUCT', chargeName: 'Item Price', amount: line.itemAmount, currency, tax: line.itemTax > 0 ? { name: 'Item Price Tax', amount: line.itemTax } : null })]
        : [];
    const shipping = line.shippingAmount > 0
        ? [refundCharge({ reason, chargeType: 'SHIPPING', chargeName: 'Shipping', amount: line.shippingAmount, currency, tax: null })]
        : [];
    return [...item, ...shipping];
}

function refundCharge({ reason, chargeType, chargeName, amount, currency, tax }: RefundChargeInput): RefundCharge {
    return {
        refundReason: reason,
        charge: {
            chargeType,
            chargeName,
            chargeAmount: { currency, amount: -round({ value: Math.abs(amount) }) },
            ...(tax ? { tax: { taxName: tax.name, taxAmount: { currency, amount: -round({ value: Math.abs(tax.amount) }) } } } : {}),
        },
    };
}

function parsePartial({ value }: { value: unknown }): PartialRefund | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const lineNumber = 'lineNumber' in value ? String(value.lineNumber ?? '').trim() : '';
    const itemAmount = 'itemAmount' in value ? positive({ value: value.itemAmount }) : 0;
    const itemTax = 'itemTax' in value ? positive({ value: value.itemTax }) : 0;
    const shippingAmount = 'shippingAmount' in value ? positive({ value: value.shippingAmount }) : 0;
    return lineNumber ? { lineNumber, itemAmount, itemTax, shippingAmount } : null;
}

function positive({ value }: { value: unknown }): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type PartialRefund = { lineNumber: string; itemAmount: number; itemTax: number; shippingAmount: number };

type RefundChargeInput = { reason: string; chargeType: string; chargeName: string; amount: number; currency: string; tax: { name: string; amount: number } | null };

type RefundCharge = {
    refundReason: string;
    charge: {
        chargeType: string;
        chargeName: string;
        chargeAmount: { currency: string; amount: number };
        tax?: { taxName: string; taxAmount: { currency: string; amount: number } };
    };
};

type RefundLine = { lineNumber: string; charges: RefundCharge[] };
