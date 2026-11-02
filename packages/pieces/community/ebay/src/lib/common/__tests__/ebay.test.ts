import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { cancelOrder } from '../../actions/cancellation/cancel-order';
import { cancellationCommon } from '../cancellation';
import { ebayClient } from '../client';
import { fulfillmentCommon } from '../fulfillment';
import { inventoryCommon } from '../inventory';
import { FetchOrders, NewOrderStore, newOrderPoll, PolledOrder } from '../new-order-poll';
import { EbayOrder } from '../order';

describe('ebayClient secrets', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('never puts the refresh token in a failed token error or in any log line', async () => {
        const auth = { appId: 'app-1', certId: 'cert-secret-1', refreshToken: 'v^1.1#i^1#SECRET-REFRESH', environment: 'production' };
        const logged = captureConsole();
        const sendRequest = vi.spyOn(httpClient, 'sendRequest');
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 400, body: { error: 'invalid_grant', error_description: 'the provided authorization refresh token is invalid' } })));
        const { error } = await ebayClient.tryGetAccessToken({ auth });
        const thrown = await ebayClient.request({ auth, method: HttpMethod.GET, path: '/sell/fulfillment/v1/order' }).catch((caught: unknown) => caught);
        const message = thrown instanceof Error ? thrown.message : String(thrown);
        for (const text of [error ?? '', message, ...logged()]) {
            expect(text).not.toContain('SECRET-REFRESH');
            expect(text).not.toContain(encodeURIComponent(auth.refreshToken));
            expect(text).not.toContain('refresh_token=');
            expect(text).not.toContain(auth.certId);
        }
        expect(error).toContain('400');
        expect(message).toContain('invalid_grant');
        expect(sendRequest).not.toHaveBeenCalled();
    });

    it('caches the application token per connection until it expires', async () => {
        const auth = { appId: 'app-cache', certId: 'cert-cache', refreshToken: 'r', environment: 'production' };
        const fetchMock = vi.fn(async () => jsonResponse({ status: 200, body: { access_token: 'app-token', expires_in: 7200 } }));
        vi.stubGlobal('fetch', fetchMock);
        expect(await ebayClient.getApplicationToken({ auth })).toBe('app-token');
        expect(await ebayClient.getApplicationToken({ auth })).toBe('app-token');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await ebayClient.getApplicationToken({ auth: { ...auth, appId: 'app-other' } });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe('Cancel Order', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('reads the payment from the order and sends buyerPaid and buyerPaidDate', async () => {
        const auth = { appId: 'app-cancel', certId: 'cert-cancel', refreshToken: 'refresh-cancel', environment: 'production' };
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 200, body: { access_token: 'user-token', expires_in: 7200 } })));
        const sent: unknown[] = [];
        vi.spyOn(httpClient, 'sendRequest').mockImplementation(async (request) => {
            if (request.method === HttpMethod.GET) {
                return { status: 200, headers: {}, body: { orderId: '01-2', orderPaymentStatus: 'PAID', paymentSummary: { payments: [{ paymentDate: '2026-10-30T13:28:36.000Z' }] } } };
            }
            sent.push(request.body);
            return { status: 200, headers: {}, body: { cancelId: '5000123' } };
        });
        // Only auth and propsValue are read by this action; the rest of the context is not needed.
        const context: Parameters<typeof cancelOrder.run>[0] = Object.assign(Object.create(null), { auth: { props: auth }, propsValue: { orderId: ' 01-2 ', reason: 'OUT_OF_STOCK_OR_CANNOT_FULFILL' } });
        const result = await cancelOrder.run(context);
        expect(result).toEqual({ order_id: '01-2', cancel_id: '5000123', reason: 'OUT_OF_STOCK_OR_CANNOT_FULFILL', buyer_paid: true });
        expect(sent).toEqual([{ legacyOrderId: '01-2', cancelReason: 'OUT_OF_STOCK_OR_CANNOT_FULFILL', buyerPaid: true, buyerPaidDate: { value: '2026-10-30T13:28:36.000Z' } }]);
    });

    it('builds the body without payment fields when the order could not be read', () => {
        expect(cancellationCommon.cancelBody({ orderId: '1', reason: 'BUYER_ASKED_CANCEL', payment: null })).toEqual({ legacyOrderId: '1', cancelReason: 'BUYER_ASKED_CANCEL' });
        expect(cancellationCommon.paymentInfoFromOrder({ order: { orderId: '1', orderPaymentStatus: 'PENDING' } })).toEqual({ buyerPaid: false, buyerPaidDate: null });
    });
});

