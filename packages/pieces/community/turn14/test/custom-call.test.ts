import { describe, expect, it } from 'vitest';
import { turn14CustomCall } from '../src/lib/common/custom-call';

describe('turn14CustomCall.assertAllowed', () => {
    it('refuses every method except GET, whatever the path', () => {
        ['POST', 'PUT', 'PATCH', 'DELETE', 'post'].forEach((method) => {
            expect(() => turn14CustomCall.assertAllowed({ propsValue: { method, url: { url: '/items/1' } } })).toThrow(/only sends GET/);
        });
        expect(() => turn14CustomCall.assertAllowed({ propsValue: { method: 'POST', url: { url: '/order;x' } } })).toThrow(/only sends GET/);
    });

    it('allows GET', () => {
        expect(() => turn14CustomCall.assertAllowed({ propsValue: { method: 'GET', url: { url: '/orders' } } })).not.toThrow();
    });
});
