import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { isNil } from '@activepieces/shared';
import { sellercloudAuth, sellercloudAuthProps } from '../auth';
import { sellercloudClient } from '../common/client';
import { sellercloudDropdowns } from '../common/dropdowns';
import { tenantTime } from '../common/tenant-time';

export const shipOrder = createAction({
    auth: sellercloudAuth,
    name: 'ship_order',
    displayName: 'Ship Order with Tracking',
    description: 'Mark a sales order as shipped with its carrier, service and tracking number. SellerCloud applies the update asynchronously.',
    props: {
        orderId: Property.Number({
            displayName: 'Order ID',
            description: 'The SellerCloud order ID (not the channel order number).',
            required: true,
        }),
        carrier: sellercloudDropdowns.shippingCarrier,
        service: sellercloudDropdowns.shippingService,
        trackingNumber: Property.ShortText({
            displayName: 'Tracking Number',
            required: true,
        }),
        shipDate: Property.DateTime({
            displayName: 'Ship Date',
            description: 'Defaults to now. Sent to SellerCloud in the account\'s local time.',
            required: false,
        }),
        shippingCost: Property.Number({
            displayName: 'Shipping Cost',
            required: false,
        }),
        shipFromWarehouse: sellercloudDropdowns.warehouse({ required: false, description: 'The warehouse the order shipped from. Leave empty to keep the order\'s warehouse.' }),
    },
    async run(context) {
        const { orderId, carrier, service, trackingNumber, shipDate, shippingCost, shipFromWarehouse } = context.propsValue;
        const date = shipDate ? new Date(shipDate) : new Date();
        if (Number.isNaN(date.getTime())) {
            throw new Error(`SellerCloud: "${shipDate}" is not a valid ship date.`);
        }
        const body = {
            OrderID: orderId,
            ShippingCarrier: carrier,
            ShippingService: service,
            TrackingNumber: trackingNumber.trim(),
            ShipDate: tenantTime.toTenantLocal({ date }),
            ...(isNil(shippingCost) ? {} : { ShippingCost: shippingCost }),
            ...(isNil(shipFromWarehouse) ? {} : { ShipFromWarehouseID: Number(shipFromWarehouse) }),
        };
        const response = await sellercloudClient.request<unknown>({
            auth: sellercloudAuthProps(context.auth),
            store: context.store,
            method: HttpMethod.PUT,
            path: '/Orders/ShippingStatus',
            body,
        });
        return {
            success: true,
            order_id: orderId,
            carrier,
            service,
            tracking_number: body.TrackingNumber,
            ship_date: body.ShipDate,
            note: 'SellerCloud applies shipping updates asynchronously; the order may take up to a minute to show as shipped.',
            response: response ?? null,
        };
    },
});
