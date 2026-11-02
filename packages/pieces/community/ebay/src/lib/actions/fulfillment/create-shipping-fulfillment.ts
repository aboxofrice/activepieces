import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { orderCommon } from '../../common/order';

export const createShippingFulfillment = createAction({
    auth: ebayAuth,
    name: 'fulfillment_create_shipping_fulfillment',
    displayName: 'Fulfillment · Add Tracking (Mark Shipped)',
    description: 'Upload a tracking number for an order (or some of its line items). eBay marks those items shipped and notifies the buyer.',
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
            description: 'Optional comma-separated line item IDs (line_items[].line_item_id from Get Order). Leave empty to ship every line item in full.',
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
        const order = await orderCommon.getOrder({ auth, orderId });
        const wanted = (lineItemIds ?? '').split(',').map((id) => id.trim()).filter((id) => id !== '');
        const lineItems = (order.lineItems ?? [])
            .filter((lineItem) => wanted.length === 0 || (lineItem.lineItemId !== undefined && wanted.includes(lineItem.lineItemId)))
            .map((lineItem) => ({ lineItemId: lineItem.lineItemId, quantity: lineItem.quantity }));
        if (lineItems.length === 0 || lineItems.length < wanted.length) {
            throw new Error(`Order ${orderId} has no line item(s) matching "${lineItemIds ?? ''}".`);
        }
        await ebayClient.request<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `${orderCommon.fulfillmentPath}/order/${encodeURIComponent(order.orderId)}/shipping_fulfillment`,
            body: {
                lineItems,
                shippedDate: new Date(shippedDate ?? Date.now()).toISOString(),
                shippingCarrierCode: carrierCode,
                trackingNumber: trackingNumber.trim(),
            },
        });
        const fulfillments = await orderCommon.listShippingFulfillments({ auth, orderId: order.orderId });
        return {
            order_id: order.orderId,
            tracking_number: trackingNumber.trim(),
            carrier: carrierCode,
            line_item_ids: lineItems.map((lineItem) => lineItem.lineItemId).join(', '),
            fulfillments,
        };
    },
});
