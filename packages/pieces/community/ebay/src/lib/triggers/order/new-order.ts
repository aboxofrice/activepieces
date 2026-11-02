import { createTrigger, Store, TriggerStrategy } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { EbayAuthProps } from '../../common/client';
import { FlatOrder, orderCommon } from '../../common/order';

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
        seller_id: 'tgpauto',
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
        await context.store.put<TriggerState>(STATE_KEY, { lastPollMs: Date.now(), seenOrderIds: [] });
    },
    async onDisable(context) {
        await context.store.delete(STATE_KEY);
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
        return pollNewOrders({ auth: context.auth.props, store: context.store, fulfillmentStatus: context.propsValue.fulfillmentStatus });
    },
});

async function pollNewOrders({ auth, store, fulfillmentStatus }: { auth: EbayAuthProps; store: Store; fulfillmentStatus: string | undefined }): Promise<FlatOrder[]> {
    const pollStartedMs = Date.now();
    const state = await store.get<TriggerState>(STATE_KEY) ?? { lastPollMs: pollStartedMs, seenOrderIds: [] };
    const { orders } = await orderCommon.listOrders({
        auth,
        filter: orderCommon.buildFilter({
            dateField: 'creationdate',
            from: new Date(state.lastPollMs - OVERLAP_MS).toISOString(),
            fulfillmentStatus,
        }),
        maxOrders: MAX_ORDERS_PER_POLL,
    });
    const seen = new Set(state.seenOrderIds);
    const newOrders = orders
        .filter((order) => !seen.has(order.orderId))
        .sort((a, b) => new Date(a.creationDate ?? 0).getTime() - new Date(b.creationDate ?? 0).getTime());
    // The next window starts later than this one, so every order it can return is in this poll's result set
    // (plus the previously seen ones, kept in case eBay briefly drops an order from the listing).
    await store.put<TriggerState>(STATE_KEY, {
        lastPollMs: pollStartedMs,
        seenOrderIds: [...new Set([...orders.map((order) => order.orderId), ...state.seenOrderIds])].slice(0, MAX_SEEN_IDS),
    });
    return newOrders.map((order) => orderCommon.flattenOrder({ order }));
}

const STATE_KEY = 'ebay_new_order_state';
const OVERLAP_MS = 2 * 60 * 60 * 1000;
const MAX_ORDERS_PER_POLL = 1000;
const MAX_SEEN_IDS = 5000;
const TEST_ORDERS = 5;

type TriggerState = {
    lastPollMs: number;
    seenOrderIds: string[];
};
