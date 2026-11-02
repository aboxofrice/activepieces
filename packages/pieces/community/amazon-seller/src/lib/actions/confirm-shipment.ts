import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { spApiClient } from '../common/client';
import { amazonOrders } from '../common/orders';
import { amazonProps } from '../common/props';

// Declared before createAction, which reads it while the module is still evaluating.
const CARRIERS = [
    { label: 'USPS', value: 'USPS' },
    { label: 'UPS', value: 'UPS' },
    { label: 'FedEx', value: 'FedEx' },
    { label: 'DHL', value: 'DHL' },
    { label: 'OnTrac', value: 'OnTrac' },
    { label: 'Amazon Shipping', value: 'Amazon Shipping' },
    { label: 'Other (enter Carrier Name)', value: 'Other' },
];

export const confirmShipment = createAction({
    auth: amazonSellerAuth,
    name: 'confirm_shipment',
    displayName: 'Confirm Shipment (Add Tracking)',
    description: 'Mark a merchant-fulfilled order (or some of its items) as shipped and upload the tracking number. The buyer is notified by Amazon.',
    props: {
        orderId: amazonProps.amazonOrderId(),
        carrierCode: Property.StaticDropdown({
            displayName: 'Carrier',
            required: true,
            defaultValue: 'USPS',
            options: { options: CARRIERS },
        }),
        carrierName: Property.ShortText({
            displayName: 'Carrier Name',
            description: 'Required when Carrier is Other.',
            required: false,
        }),
        shippingMethod: Property.ShortText({
            displayName: 'Shipping Service',
            description: 'e.g. Ground Advantage, Priority Mail, FedEx Ground.',
            required: false,
        }),
        trackingNumber: Property.ShortText({ displayName: 'Tracking Number', required: true }),
        shipDate: Property.DateTime({
            displayName: 'Ship Date',
            description: 'Defaults to now.',
            required: false,
        }),
        items: Property.Array({
            displayName: 'Items in This Package',
            description: 'Leave empty to ship every item of the order in full.',
            required: false,
            properties: {
                orderItemId: Property.ShortText({ displayName: 'Order Item ID', required: true }),
                quantity: Property.Number({ displayName: 'Quantity', required: true }),
            },
        }),
        packageReferenceId: Property.ShortText({
            displayName: 'Package Reference',
            description: 'Your ID for this package; use a different value per package when an order ships in several.',
            required: false,
            defaultValue: '1',
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const { carrierCode, carrierName, shippingMethod, trackingNumber, shipDate, packageReferenceId } = context.propsValue;
        const orderId = context.propsValue.orderId.trim();
        if (carrierCode === 'Other' && !carrierName?.trim()) {
            throw new Error('Carrier Name is required when Carrier is Other.');
        }
        const orderItems = await resolveItems({ auth, orderId, items: context.propsValue.items });
        await spApiClient.request<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `/orders/v0/orders/${encodeURIComponent(orderId)}/shipmentConfirmation`,
            body: {
                marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
                packageDetail: {
                    packageReferenceId: packageReferenceId?.trim() || '1',
                    carrierCode,
                    ...(carrierName?.trim() ? { carrierName: carrierName.trim() } : {}),
                    ...(shippingMethod?.trim() ? { shippingMethod: shippingMethod.trim() } : {}),
                    trackingNumber: trackingNumber.trim(),
                    shipDate: (shipDate ? new Date(shipDate) : new Date()).toISOString(),
                    orderItems,
                },
            },
        });
        return {
            amazon_order_id: orderId,
            confirmed: true,
            carrier: carrierCode === 'Other' ? carrierName : carrierCode,
            tracking_number: trackingNumber.trim(),
            items: orderItems,
        };
    },
});

async function resolveItems({ auth, orderId, items }: ResolveItemsParams): Promise<{ orderItemId: string; quantity: number }[]> {
    const given = (items ?? []).filter(isItemInput).map((item) => ({ orderItemId: String(item['orderItemId']).trim(), quantity: Number(item['quantity']) }));
    if (given.length > 0) {
        return given;
    }
    const all = await amazonOrders.getOrderItems({ auth, orderId });
    return all
        .map((item) => ({ orderItemId: item.OrderItemId, quantity: (item.QuantityOrdered ?? 0) - (item.QuantityShipped ?? 0) }))
        .filter((item) => item.quantity > 0);
}

function isItemInput(value: unknown): value is Record<string, unknown> {
    return spApiClient.isRecord(value) && value['orderItemId'] !== undefined && value['orderItemId'] !== '' && Number(value['quantity']) > 0;
}


type ResolveItemsParams = {
    auth: ReturnType<typeof amazonSellerAuthProps>;
    orderId: string;
    items: unknown[] | undefined | null;
};
