import { describe, expect, it } from 'vitest';
import { turn14OrderGuards } from '../src/lib/common/order-guards';
import { Turn14Order } from '../src/lib/common/orders';
import { memoryStore } from './helpers';

const auth = { clientId: 'client-a', clientSecret: 'secret', environment: 'testing' };

function guardParams(overrides: Partial<Parameters<typeof turn14OrderGuards.assertSafeToOrder>[0]> = {}): Parameters<typeof turn14OrderGuards.assertSafeToOrder>[0] {
    return {
        store: memoryStore(),
        auth,
        quoteId: '555',
        poNumber: 'PO-1001',
        environment: 'testing',
        refuseRepeatQuote: true,
        refuseOpenPo: true,
        listOpenOrders: async () => ({ orders: [], complete: true }),
        ...overrides,
    };
}

function openOrder({ id, po }: { id: string; po: string }): Turn14Order {
    return { id, attributes: { purchase_order_number: po, order_number: `SO${id}` } };
}

describe('turn14OrderGuards.assertSafeToOrder', () => {
    it('passes when nothing points to a duplicate', async () => {
        await expect(turn14OrderGuards.assertSafeToOrder(guardParams())).resolves.toBeUndefined();
    });

    it('refuses when an open order already carries the PO number (case and spaces ignored)', async () => {
        const params = guardParams({ listOpenOrders: async () => ({ orders: [openOrder({ id: '9', po: ' po-1001 ' })], complete: true }) });
        await expect(turn14OrderGuards.assertSafeToOrder(params)).rejects.toThrow(/already has an open order for PO "PO-1001" \(order 9, SO9\)/);
    });

    it('refuses when the open-order list could not be read in full', async () => {
        const params = guardParams({ listOpenOrders: async () => ({ orders: [openOrder({ id: '9', po: 'OTHER' })], complete: false }) });
        await expect(turn14OrderGuards.assertSafeToOrder(params)).rejects.toThrow(/cannot be ruled out/);
    });

    it('skips the open-order check when it is switched off', async () => {
        const params = guardParams({ refuseOpenPo: false, listOpenOrders: async () => { throw new Error('should not be called'); } });
        await expect(turn14OrderGuards.assertSafeToOrder(params)).resolves.toBeUndefined();
    });

    it('refuses a second attempt for the same quote, and allows it when switched off', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'unknown', at: '2026-11-01T00:00:00.000Z', poNumber: 'PO-1001', environment: 'testing', orderId: null } });
        await expect(turn14OrderGuards.assertSafeToOrder(guardParams({ store }))).rejects.toThrow(/already sent at 2026-11-01T00:00:00.000Z and its outcome is unknown/);
        await expect(turn14OrderGuards.assertSafeToOrder(guardParams({ store, refuseRepeatQuote: false }))).resolves.toBeUndefined();
    });

    it('keeps attempts per account and host apart', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'placed', at: 'x', poNumber: 'PO-1001', environment: 'testing', orderId: '77' } });
        await expect(turn14OrderGuards.assertSafeToOrder(guardParams({ store, auth: { ...auth, clientId: 'client-b' } }))).resolves.toBeUndefined();
        await expect(turn14OrderGuards.assertSafeToOrder(guardParams({ store }))).rejects.toThrow(/placed as Turn14 order 77/);
    });

    it('stores attempts project-wide so other flows see them', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'sending', at: 'x', poNumber: 'PO-1001', environment: 'testing', orderId: null } });
        expect([...store.data.keys()].every((key) => key.startsWith('COLLECTION:'))).toBe(true);
    });

    it('refuses to order a quote in another environment than it was created in', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordQuote({ store, auth, quoteId: '555', quote: { environment: 'testing', poNumber: 'PO-1001', at: 'x' } });
        await expect(turn14OrderGuards.assertSafeToOrder(guardParams({ store, environment: 'production' }))).rejects.toThrow(/created with Order Environment "testing"/);
    });
});

describe('turn14OrderGuards.findOpenOrderWithPo', () => {
    it('ignores orders without a PO and an empty PO', () => {
        const orders = [openOrder({ id: '1', po: '' }), { id: '2' }];
        expect(turn14OrderGuards.findOpenOrderWithPo({ orders, poNumber: 'PO-1' })).toBeNull();
        expect(turn14OrderGuards.findOpenOrderWithPo({ orders, poNumber: '  ' })).toBeNull();
    });
});
