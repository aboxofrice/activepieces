import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartClient } from '../common/client';
import { orderLinesProp, walmartOrderLines } from '../common/order-lines';
import { walmartOrders } from '../common/orders';

export const cancelOrderLines = createAction({
    auth: walmartAuth,
    name: 'cancel_order_lines',
    displayName: 'Cancel Order Lines',
    description: 'Cancel lines of a Walmart order (for example when out of stock). This cannot be undone.',
    props: {
        purchaseOrderId: Property.ShortText({
            displayName: 'Purchase Order ID',
            required: true,
        }),
        lines: orderLinesProp,
        reason: Property.StaticDropdown({
            displayName: 'Cancellation Reason',
            description: 'Use "Customer requested" only when the customer asked to cancel; "Fraud" only for confirmed fraud.',
            required: true,
            defaultValue: 'SELLER_CANCEL_OUT_OF_STOCK',
            options: {
                disabled: false,
                options: [
                    { label: 'Out of stock', value: 'SELLER_CANCEL_OUT_OF_STOCK' },
                    { label: 'Pricing error', value: 'SELLER_CANCEL_PRICING_ERROR' },
                    { label: 'Customer requested', value: 'CUSTOMER_REQUESTED_SELLER_TO_CANCEL' },
                    { label: 'Address not serviceable', value: 'SELLER_CANCEL_ADDRESS_NOT_SERVICEABLE' },
                    { label: 'Fraud (stop shipment)', value: 'SELLER_CANCEL_FRAUD_STOP_SHIPMENT' },
                ],
            },
        }),
    },
    async run(context) {
        const auth = walmartAuthProps(context.auth);
        const purchaseOrderId = context.propsValue.purchaseOrderId.trim();
        const lines = await walmartOrderLines.resolveLines({ auth, purchaseOrderId, lines: context.propsValue.lines, statuses: ['Created', 'Acknowledged'], action: 'cancelled' });
        const response = await walmartClient.request<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `/v3/orders/${encodeURIComponent(purchaseOrderId)}/cancel`,
            body: {
                orderCancellation: {
                    orderLines: {
                        orderLine: lines.map((line) => ({
                            lineNumber: line.lineNumber,
                            orderLineStatuses: {
                                orderLineStatus: [{
                                    status: 'Cancelled',
                                    cancellationReason: context.propsValue.reason,
                                    statusQuantity: { unitOfMeasurement: 'EACH', amount: String(line.quantity) },
                                }],
                            },
                        })),
                    },
                },
            },
        });
        const order = walmartClient.isRecord(response) && walmartClient.isRecord(response['order']) ? response['order'] : null;
        return order ? walmartOrders.flattenOrder({ order }) : { purchase_order_id: purchaseOrderId, cancelled_lines: lines.length };
    },
});
