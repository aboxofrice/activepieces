import { describe, expect, it } from 'vitest';
import { turn14OrderGuards } from '../src/lib/common/order-guards';
import { Turn14Order } from '../src/lib/common/orders';
import { memoryStore } from './helpers';

const auth = { clientId: 'client-a', clientSecret: 'secret', environment: 'testing' };

function guardParams(overrides: Partial<Parameters<typeof turn14OrderGuards.claimOrder>[0]> = {}): Parameters<typeof turn14OrderGuards.claimOrder>[0] {
    return {
        store: memoryStore(),
        auth,
        quoteId: '555',
        poNumber: 'PO-1001',
        environment: 'testing',
        refuseRepeatQuote: true,
        refuseOpenPo: true,
        listOpenOrders: async () => ({ orders: [], complete: true }),
        settleMs: 5,
        ...overrides,
    };
}

function openOrder({ id, po }: { id: string; po: string }): Turn14Order {
    return { id, attributes: { purchase_order_number: po, order_number: `SO${id}` } };
}

describe('turn14OrderGuards.claimOrder', () => {
    it('passes when nothing points to a duplicate and leaves this run\'s claim behind', async () => {
        const store = memoryStore();
        const claim = await turn14OrderGuards.claimOrder(guardParams({ store }));
        const attempt = await turn14OrderGuards.readAttempt({ store, auth, quoteId: '555' });
        expect(attempt?.status).toBe('sending');
        expect(attempt?.token).toBe(claim.token);
    });

    it('lets only one of two runs racing for the same quote through', async () => {
        const store = memoryStore();
        const results = await Promise.allSettled([turn14OrderGuards.claimOrder(guardParams({ store })), turn14OrderGuards.claimOrder(guardParams({ store }))]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find((result) => result.status === 'rejected');
        expect(rejected?.status === 'rejected' ? String(rejected.reason) : '').toMatch(/Another run claimed quote 555/);
    });

    it('writes the claim before looking up open orders, and clears it when a check refuses', async () => {
        const store = memoryStore();
        const seenDuringLookup: unknown[] = [];
        const params = guardParams({
            store,
            listOpenOrders: async () => {
                seenDuringLookup.push(await turn14OrderGuards.readAttempt({ store, auth, quoteId: '555' }));
                return { orders: [openOrder({ id: '9', po: 'PO-1001' })], complete: true };
            },
        });
        await expect(turn14OrderGuards.claimOrder(params)).rejects.toThrow(/already has an open order/);
        expect(seenDuringLookup[0]).toMatchObject({ status: 'sending' });
        expect(await turn14OrderGuards.readAttempt({ store, auth, quoteId: '555' })).toBeNull();
    });

    it('lets a store failure propagate instead of treating it as "no attempt"', async () => {
        const store = { ...memoryStore(), get: async (): Promise<null> => { throw new Error('store down'); } };
        await expect(turn14OrderGuards.claimOrder(guardParams({ store }))).rejects.toThrow('store down');
    });

    it('refuses when an open order already carries the PO number (case and spaces ignored)', async () => {
        const params = guardParams({ listOpenOrders: async () => ({ orders: [openOrder({ id: '9', po: ' po-1001 ' })], complete: true }) });
        await expect(turn14OrderGuards.claimOrder(params)).rejects.toThrow(/already has an open order for PO "PO-1001" \(order 9, SO9\)/);
    });

    it('refuses when the open-order list could not be read in full', async () => {
        const params = guardParams({ listOpenOrders: async () => ({ orders: [openOrder({ id: '9', po: 'OTHER' })], complete: false }) });
        await expect(turn14OrderGuards.claimOrder(params)).rejects.toThrow(/cannot be ruled out/);
    });

    it('skips the open-order check when it is switched off', async () => {
        const params = guardParams({ refuseOpenPo: false, listOpenOrders: async () => { throw new Error('should not be called'); } });
        await expect(turn14OrderGuards.claimOrder(params)).resolves.toMatchObject({ token: expect.any(String) });
    });

    it('refuses a second attempt for the same quote, and allows it when switched off', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'unknown', token: 'other', at: '2026-11-01T00:00:00.000Z', poNumber: 'PO-1001', environment: 'testing', orderId: null } });
        await expect(turn14OrderGuards.claimOrder(guardParams({ store }))).rejects.toThrow(/already sent at 2026-11-01T00:00:00.000Z and its outcome is unknown/);
        await expect(turn14OrderGuards.claimOrder(guardParams({ store, refuseRepeatQuote: false }))).resolves.toMatchObject({ token: expect.any(String) });
    });

    it('keeps attempts per account and host apart', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'placed', token: 'other', at: 'x', poNumber: 'PO-1001', environment: 'testing', orderId: '77' } });
        await expect(turn14OrderGuards.claimOrder(guardParams({ store, auth: { ...auth, clientId: 'client-b' } }))).resolves.toMatchObject({ token: expect.any(String) });
        await expect(turn14OrderGuards.claimOrder(guardParams({ store }))).rejects.toThrow(/placed as Turn14 order 77/);
    });

    it('stores attempts project-wide so other flows see them', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'sending', token: 'other', at: 'x', poNumber: 'PO-1001', environment: 'testing', orderId: null } });
        expect([...store.data.keys()].every((key) => key.startsWith('COLLECTION:'))).toBe(true);
    });

    it('refuses to order a quote in another environment than it was created in', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordQuote({ store, auth, quoteId: '555', quote: { environment: 'testing', poNumber: 'PO-1001', at: 'x' } });
        await expect(turn14OrderGuards.claimOrder(guardParams({ store, environment: 'production' }))).rejects.toThrow(/created with Order Environment "testing"/);
    });
});

