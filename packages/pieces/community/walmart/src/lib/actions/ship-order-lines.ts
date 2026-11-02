import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartClient } from '../common/client';
import { orderLinesProp, walmartOrderLines } from '../common/order-lines';
import { walmartOrders } from '../common/orders';

const OTHER_CARRIER = '__other__';
const CARRIERS = ['UPS', 'USPS', 'FedEx', 'DHL', 'DHL Ecommerce - US', 'OnTrac', 'LSO', 'LS', 'UDS', 'Better Trucks', 'Estes', 'SAIA', 'XPO Logistics', 'TForce Freight', 'AAA Cooper', 'ABF Freight System', 'RL Carriers', 'PITT OHIO', 'Southeastern Freight Lines', 'Canada Post', 'Asendia', 'Sendle', 'OSM Worldwide', 'FEDEXSP', 'PILOT', 'CEVA'];
const METHOD_CODES = ['Standard', 'Express', 'OneDay', 'Freight', 'WhiteGlove', 'Value'];

export const shipOrderLines = createAction({
    auth: walmartAuth,
    name: 'ship_order_lines',
    displayName: 'Ship Order Lines',
    description: 'Mark lines of an acknowledged Walmart order as shipped and send the tracking number to the customer.',
    props: {
        purchaseOrderId: Property.ShortText({
            displayName: 'Purchase Order ID',
            required: true,
        }),
        lines: orderLinesProp,
        carrier: Property.StaticDropdown({
            displayName: 'Carrier',
            required: true,
            defaultValue: 'UPS',
            options: {
                disabled: false,
                options: [...CARRIERS.map((carrier) => ({ label: carrier, value: carrier })), { label: 'Other (enter below)', value: OTHER_CARRIER }],
            },
        }),
        otherCarrier: Property.ShortText({
            displayName: 'Other Carrier Name',
            description: 'Only when Carrier is "Other". Walmart then requires the Tracking URL.',
            required: false,
        }),
        methodCode: Property.StaticDropdown({
            displayName: 'Shipping Method',
            required: true,
            defaultValue: 'Standard',
            options: { disabled: false, options: METHOD_CODES.map((method) => ({ label: method, value: method })) },
        }),
        trackingNumber: Property.ShortText({
            displayName: 'Tracking Number',
            required: true,
        }),
        trackingUrl: Property.ShortText({
            displayName: 'Tracking URL',
            required: false,
        }),
        shipDateTime: Property.DateTime({
            displayName: 'Ship Date',
            description: 'Defaults to now.',
            required: false,
        }),
        sellerOrderId: Property.ShortText({
            displayName: 'Seller Order ID',
            description: 'Your own order reference, if you want it stored on the shipment.',
            required: false,
        }),
    },
    async run(context) {
        const { carrier, otherCarrier, methodCode, trackingNumber, trackingUrl, shipDateTime, sellerOrderId } = context.propsValue;
        const auth = walmartAuthProps(context.auth);
        const purchaseOrderId = context.propsValue.purchaseOrderId.trim();
        if (carrier === OTHER_CARRIER && (!otherCarrier || !trackingUrl)) {
            throw new Error('With carrier "Other", both Other Carrier Name and Tracking URL are required by Walmart.');
        }
        const lines = await walmartOrderLines.resolveLines({ auth, purchaseOrderId, lines: context.propsValue.lines });
        const trackingInfo = {
            shipDateTime: shipDateTime ? new Date(shipDateTime).getTime() : Date.now(),
            carrierName: carrier === OTHER_CARRIER ? { otherCarrier } : { carrier },
            methodCode,
            trackingNumber,
            ...(trackingUrl ? { trackingURL: trackingUrl } : {}),
        };
        const response = await walmartClient.request<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `/v3/orders/${encodeURIComponent(purchaseOrderId)}/shipping`,
            body: {
                orderShipment: {
                    orderLines: {
                        orderLine: lines.map((line) => ({
                            lineNumber: line.lineNumber,
                            intentToCancelOverride: false,
                            ...(sellerOrderId ? { sellerOrderId } : {}),
                            orderLineStatuses: {
                                orderLineStatus: [{
                                    status: 'Shipped',
                                    statusQuantity: { unitOfMeasurement: 'EACH', amount: String(line.quantity) },
                                    trackingInfo,
                                }],
                            },
                        })),
                    },
                },
            },
        });
        const order = walmartClient.isRecord(response) && walmartClient.isRecord(response['order']) ? response['order'] : null;
        return order ? walmartOrders.flattenOrder({ order }) : { purchase_order_id: purchaseOrderId, shipped_lines: lines.length };
    },
});