describe('Trading ack handling', () => {
    it('treats only Success and Warning as applied', () => {
        expect(inventoryCommon.isSuccess({ ack: 'Success' })).toBe(true);
        expect(inventoryCommon.isSuccess({ ack: 'Warning' })).toBe(true);
        expect(inventoryCommon.isSuccess({ ack: 'Failure' })).toBe(false);
        expect(inventoryCommon.isSuccess({ ack: 'PartialFailure' })).toBe(false);
    });

    it('fails on a reply without a recognisable Ack', () => {
        expect(() => inventoryCommon.readableResult({ xml: '<html><body>Service Unavailable</body></html>', call: 'ReviseInventoryStatus' })).toThrow(/outcome is unknown: Service Unavailable/);
        expect(() => inventoryCommon.readableResult({ xml: '', call: 'ReviseItem' })).toThrow(/outcome is unknown/);
    });

    it('reads a normal reply', () => {
        const result = inventoryCommon.readableResult({ xml: '<ReviseInventoryStatusResponse><Ack>Warning</Ack></ReviseInventoryStatusResponse>', call: 'ReviseInventoryStatus' });
        expect(result.ack).toBe('Warning');
    });
});

describe('Add Tracking plan', () => {
    const order: EbayOrder = {
        orderId: '01-1',
        lineItems: [
            { lineItemId: 'A', quantity: 2, lineItemFulfillmentStatus: 'FULFILLED' },
            { lineItemId: 'B', quantity: 3, lineItemFulfillmentStatus: 'IN_PROGRESS' },
            { lineItemId: 'C', quantity: 1, lineItemFulfillmentStatus: 'NOT_STARTED' },
        ],
    };
    const existing = [
        { fulfillmentId: 'F1', shipmentTrackingNumber: '9400 1000', lineItems: [{ lineItemId: 'A', quantity: 2 }, { lineItemId: 'B', quantity: 1 }] },
    ];

    it('skips shipped lines and quantities', () => {
        expect(fulfillmentCommon.plan({ order, existing, wantedLineItemIds: [], trackingNumber: 'NEW1' })).toEqual({
            kind: 'create',
            lineItems: [{ lineItemId: 'B', quantity: 2 }, { lineItemId: 'C', quantity: 1 }],
        });
    });

    it('returns the existing fulfillment for the same tracking number instead of creating another', () => {
        const plan = fulfillmentCommon.plan({ order, existing, wantedLineItemIds: ['A'], trackingNumber: '94001000' });
        expect(plan.kind).toBe('already_exists');
    });

    it('ships the rest when the same tracking number covered only some of the lines', () => {
        expect(fulfillmentCommon.plan({ order, existing, wantedLineItemIds: [], trackingNumber: '94001000' })).toEqual({
            kind: 'create',
            lineItems: [{ lineItemId: 'B', quantity: 2 }, { lineItemId: 'C', quantity: 1 }],
        });
    });

    it('refuses when everything selected is already shipped', () => {
        expect(fulfillmentCommon.plan({ order, existing, wantedLineItemIds: ['A'], trackingNumber: 'OTHER' }).kind).toBe('already_shipped');
    });

    it('reports unknown line items', () => {
        expect(fulfillmentCommon.plan({ order, existing, wantedLineItemIds: ['Z'], trackingNumber: 'X' }).kind).toBe('no_matching_lines');
    });

    it('reads the new fulfillment ID from the Location header', () => {
        expect(fulfillmentCommon.fulfillmentIdFromLocation({ headers: { location: 'https://api.ebay.com/sell/fulfillment/v1/order/01-1/shipping_fulfillment/9405509699937000000000' } })).toBe('9405509699937000000000');
        expect(fulfillmentCommon.fulfillmentIdFromLocation({ headers: {} })).toBeNull();
    });
});

