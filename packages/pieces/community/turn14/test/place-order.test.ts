import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoreScope } from '@activepieces/pieces-framework';
import { turn14OrderGuards } from '../src/lib/common/order-guards';
import { turn14PlaceOrder } from '../src/lib/common/place-order';
import { jsonResponse, memoryStore, requestUrl } from './helpers';

const auth = { clientId: 'place-order', clientSecret: 'secret', environment: 'testing' };

function input() {
    return {
        environment: 'testing',
        confirmLiveOrder: false,
        quoteId: '777',
        poNumber: 'PO-77',
        shippingIds: [1],
        acknowledgeProp65: false,
        acknowledgeEpa: false,
        refuseOpenPo: true,
        refuseRepeatQuote: true,
    };
}

function stubTurn14({ orderResponse }: { orderResponse: () => Response }): string[] {
    const posts: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: unknown, init?: RequestInit) => {
        const url = requestUrl({ input: request });
        if (url.endsWith('/v1/token')) {
            return jsonResponse({ body: { access_token: 'token' } });
        }
        if (init?.method === 'POST') {
            posts.push(url);
            return orderResponse();
        }
        return jsonResponse({ body: { data: [], meta: { total_pages: 0 } } });
    }));
    return posts;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('turn14PlaceOrder.placeOrder', () => {
    it('still returns the order when recording it afterwards fails', async () => {
        stubTurn14({ orderResponse: () => jsonResponse({ body: { data: { id: 'O-1' } } }) });
        const base = memoryStore();
        const store = {
            ...base,
            put: async <T>(key: string, value: T, scope?: StoreScope): Promise<T> => {
                if (JSON.stringify(value).includes('"placed"')) {
                    throw new Error('store write failed');
                }
                return base.put(key, value, scope);
            },
        };
        const result = await turn14PlaceOrder.placeOrder({ store, auth, input: input(), settleMs: 5 });
        expect(result.order_id).toBe('O-1');
        expect(result.warnings.join(' ')).toMatch(/could not be recorded \(store write failed\)/);
        expect((await turn14OrderGuards.readAttempt({ store, auth, quoteId: '777' }))?.status).toBe('sending');
    });

    it('records the placed order so a second run for the quote is refused without a POST', async () => {
        const posts = stubTurn14({ orderResponse: () => jsonResponse({ body: { data: { id: 'O-2' } } }) });
        const store = memoryStore();
        await turn14PlaceOrder.placeOrder({ store, auth, input: input(), settleMs: 5 });
        await expect(turn14PlaceOrder.placeOrder({ store, auth, input: input(), settleMs: 5 })).rejects.toThrow(/placed as Turn14 order O-2/);
        expect(posts).toHaveLength(1);
    });

    it('releases the claim when Turn14 clearly refuses the order', async () => {
        stubTurn14({ orderResponse: () => jsonResponse({ status: 422, body: { errors: [{ title: 'Quote expired' }] } }) });
        const store = memoryStore();
        await expect(turn14PlaceOrder.placeOrder({ store, auth, input: input(), settleMs: 5 })).rejects.toThrow(/Quote expired/);
        expect(await turn14OrderGuards.readAttempt({ store, auth, quoteId: '777' })).toBeNull();
    });
});
