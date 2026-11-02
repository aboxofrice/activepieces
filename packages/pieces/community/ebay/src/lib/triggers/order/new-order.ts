import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { EbayAuthProps } from '../../common/client';
import { FetchOrders, newOrderPoll } from '../../common/new-order-poll';
import { EbayOrder, orderCommon } from '../../common/order';

export const newOrder = createTrigger({
    auth: ebayAuth,
    name: 'order_new_order',
    displayName: 'Order · New Order',
    description: 'Fires once per new order (deduplicated by order ID). Each poll re-checks a short overlap window so orders eBay indexes late are not missed.',
    props: {
        fulfillmentStatus: orderCommon.fulfillmentStatusProp(),
    },
    type: TriggerStrategy.POLLING,
    sampleData: {
        order_id: '12-34567-89012',
        legacy_order_id: '123456789012-1234567890123',
        sales_record_reference: '1234',
        creation_date: '2026-11-01T14:02:11.000Z',
        last_modified_date: '2026-11-01T14:03:00.000Z',
        order_fulfillment_status: 'NOT_STARTED',
        order_payment_status: 'PAID',
        cancel_state: 'NONE_REQUESTED',
        seller_id: 'your_store',
        buyer_username: 'buyer_username',
        buyer_checkout_notes: null,
        ship_to_name: 'Jane Doe',
        ship_to_email: 'abc123@members.ebay.com',
        ship_to_phone: '5555555555',
        ship_to_address_line1: '1 Main St',
        ship_to_address_line2: null,
        ship_to_city: 'Springfield',
        ship_to_state: 'IL',
        ship_to_postal_code: '62701',
        ship_to_country: 'US',
        shipping_service_code: 'USPSPriority',
        ship_by_date: '2026-11-05T07:59:59.000Z',
        currency: 'USD',
        subtotal: 89.99,
        delivery_cost: 0,
        tax: 7.2,
        total: 97.19,
        total_marketplace_fee: 12.4,
        total_due_seller: 77.59,
        line_item_count: 1,
        skus: 'ABC-123',
        line_items: [{
            line_item_id: '10012345678901',
            item_id: '123456789012',
            variation_id: null,
            sku: 'ABC-123',
            title: 'OEM Brake Pad Set',
            quantity: 1,
            line_item_cost: 89.99,
            line_total: 89.99,
            shipping_cost: 0,
            ebay_collected_tax: 7.2,
            ebay_collected_tax_type: 'STATE_SALES_TAX',
            fulfillment_status: 'NOT_STARTED',
        }],
    },
    async onEnable(context) {
        await newOrderPoll.enable({
            store: context.store,
            fetchOrders: buildFetch({ auth: context.auth.props, fulfillmentStatus: context.propsValue.fulfillmentStatus }),
            fingerprint: fingerprint({ fulfillmentStatus: context.propsValue.fulfillmentStatus }),
        });
    },
    // State is kept on purpose: a publish disables and re-enables the trigger, and the
    // store outlives it, so the next enable resumes instead of replaying or skipping.
    async onDisable() {
        return;
    },
    async test(context) {
        const { orders } = await orderCommon.listOrders({
            auth: context.auth.props,
            filter: orderCommon.buildFilter({ dateField: 'creationdate', fulfillmentStatus: context.propsValue.fulfillmentStatus }),
            maxOrders: TEST_ORDERS,
        });
        return orders.map((order) => orderCommon.flattenOrder({ order }));
    },
    async run(context) {
        const orders = await newOrderPoll.poll({
            store: context.store,
            fetchOrders: buildFetch({ auth: context.auth.props, fulfillmentStatus: context.propsValue.fulfillmentStatus }),
            fingerprint: fingerprint({ fulfillmentStatus: context.propsValue.fulfillmentStatus }),
        });
        return orders.map((order) => orderCommon.flattenOrder({ order }));
    },
});

function buildFetch({ auth, fulfillmentStatus }: { auth: EbayAuthProps; fulfillmentStatus: string | undefined }): FetchOrders<EbayOrder> {
    return async ({ fromMs, offset, maxOrders }) => orderCommon.listOrders({
        auth,
        filter: orderCommon.buildFilter({ dateField: 'creationdate', from: new Date(fromMs).toISOString(), fulfillmentStatus }),
        maxOrders,
        offset,
    });
}

function fingerprint({ fulfillmentStatus }: { fulfillmentStatus: string | undefined }): string {
    return `order_new_order:${fulfillmentStatus ?? ''}`;
}

const TEST_ORDERS = 5;