describe('New Order polling', () => {
    it('seeds the overlap window on enable, so a publish does not replay it', async () => {
        const store = memoryStore();
        const source = fakeOrders({ orders: [order({ id: 'o1' }), order({ id: 'o2' })] });
        expect(await newOrderPoll.enable({ store, fetchOrders: source.fetch, fingerprint: FP, now: T0 })).toBe('seeded');
        expect(await ids({ store, fetchOrders: source.fetch, now: T0 + MINUTE })).toEqual([]);
    });

    it('keeps state across disable and enable: no duplicates, no gap', async () => {
        const store = memoryStore();
        const source = fakeOrders({ orders: [order({ id: 'o1' })] });
        await newOrderPoll.enable({ store, fetchOrders: source.fetch, fingerprint: FP, now: T0 });
        source.orders.push(order({ id: 'o2' }));
        expect(await ids({ store, fetchOrders: source.fetch, now: T0 + MINUTE })).toEqual(['o2']);
        source.orders.push(order({ id: 'o3' }));
        expect(await newOrderPoll.enable({ store, fetchOrders: source.fetch, fingerprint: FP, now: T0 + 2 * MINUTE })).toBe('resumed');
        expect(await ids({ store, fetchOrders: source.fetch, now: T0 + 3 * MINUTE })).toEqual(['o3']);
        expect(await ids({ store, fetchOrders: source.fetch, now: T0 + 4 * MINUTE })).toEqual([]);
    });

    it('reads the rest of a window larger than one poll instead of dropping it', async () => {
        const store = memoryStore();
        const source = fakeOrders({ orders: [], perCall: 3 });
        await newOrderPoll.enable({ store, fetchOrders: source.fetch, fingerprint: FP, now: T0 });
        source.orders.push(...Array.from({ length: 8 }, (_, index) => order({ id: `n${index}`, minute: index })));
        const all = [
            ...await ids({ store, fetchOrders: source.fetch, now: T0 + MINUTE }),
            ...await ids({ store, fetchOrders: source.fetch, now: T0 + 2 * MINUTE }),
            ...await ids({ store, fetchOrders: source.fetch, now: T0 + 3 * MINUTE }),
            ...await ids({ store, fetchOrders: source.fetch, now: T0 + 4 * MINUTE }),
        ];
        expect(new Set(all).size).toBe(all.length);
        expect([...all].sort()).toEqual(Array.from({ length: 8 }, (_, index) => `n${index}`).sort());
    });

    it('keeps its state when the same account is re-authorised with a new refresh token', async () => {
        const store = memoryStore();
        const source = fakeOrders({ orders: [order({ id: 'o1' })] });
        const fetchUsername = vi.fn(async () => 'tgp_seller');
        const fingerprintFor = async (tokenKey: string) => `order_new_order:production:app:${await newOrderPoll.accountName({ store, tokenKey, fetchUsername })}:`;
        const before = await fingerprintFor('token-hash-1');
        expect(await fingerprintFor('token-hash-1')).toBe(before);
        expect(fetchUsername).toHaveBeenCalledTimes(1);
        await newOrderPoll.enable({ store, fetchOrders: source.fetch, fingerprint: before, now: T0 });
        source.orders.push(order({ id: 'o2' }));
        // Re-authorised: new refresh token, same seller.
        const after = await fingerprintFor('token-hash-2');
        expect(fetchUsername).toHaveBeenCalledTimes(2);
        expect(after).toBe(before);
        expect(await newOrderPoll.enable({ store, fetchOrders: source.fetch, fingerprint: after, now: T0 + MINUTE })).toBe('resumed');
        expect((await newOrderPoll.poll({ store, fetchOrders: source.fetch, fingerprint: after, now: T0 + 2 * MINUTE })).map((polled) => polled.orderId)).toEqual(['o2']);
        // A different seller is a different trigger state.
        fetchUsername.mockResolvedValueOnce('other_seller');
        expect(await fingerprintFor('token-hash-3')).not.toBe(before);
    });

    it('fails the poll on a store error instead of re-seeding', async () => {
        const store = memoryStore();
        const source = fakeOrders({ orders: [] });
        await newOrderPoll.enable({ store, fetchOrders: source.fetch, fingerprint: FP, now: T0 });
        const broken: NewOrderStore = { ...store, get: async () => {
            throw new Error('store down');
        } };
        await expect(newOrderPoll.poll({ store: broken, fetchOrders: source.fetch, fingerprint: FP, now: T0 + MINUTE })).rejects.toThrow('store down');
    });
});

async function ids({ store, fetchOrders, now }: { store: NewOrderStore; fetchOrders: FetchOrders<PolledOrder>; now: number }): Promise<string[]> {
    const orders = await newOrderPoll.poll({ store, fetchOrders, fingerprint: FP, now });
    return orders.map((polled) => polled.orderId);
}

function order({ id, minute = 0 }: { id: string; minute?: number }): PolledOrder {
    return { orderId: id, creationDate: new Date(T0 + minute * MINUTE).toISOString() };
}

// Newest first, like eBay; every order is inside the window.
function fakeOrders({ orders, perCall = 1000 }: { orders: PolledOrder[]; perCall?: number }): { orders: PolledOrder[]; fetch: FetchOrders<PolledOrder> } {
    const fetch: FetchOrders<PolledOrder> = async ({ offset, maxOrders }) => {
        const limit = Math.min(perCall, maxOrders);
        const newestFirst = [...orders].reverse();
        const page = newestFirst.slice(offset, offset + limit);
        return { orders: page, truncated: newestFirst.length > offset + limit };
    };
    return { orders, fetch };
}

function memoryStore(): NewOrderStore {
    const data = new Map<string, string>();
    return {
        get: async (key) => {
            const value = data.get(key);
            return value === undefined ? null : JSON.parse(value);
        },
        put: async (key, value) => {
            data.set(key, JSON.stringify(value));
            return value;
        },
    };
}

function jsonResponse({ status, body }: { status: number; body: unknown }): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Everything written to the console during the test, as text.
function captureConsole(): () => string[] {
    const lines: string[] = [];
    const record = (...args: unknown[]) => {
        lines.push(args.map((arg) => (arg instanceof Error ? `${arg.message} ${JSON.stringify(arg)}` : typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    };
    vi.spyOn(console, 'error').mockImplementation(record);
    vi.spyOn(console, 'warn').mockImplementation(record);
    vi.spyOn(console, 'log').mockImplementation(record);
    return () => lines;
}

const FP = 'order_new_order:';
const MINUTE = 60 * 1000;
const T0 = Date.UTC(2026, 10, 1, 12, 0, 0);
