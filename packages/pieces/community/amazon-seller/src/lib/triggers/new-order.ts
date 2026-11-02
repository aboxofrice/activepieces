import { createTrigger, Property, Store, TriggerStrategy } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { AmazonSellerAuthProps } from '../common/client';
import { amazonOrders, FlatOrder, FULFILLMENT_CHANNELS, ORDER_STATUSES } from '../common/orders';
import { amazonProps } from '../common/props';

// Declared before createTrigger, which reads it while the module is still evaluating.
const SAMPLE_ORDER: FlatOrder = {
    amazon_order_id: '113-1234567-1234567',
    seller_order_id: '113-1234567-1234567',
    marketplace_id: 'ATVPDKIKX0DER',
    purchase_date: '2026-10-30T18:12:45Z',
    last_update_date: '2026-10-30T18:44:10Z',
    order_status: 'Unshipped',
    fulfillment_channel: 'MFN',
    sales_channel: 'Amazon.com',
    order_type: 'StandardOrder',
    order_total_amount: '89.99',
    order_total_currency: 'USD',
    number_of_items_shipped: 0,
    number_of_items_unshipped: 1,
    payment_method: 'Other',
    ship_service_level: 'Std US D2D Dom',
    shipment_service_level_category: 'Standard',
    earliest_ship_date: '2026-10-31T07:00:00Z',
    latest_ship_date: '2026-11-03T06:59:59Z',
    earliest_delivery_date: '2026-11-04T07:00:00Z',
    latest_delivery_date: '2026-11-08T07:59:59Z',
    is_prime: false,
    is_business_order: false,
    is_premium_order: false,
    is_replacement_order: false,
    ship_city: 'AUSTIN',
    ship_state: 'TX',
    ship_postal_code: '78701-1234',
    ship_country_code: 'US',
};

// pollingHelper's strategies don't fit Amazon: orders become visible minutes after their
// PurchaseDate (so a TIMEBASED cursor on PurchaseDate skips them), and an order filtered on
// "Unshipped" first matches hours later when payment clears (so a LAST_ITEM cursor misses it).
// Instead each poll re-reads everything updated since the last poll, with an overlap, and
// emits orders placed after the trigger was enabled that haven't been emitted before.
export const newOrder = createTrigger({
    auth: amazonSellerAuth,
    name: 'new_order',
    displayName: 'New Order',
    description: 'Triggers when a new Amazon order is placed (or first reaches one of the selected statuses).',
    type: TriggerStrategy.POLLING,
    props: {
        orderStatuses: Property.StaticMultiSelectDropdown({
            displayName: 'Only Orders With Status',
            description: 'Leave empty to fire as soon as the order appears (usually Pending). Pick Unshipped to wait until payment is confirmed and the order can be shipped.',
            required: false,
            options: { options: ORDER_STATUSES },
        }),
        fulfillmentChannels: Property.StaticMultiSelectDropdown({
            displayName: 'Fulfillment Channels',
            description: 'Leave empty for both FBA and merchant-fulfilled orders.',
            required: false,
            options: { options: FULFILLMENT_CHANNELS },
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    sampleData: SAMPLE_ORDER,
    async onEnable(context) {
        const now = Date.now();
        await context.store.put(ENABLED_AT_KEY, now);
        await context.store.put(LAST_POLL_KEY, now);
        await context.store.put(SEEN_KEY, {});
    },
    async onDisable(context) {
        await context.store.delete(ENABLED_AT_KEY);
        await context.store.delete(LAST_POLL_KEY);
        await context.store.delete(SEEN_KEY);
    },
    async test(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const orders = await amazonOrders.listOrders({
            auth,
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
            filters: {
                CreatedAfter: new Date(Date.now() - TEST_LOOKBACK_MS).toISOString(),
                OrderStatuses: context.propsValue.orderStatuses ?? undefined,
                FulfillmentChannels: context.propsValue.fulfillmentChannels ?? undefined,
            },
            maxRows: TEST_SAMPLE_SIZE,
        });
        return orders.map((order) => amazonOrders.flattenOrder({ order }));
    },
    async run(context) {
        return pollNewOrders({
            auth: amazonSellerAuthProps(context.auth),
            store: context.store,
            marketplaceOverride: context.propsValue.marketplaceId,
            orderStatuses: context.propsValue.orderStatuses ?? [],
            fulfillmentChannels: context.propsValue.fulfillmentChannels ?? [],
        });
    },
});

async function pollNewOrders({ auth, store, marketplaceOverride, orderStatuses, fulfillmentChannels }: PollParams): Promise<FlatOrder[]> {
    const now = Date.now();
    const enabledAt = (await store.get<number>(ENABLED_AT_KEY)) ?? now;
    const lastPoll = (await store.get<number>(LAST_POLL_KEY)) ?? now;
    const seen = (await store.get<Record<string, number>>(SEEN_KEY)) ?? {};
    const earliestPurchase = Math.max(enabledAt, now - SEEN_RETENTION_MS);

    const orders = await amazonOrders.listOrders({
        auth,
        marketplaceId: amazonProps.resolveMarketplace({ auth, override: marketplaceOverride }),
        filters: {
            LastUpdatedAfter: new Date(lastPoll - POLL_OVERLAP_MS).toISOString(),
            OrderStatuses: orderStatuses,
            FulfillmentChannels: fulfillmentChannels,
        },
    });

    const fresh = orders.filter((order) => {
        const purchasedAt = Date.parse(order.PurchaseDate ?? '');
        return !Number.isNaN(purchasedAt) && purchasedAt >= earliestPurchase && seen[order.AmazonOrderId] === undefined;
    });
    const nextSeen = Object.fromEntries([
        ...Object.entries(seen).filter(([, purchasedAt]) => purchasedAt >= now - SEEN_RETENTION_MS),
        ...fresh.map((order): [string, number] => [order.AmazonOrderId, Date.parse(order.PurchaseDate ?? '')]),
    ]);
    await store.put(SEEN_KEY, nextSeen);
    await store.put(LAST_POLL_KEY, now);

    return [...fresh]
        .sort((a, b) => Date.parse(a.PurchaseDate ?? '') - Date.parse(b.PurchaseDate ?? ''))
        .map((order) => amazonOrders.flattenOrder({ order }));
}

const ENABLED_AT_KEY = 'amazon_new_order_enabled_at';
const LAST_POLL_KEY = 'amazon_new_order_last_poll';
const SEEN_KEY = 'amazon_new_order_seen';
const POLL_OVERLAP_MS = 30 * 60 * 1000;
const SEEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TEST_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const TEST_SAMPLE_SIZE = 5;


type PollParams = {
    auth: AmazonSellerAuthProps;
    store: Store;
    marketplaceOverride: string | undefined | null;
    orderStatuses: string[];
    fulfillmentChannels: string[];
};
