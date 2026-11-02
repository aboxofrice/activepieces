import { createTrigger, Property, TriggerStrategy } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { turn14Auth, turn14AuthProps } from '../auth';
import { Turn14AuthProps, turn14Client } from '../common/client';
import { turn14Orders } from '../common/orders';
import { turn14Polling } from '../common/polling';

export const orderShipped = createTrigger({
    auth: turn14Auth,
    name: 'order_shipped',
    displayName: 'Order Shipped',
    description: 'Fires once per new Turn14 tracking number (from /v1/tracking), with the carrier service, Turn14 order/invoice and your PO number. Use the PO number to match the shipment back to your marketplace or SellerCloud order. State survives a republish; after the flow has been off for more than 15 minutes it starts fresh.',
    props: {
        includeOrderDetails: Property.Checkbox({
            displayName: 'Include Order Details',
            description: 'Also fetch the Turn14 order (status, lines, totals) for each shipment - one extra request per shipment.',
            required: false,
            defaultValue: false,
        }),
    },
    type: TriggerStrategy.POLLING,
    sampleData: {
        tracking_id: '9876543',
        tracking_number: '1Z999AA10123456784',
        service: 'FedEx Ground',
        order_id: '7654321',
        order_number: 'SO7654321',
        invoice_id: '1234567',
        invoice_number: 'INV1234567',
        purchase_order_number: 'PO-1001',
    },
    async onEnable(context) {
        const now = Date.now();
        if (await turn14Polling.resumeAfterRepublish({ store: context.store, now }) && await turn14Polling.readState({ store: context.store, key: STATE_KEY, isValid: isState }) !== null) {
            return;
        }
        const shipments = await recentShipments({ auth: turn14AuthProps(context.auth), now });
        await context.store.put(STATE_KEY, { seen: Object.fromEntries(shipments.map((shipment) => [keyOf({ shipment }), now])) });
    },
    async onDisable(context) {
        await turn14Polling.markDisabled({ store: context.store, now: Date.now() });
    },
    async test(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const shipments = await turn14Orders.getTracking({
            auth,
            startDate: turn14Orders.isoDate({ epochMs: now - TEST_LOOKBACK_DAYS * turn14Orders.DAY_MS }),
            endDate: turn14Orders.isoDate({ epochMs: now }),
        });
        const rows = shipments.map((tracking) => turn14Orders.flattenTracking({ tracking })).slice(-TEST_LIMIT);
        return withOrderDetails({ auth, rows, include: context.propsValue.includeOrderDetails === true });
    },
    async run(context) {
        const auth = turn14AuthProps(context.auth);
        const now = Date.now();
        const state = await turn14Polling.readState({ store: context.store, key: STATE_KEY, isValid: isState });
        const keepAfter = now - SEEN_RETENTION_DAYS * turn14Orders.DAY_MS;
        const seen = Object.fromEntries(Object.entries(state?.seen ?? {}).filter(([, at]) => at >= keepAfter));
        const shipments = await recentShipments({ auth, now });
        const fresh = shipments.filter((shipment) => seen[keyOf({ shipment })] === undefined);
        await context.store.put(STATE_KEY, { seen: { ...seen, ...Object.fromEntries(fresh.map((shipment) => [keyOf({ shipment }), now])) } });
        return withOrderDetails({ auth, rows: fresh, include: context.propsValue.includeOrderDetails === true });
    },
});

async function recentShipments({ auth, now }: { auth: Turn14AuthProps; now: number }): Promise<Record<string, unknown>[]> {
    const shipments = await turn14Orders.getTracking({
        auth,
        startDate: turn14Orders.isoDate({ epochMs: now - LOOKBACK_DAYS * turn14Orders.DAY_MS }),
        endDate: turn14Orders.isoDate({ epochMs: now }),
    });
    return shipments.map((tracking) => turn14Orders.flattenTracking({ tracking }));
}

async function withOrderDetails({ auth, rows, include }: { auth: Turn14AuthProps; rows: Record<string, unknown>[]; include: boolean }): Promise<Record<string, unknown>[]> {
    if (!include) {
        return rows;
    }
    return rows.reduce<Promise<Record<string, unknown>[]>>(async (previous, row) => {
        const collected = await previous;
        const orderId = typeof row['order_id'] === 'string' ? row['order_id'] : null;
        if (!orderId) {
            return [...collected, row];
        }
        const { data, error } = await tryCatch(() => turn14Orders.getOrder({ auth, orderId }));
        const order = data ? turn14Orders.flattenOrder({ order: data }) : null;
        return [...collected, {
            ...row,
            order_status: order?.['status'] ?? null,
            order_date: order?.['date'] ?? null,
            order_total: order?.['total'] ?? null,
            order_open_quantity: order?.['open_quantity'] ?? null,
            order_lines: order?.['lines'] ?? [],
            order_error: error ? error.message : null,
        }];
    }, Promise.resolve([]));
}

function keyOf({ shipment }: { shipment: Record<string, unknown> }): string {
    return `${String(shipment['tracking_id'])}|${String(shipment['tracking_number'] ?? '')}`;
}

function isState(value: unknown): value is { seen: Record<string, number> } {
    return turn14Client.isRecord(value) && turn14Client.isRecord(value['seen']);
}

// Turn14 serves tracking in windows of at most 3 days.
const LOOKBACK_DAYS = 3;
const TEST_LOOKBACK_DAYS = 14;
const SEEN_RETENTION_DAYS = 10;
const TEST_LIMIT = 5;
const STATE_KEY = 'turn14_order_shipped_state';
