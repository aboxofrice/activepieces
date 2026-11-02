import { afterEach, describe, expect, it, vi } from 'vitest';
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

// The client keeps request spacing in module state, and a Retry-After pushes it out for every
// later request, so each test loads a fresh copy.
async function freshClient() {
    vi.resetModules();
    const { turn14Client } = await import('../src/lib/common/client');
    return turn14Client;
}

describe('turn14Client deadlines', () => {
    it('caps a request\'s timeout to the time left and fails with a deadline error', async () => {
        const turn14Client = await freshClient();
        const timeouts: number[] = [];
        vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
            if (requestUrl({ input }).endsWith('/v1/token')) {
                return jsonResponse({ body: { access_token: 'token' } });
            }
            const signal = init?.signal;
            return new Promise<Response>((_, reject) => {
                const started = Date.now();
                signal?.addEventListener('abort', () => {
                    timeouts.push(Date.now() - started);
                    reject(signal.reason);
                });
            });
        }));
        const started = Date.now();
        await expect(turn14Client.request({ auth: auth({ name: 'deadline-cap' }), method: 'GET', path: '/v1/brands', validate: turn14Client.isListResponse, deadline: Date.now() + 2500 }))
            .rejects.toBeInstanceOf(turn14Client.Turn14DeadlineError);
        expect(Date.now() - started).toBeLessThan(4000);
        expect(timeouts).toHaveLength(1);
    });

    it('does not wait on a Retry-After that would pass the deadline', async () => {
        const turn14Client = await freshClient();
        const api = stubApi({ handler: () => jsonResponse({ status: 429, body: {}, headers: { 'Retry-After': '20' } }) });
        const started = Date.now();
        await expect(turn14Client.request({ auth: auth({ name: 'deadline-429' }), method: 'GET', path: '/v1/brands', validate: turn14Client.isListResponse, deadline: Date.now() + 5000 }))
            .rejects.toThrow(/HTTP 429.*no retry: the run's time limit would be passed/);
        expect(Date.now() - started).toBeLessThan(2000);
        expect(api.calls()).toBe(1);
    });

    it('ends a page scan at the deadline instead of failing it', async () => {
        const turn14Client = await freshClient();
        stubApi({ handler: ({ call }) => (call === 1
            ? jsonResponse({ body: { data: [{ id: '1' }], meta: { total_pages: 3 } } })
            : jsonResponse({ status: 429, body: {}, headers: { 'Retry-After': '20' } })) });
        const result = await turn14Client.fetchPages({ auth: auth({ name: 'deadline-scan' }), path: '/v1/items', maxPages: 10, deadline: Date.now() + 5000 });
        expect(result.rows).toHaveLength(1);
        expect(result.nextPage).toBe(2);
        expect(result.truncated).toBe(true);
    });
});
