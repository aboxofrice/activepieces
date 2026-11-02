import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { spApiDocuments } from '../common/documents';
import { amazonOrders } from '../common/orders';
import { amazonProps } from '../common/props';

// Declared before createAction, which reads it while the module is still evaluating.
const CANCEL_REASONS = [
    { label: 'Out of stock', value: 'NoInventory' },
    { label: 'Buyer requested cancellation', value: 'BuyerCanceled' },
    { label: 'Shipping address undeliverable', value: 'ShippingAddressUndeliverable' },
    { label: 'Customer exchange', value: 'CustomerExchange' },
    { label: 'General adjustment', value: 'GeneralAdjustment' },
];

export const cancelOrder = createAction({
    auth: amazonSellerAuth,
    name: 'cancel_order',
    displayName: 'Cancel Order',
    description: "Cancel an unshipped merchant-fulfilled order (or some of its items). SP-API has no direct cancel call, so this submits an order-acknowledgement feed; Amazon processes it within minutes. Use Get Feed Status with the returned feed ID to see the outcome.",
    props: {
        orderId: amazonProps.amazonOrderId(),
        reason: Property.StaticDropdown({
            displayName: 'Reason',
            required: true,
            defaultValue: 'NoInventory',
            options: { options: CANCEL_REASONS },
        }),
        orderItemIds: Property.Array({
            displayName: 'Order Item IDs',
            description: 'Leave empty to cancel every item of the order.',
            required: false,
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const sellerId = amazonProps.requireSellerId({ auth });
        const orderId = context.propsValue.orderId.trim();
        const given = (context.propsValue.orderItemIds ?? []).map((value) => String(value).trim()).filter((value) => value.length > 0);
        const itemIds = given.length > 0 ? given : (await amazonOrders.getOrderItems({ auth, orderId })).map((item) => item.OrderItemId);
        if (itemIds.length === 0) {
            throw new Error(`Order ${orderId} has no items to cancel.`);
        }
        const feedId = await spApiDocuments.submitFeed({
            auth,
            feedType: 'POST_ORDER_ACKNOWLEDGEMENT_DATA',
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
            contentType: 'text/xml; charset=UTF-8',
            content: cancellationXml({ sellerId, orderId, itemIds, reason: context.propsValue.reason }),
        });
        return { amazon_order_id: orderId, feed_id: feedId, cancelled_item_ids: itemIds.join(', '), reason: context.propsValue.reason, status: 'SUBMITTED' };
    },
});

function cancellationXml({ sellerId, orderId, itemIds, reason }: { sellerId: string; orderId: string; itemIds: string[]; reason: string }): string {
    const esc = (value: string) => spApiDocuments.escapeXml({ value });
    const items = itemIds
        .map((id) => `<Item><AmazonOrderItemCode>${esc(id)}</AmazonOrderItemCode><CancelReason>${esc(reason)}</CancelReason></Item>`)
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
<Header><DocumentVersion>1.01</DocumentVersion><MerchantIdentifier>${esc(sellerId)}</MerchantIdentifier></Header>
<MessageType>OrderAcknowledgement</MessageType>
<Message><MessageID>1</MessageID><OrderAcknowledgement><AmazonOrderID>${esc(orderId)}</AmazonOrderID><StatusCode>Failure</StatusCode>${items}</OrderAcknowledgement></Message>
</AmazonEnvelope>`;
}
