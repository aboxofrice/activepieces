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
            description: 'A positive whole number identifying this package within the order (1, 2, 3...). Required when you list items; use a different number per package. Defaults to 1 when shipping a whole, not-yet-shipped order.',
            required: false,
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
        const resolved = await resolveItems({ auth, orderId, items: context.propsValue.items });
        if (resolved.items.length === 0) {
            throw new Error(`Nothing left to ship on order ${orderId}: every item is already shipped (or the order has no items).`);
        }
        const packageReference = resolvePackageReference({ given: packageReferenceId, explicitItems: resolved.explicit, partlyShipped: resolved.partlyShipped });
        const orderItems = resolved.items;
        await spApiClient.request<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `/orders/v0/orders/${encodeURIComponent(orderId)}/shipmentConfirmation`,
            body: {
                marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
                packageDetail: {
                    packageReferenceId: packageReference,
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
            package_reference_id: packageReference,
            items: orderItems,
        };
    },
});

async function resolveItems({ auth, orderId, items }: ResolveItemsParams): Promise<ResolvedItems> {
    const given = (items ?? []).filter(spApiClient.isRecord).map((item, index) => parseItem({ item, index }));
    if (given.length > 0) {
        return { items: given, explicit: true, partlyShipped: false };
    }
    const all = await amazonOrders.getOrderItems({ auth, orderId });
    return {
        items: all
            .map((item) => ({ orderItemId: item.OrderItemId, quantity: (item.QuantityOrdered ?? 0) - (item.QuantityShipped ?? 0) }))
            .filter((item) => item.quantity > 0),
        explicit: false,
        partlyShipped: all.some((item) => (item.QuantityShipped ?? 0) > 0),
    };
}

function parseItem({ item, index }: { item: Record<string, unknown>; index: number }): { orderItemId: string; quantity: number } {
    const orderItemId = String(item['orderItemId'] ?? '').trim();
    const quantity = Number(item['quantity']);
    if (!orderItemId) {
        throw new Error(`Item ${index + 1} has no Order Item ID.`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Item ${orderItemId} has quantity "${String(item['quantity'] ?? '')}"; it must be a positive whole number.`);
    }
    return { orderItemId, quantity };
}

// Amazon only accepts positive numeric package references, and two packages of one order
// must not share one, so "1" is assumed only for the first shipment of a whole order.
function resolvePackageReference({ given, explicitItems, partlyShipped }: { given: string | undefined | null; explicitItems: boolean; partlyShipped: boolean }): string {
    const value = given?.trim() ?? '';
    if (value) {
        if (!/^[1-9]\d*$/.test(value)) {
            throw new Error(`Package Reference "${value}" must be a positive whole number (1, 2, 3...).`);
        }
        return value;
    }
    if (explicitItems) {
        throw new Error('Package Reference is required when you list the items in the package.');
    }
    if (partlyShipped) {
        throw new Error('Part of this order is already shipped; set Package Reference to a number not used by an earlier package.');
    }
    return '1';
}

type ResolveItemsParams = {
    auth: ReturnType<typeof amazonSellerAuthProps>;
    orderId: string;
    items: unknown[] | undefined | null;
};

type ResolvedItems = {
    items: { orderItemId: string; quantity: number }[];
    explicit: boolean;
    partlyShipped: boolean;
};
