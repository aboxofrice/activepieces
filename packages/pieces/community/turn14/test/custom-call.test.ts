import { describe, expect, it } from 'vitest';
import { turn14CustomCall } from '../src/lib/common/custom-call';

describe('turn14CustomCall.assertAllowed', () => {
    it('refuses writes to the quote and order endpoints however the path is written', () => {
        ['/order', 'order/from_quote', '/v1/quote', 'https://api.turn14.com/v1/order', '/./ORDERS/1', '%2Forder', '/items/../order'].forEach((url) => {
            expect(() => turn14CustomCall.assertAllowed({ propsValue: { method: 'POST', url: { url } } })).toThrow(/refuses POST/);
        });
    });

    it('allows reads and other endpoints', () => {
        expect(() => turn14CustomCall.assertAllowed({ propsValue: { method: 'GET', url: { url: '/orders' } } })).not.toThrow();
        expect(() => turn14CustomCall.assertAllowed({ propsValue: { method: 'POST', url: { url: '/items/data/brand/1' } } })).not.toThrow();
        expect(() => turn14CustomCall.assertAllowed({ propsValue: { method: 'POST', url: { url: '/ordering-guide' } } })).not.toThrow();
    });
});