describe('turn14OrderGuards with the repeat-quote guard off or a stuck claim', () => {
    it('leaves an existing record untouched when "Refuse a Second Order" is off', async () => {
        const store = memoryStore();
        const placed = { status: 'placed' as const, token: 'other', at: 'x', poNumber: 'PO-1001', environment: 'testing' as const, orderId: '77' };
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: placed });
        const claim = await turn14OrderGuards.claimOrder(guardParams({ store, refuseRepeatQuote: false }));
        expect(claim.owned).toBe(false);
        await turn14OrderGuards.recordIfAbsent({ store, auth, quoteId: '555', attempt: { ...placed, token: claim.token, orderId: '88' } });
        await turn14OrderGuards.releaseClaim({ store, auth, quoteId: '555', token: claim.token });
        expect(await turn14OrderGuards.readAttempt({ store, auth, quoteId: '555' })).toEqual(placed);
    });

    it('tells the user how to clear a stuck claim, and clears it only when asked', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'sending', token: 'stale', at: 'x', poNumber: 'PO-1001', environment: 'testing', orderId: null } });
        await expect(turn14OrderGuards.claimOrder(guardParams({ store }))).rejects.toThrow(/Check PO "PO-1001" in Turn14.*tick "Clear Stuck Claim for This Quote"/);
        const claim = await turn14OrderGuards.claimOrder(guardParams({ store, clearStuckClaim: true }));
        expect((await turn14OrderGuards.readAttempt({ store, auth, quoteId: '555' }))?.token).toBe(claim.token);
    });

    it('refuses to clear a claim recorded as placed', async () => {
        const store = memoryStore();
        await turn14OrderGuards.recordAttempt({ store, auth, quoteId: '555', attempt: { status: 'placed', token: 'other', at: 'x', poNumber: 'PO-1001', environment: 'testing', orderId: '77' } });
        await expect(turn14OrderGuards.claimOrder(guardParams({ store, clearStuckClaim: true }))).rejects.toThrow(/does not apply to a placed order/);
    });
});

describe('turn14OrderGuards.findOpenOrderWithPo', () => {
    it('ignores orders without a PO and an empty PO', () => {
        const orders = [openOrder({ id: '1', po: '' }), { id: '2' }];
        expect(turn14OrderGuards.findOpenOrderWithPo({ orders, poNumber: 'PO-1' })).toBeNull();
        expect(turn14OrderGuards.findOpenOrderWithPo({ orders, poNumber: '  ' })).toBeNull();
    });
});
