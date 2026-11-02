import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { fulfillmentCommon } from '../../common/fulfillment';
import { orderCommon } from '../../common/order';

export const createShippingFulfillment = createAction({
    auth: ebayAuth,
    name: 'fulfillment_create_shipping_fulfillment',
    displayName: 'Fulfillment · Add Tracking (Mark Shipped)',
    description: 'Upload a tracking number for an order (or some of its line items). eBay marks those items shipped and notifies the buyer. Safe to retry: lines already shipped are skipped, and an existing fulfillment with the same tracking number is returned instead of creating a duplicate.',
    props: {
        orderId: Property.ShortText({
            displayName: 'Order ID',
            description: 'The eBay order number, e.g. 12-34567-89012.',
            required: true,
        }),
        carrier: Property.StaticDropdown({
            displayName: 'Carrier',
            required: true,
            defaultValue: 'USPS',
            options: {
                options: [
                    { label: 'USPS', value: 'USPS' },
                    { label: 'UPS', value: 'UPS' },
                    { label: 'FedEx', value: 'FEDEX' },
                    { label: 'DHL', value: 'DHL' },
                    { label: 'Other (enter code below)', value: 'OTHER' },
                ],
            },
        }),
        otherCarrierCode: Property.ShortText({
            displayName: 'Other Carrier Code',
            description: 'Only when Carrier is Other: eBay\'s carrier code, e.g. ONTRAC, LASERSHIP.',
            required: false,
        }),
        trackingNumber: Property.ShortText({
            displayName: 'Tracking Number',
            required: true,
        }),
        lineItemIds: Property.ShortText({
            displayName: 'Line Item IDs',
            description: 'Optional comma-separated line item IDs (line_items[].line_item_id from Get Order). Leave empty to ship every line item not yet shipped.',
            required: false,
        }),
        shippedDate: Property.DateTime({
            displayName: 'Shipped Date',
            description: 'Defaults to now.',
            required: false,
        }),
    },
    async run(context) {
        const { orderId, carrier, otherCarrierCode, trackingNumber, lineItemIds, shippedDate } = context.propsValue;
        const auth = context.auth.props;
        const carrierCode = carrier === 'OTHER' ? otherCarrierCode?.trim() : carrier;
        if (!carrierCode) {
            throw new Error('Enter the Other Carrier Code.');
        }
        const tracking = trackingNumber.trim();
        const order = await orderCommon.getOrder({ auth, orderId });
        const existing = await orderCommon.listRawShippingFulfillments({ auth, orderId: order.orderId });
        const plan = fulfillmentCommon.plan({ order, existing, wantedLineItemIds: (lineItemIds ?? '').split(','), trackingNumber: tracking });
        if (plan.kind === 'no_matching_lines') {
            throw new Error(`Order ${orderId} has no line item(s) matching "${lineItemIds ?? ''}".`);
        }
        if (plan.kind === 'already_shipped') {
            const trackingNumbers = plan.existing.map((fulfillment) => fulfillment.shipmentTrackingNumber).filter((value): value is string => !!value);
            throw new Error(`Order ${order.orderId}: the selected line items are already fully shipped${trackingNumbers.length > 0 ? ` (tracking ${trackingNumbers.join(', ')})` : ''}. Nothing was sent to eBay.`);
        }
        if (plan.kind === 'already_exists') {
            return {
                order_id: order.orderId,
                tracking_number: tracking,
                carrier: plan.fulfillment.shippingCarrierCode ?? carrierCode,
                fulfillment_id: plan.fulfillment.fulfillmentId ?? null,
                created: false,
                already_existed: true,
                line_item_ids: (plan.fulfillment.lineItems ?? []).map((lineItem) => lineItem.lineItemId).filter((id): id is string => !!id).join(', '),
                fulfillments: existing.map((fulfillment) => orderCommon.flattenShippingFulfillment({ fulfillment })),
                fulfillments_error: null,
            };
        }
        const response = await ebayClient.requestWithHeaders<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `${orderCommon.fulfillmentPath}/order/${encodeURIComponent(order.orderId)}/shipping_fulfillment`,
            body: {
                lineItems: plan.lineItems,
                shippedDate: new Date(shippedDate ?? Date.now()).toISOString(),
                shippingCarrierCode: carrierCode,
                trackingNumber: tracking,
            },
        });
        // The tracking is on eBay now; failing the step here would invite a retry that the
        // tracking-number check above has to catch, so report the read failure instead.
        const { data: fulfillments, error } = await tryCatch(() => orderCommon.listShippingFulfillments({ auth, orderId: order.orderId }));
        return {
            order_id: order.orderId,
            tracking_number: tracking,
            carrier: carrierCode,
            fulfillment_id: fulfillmentCommon.fulfillmentIdFromLocation({ headers: response.headers }),
            created: true,
            already_existed: false,
            line_item_ids: plan.lineItems.map((lineItem) => lineItem.lineItemId).join(', '),
            fulfillments: fulfillments ?? null,
            fulfillments_error: error ? error.message : null,
        };
    },
});
