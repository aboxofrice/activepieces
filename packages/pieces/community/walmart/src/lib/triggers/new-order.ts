import { createTrigger, Property, TriggerStrategy } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { WalmartAuthProps } from '../common/client';
import { FlatOrder, ORDER_STATUSES, SHIP_NODE_TYPES, walmartOrders } from '../common/orders';
import { SAMPLE_ORDER } from '../common/sample-data';

// Orders can surface in the API some time after their orderDate, so a plain "newer than
// the last poll" cut-off would drop late arrivals. Each poll re-reads a lookback window
// and emits only purchase orders not seen before; the seen set is pruned to the window.
export const newOrder = createTrigger({
    auth: walmartAuth,
    name: 'new_order',
    displayName: 'New Order',
    description: 'Triggers when a new order appears on Walmart.',
    type: TriggerStrategy.POLLING,
    props: {
        status: Property.StaticDropdown({
            displayName: 'Status',
            description: 'Only orders currently in this status. Leave empty for any status; choose Created for orders still to acknowledge.',
            required: false,
            options: { disabled: false, options: ORDER_STATUSES.map((status) => ({ label: status, value: status })) },
        }),
        shipNodeType: Property.StaticDropdown({
            displayName: 'Fulfillment',
            required: false,
            defaultValue: 'SellerFulfilled',
            options: { disabled: false, options: SHIP_NODE_TYPES.map((type) => ({ label: type, value: type })) },
        }),
        lookbackHours: Property.Number({
            displayName: 'Lookback Window (hours)',
            description: 'How far back each check looks for orders that arrived late. Larger is safer but slower.',
            required: false,
            defaultValue: 24,
        }),
    },
    sampleData: SAMPLE_ORDER,
    async onEnable(context) {
        const orders = await fetchWindow({ auth: walmartAuthProps(context.auth), props: context.propsValue });
        await context.store.put(SEEN_KEY, seenFrom({ orders, previous: {}, lookbackHours: lookbackOf({ props: context.propsValue }) }));
    },
    async onDisable(context) {
        await context.store.delete(SEEN_KEY);
    },
    async test(context) {
        const orders = await walmartOrders.listOrders({
            auth: walmartAuthProps(context.auth),
            filters: { status: context.propsValue.status ?? undefined, shipNodeType: context.propsValue.shipNodeType ?? undefined },
            maxOrders: TEST_ORDER_COUNT,
        });
        return orders.map((order) => walmartOrders.flattenOrder({ order }));
    },
    async run(context) {
        const previous = (await context.store.get<SeenOrders>(SEEN_KEY)) ?? {};
        const orders = await fetchWindow({ auth: walmartAuthProps(context.auth), props: context.propsValue });
        const fresh = orders
            .filter((order) => order.purchase_order_id && previous[order.purchase_order_id] === undefined)
            .sort((a, b) => (a.order_date_epoch_ms ?? 0) - (b.order_date_epoch_ms ?? 0));
        await context.store.put(SEEN_KEY, seenFrom({ orders, previous, lookbackHours: lookbackOf({ props: context.propsValue }) }));
        return fresh;
    },
});

async function fetchWindow({ auth, props }: { auth: WalmartAuthProps; props: TriggerProps }): Promise<FlatOrder[]> {
    const start = new Date(Date.now() - lookbackOf({ props }) * HOUR_MS).toISOString();
    const orders = await walmartOrders.listOrders({
        auth,
        filters: { createdStartDate: start, status: props.status ?? undefined, shipNodeType: props.shipNodeType ?? undefined },
        maxOrders: MAX_ORDERS_PER_POLL,
    });
    return orders.map((order) => walmartOrders.flattenOrder({ order }));
}

function seenFrom({ orders, previous, lookbackHours }: { orders: FlatOrder[]; previous: SeenOrders; lookbackHours: number }): SeenOrders {
    const keepAfter = Date.now() - (lookbackHours * HOUR_MS + SEEN_GRACE_MS);
    const kept = Object.entries(previous).filter(([, orderDate]) => orderDate >= keepAfter);
    const added = orders
        .filter((order) => order.purchase_order_id)
        .map((order): [string, number] => [order.purchase_order_id, order.order_date_epoch_ms ?? Date.now()]);
    return Object.fromEntries([...kept, ...added]);
}

function lookbackOf({ props }: { props: TriggerProps }): number {
    const hours = props.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
    return Math.min(MAX_LOOKBACK_HOURS, Math.max(1, hours));
}

const SEEN_KEY = 'walmart_new_order_seen';
const HOUR_MS = 60 * 60 * 1000;
const SEEN_GRACE_MS = 6 * HOUR_MS;
const DEFAULT_LOOKBACK_HOURS = 24;
const MAX_LOOKBACK_HOURS = 24 * 7;
const MAX_ORDERS_PER_POLL = 2000;
const TEST_ORDER_COUNT = 5;

type SeenOrders = Record<string, number>;

type TriggerProps = {
    status?: string;
    shipNodeType?: string;
    lookbackHours?: number;
};
