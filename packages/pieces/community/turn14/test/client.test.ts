import { afterEach, describe, expect, it, vi } from 'vitest';
import { turn14Client } from '../src/lib/common/client';
import { jsonResponse, requestUrl } from './helpers';

function stubApi({ handler }: { handler: (input: { url: string; method: string; call: number }) => Response | Promise<Response> }): { calls: () => number } {
    const counter = { value: 0 };
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = requestUrl({ input });
        if (url.endsWith('/v1/token')) {
            return jsonResponse({ body: { access_token: 'token', expires_in: 3600 } });
        }
        counter.value += 1;
        return handler({ url, method: init?.method ?? 'GET', call: counter.value });
    }));
    return { calls: () => counter.value };
}

function auth({ name }: { name: string }) {
    return { clientId: name, clientSecret: 'secret', environment: 'testing' };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('turn14Client.request', () => {
    it('reports an UNKNOWN outcome when a POST times out, and does not retry it', async () => {
        const api = stubApi({ handler: () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); } });
        const result = turn14Client.request({ auth: auth({ name: 'timeout' }), method: 'POST', path: '/v1/order/from_quote', body: {}, validate: turn14Client.isAnyBody });
        await expect(result).rejects.toBeInstanceOf(turn14Client.Turn14OutcomeUnknownError);
        await expect(result).rejects.toThrow(/no answer within 30s\. The outcome is UNKNOWN/);
        expect(api.calls()).toBe(1);
    });

    it('does not retry a POST that failed with a 5xx and calls the outcome unknown', async () => {
        const api = stubApi({ handler: () => jsonResponse({ status: 502, body: { errors: [{ title: 'Bad gateway' }] } }) });
        await expect(turn14Client.request({ auth: auth({ name: 'post5xx' }), method: 'POST', path: '/v1/quote', body: {}, validate: turn14Client.isAnyBody }))
            .rejects.toThrow(/HTTP 502: Bad gateway\. The outcome is UNKNOWN/);
        expect(api.calls()).toBe(1);
    });

    it('retries a POST refused with 429, after the Retry-After delay', async () => {
        const api = stubApi({ handler: ({ call }) => (call === 1 ? jsonResponse({ status: 429, body: {}, headers: { 'Retry-After': '1' } }) : jsonResponse({ body: { data: { id: 42 } } })) });
        const started = Date.now();
        const response = await turn14Client.request({ auth: auth({ name: 'post429' }), method: 'POST', path: '/v1/quote', body: {}, validate: turn14Client.isAnyBody });
        expect(response).toEqual({ data: { id: 42 } });
        expect(api.calls()).toBe(2);
        expect(Date.now() - started).toBeGreaterThanOrEqual(950);
    });

    it('returns null for an empty 204 on a write instead of throwing a TypeError', async () => {
        stubApi({ handler: () => new Response(null, { status: 204 }) });
        await expect(turn14Client.request({ auth: auth({ name: 'empty' }), method: 'POST', path: '/v1/order/from_quote', body: {}, validate: turn14Client.isAnyBody })).resolves.toBeNull();
    });

    it('fails clearly when a read returns an empty or malformed body', async () => {
        stubApi({ handler: ({ call }) => (call === 1 ? new Response('', { status: 200 }) : jsonResponse({ body: { data: 'nope' } })) });
        await expect(turn14Client.request({ auth: auth({ name: 'badread' }), method: 'GET', path: '/v1/items/1', validate: turn14Client.isSingleResponse }))
            .rejects.toThrow(/returned an empty response/);
        await expect(turn14Client.request({ auth: auth({ name: 'badread' }), method: 'GET', path: '/v1/items/1', validate: turn14Client.isSingleResponse }))
            .rejects.toThrow(/unexpected format/);
    });

    it('sends every request with a timeout signal', async () => {
        const signals: unknown[] = [];
        vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
            signals.push(init?.signal);
            return requestUrl({ input }).endsWith('/v1/token') ? jsonResponse({ body: { access_token: 'token' } }) : jsonResponse({ body: { data: [] } });
        }));
        await turn14Client.request({ auth: auth({ name: 'signal' }), method: 'GET', path: '/v1/brands', validate: turn14Client.isListResponse });
        expect(signals).toHaveLength(2);
        expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
    });
});

describe('turn14Client.retryAfterMs', () => {
    it('reads seconds and HTTP dates, capped at 30 seconds', () => {
        const now = Date.parse('2026-11-01T00:00:00Z');
        expect(turn14Client.retryAfterMs({ header: '2', now })).toBe(2000);
        expect(turn14Client.retryAfterMs({ header: 'Sun, 01 Nov 2026 00:00:05 GMT', now })).toBe(5000);
        expect(turn14Client.retryAfterMs({ header: '120', now })).toBe(30000);
        expect(turn14Client.retryAfterMs({ header: null, now })).toBeNull();
        expect(turn14Client.retryAfterMs({ header: 'soon', now })).toBeNull();
    });
});
