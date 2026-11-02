import { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { sellercloudClient } from '../client';
import { sellercloudDropdowns } from '../dropdowns';

describe('sellercloudClient secrets', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('never puts the password in a failed login error or in any log line', async () => {
        const auth = { serverUrl: 'https://tenant.example.test/rest', username: 'api@example.test', password: 'Sup3r-Secret-Pw', pinCode: '9911' };
        const logged = captureConsole();
        const sendRequest = vi.spyOn(httpClient, 'sendRequest');
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 400, body: { Message: 'Invalid username or password' } })));
        const { error } = await sellercloudClient.tryGetToken({ auth });
        const thrown = await sellercloudClient.getToken({ auth: { ...auth, username: 'other@example.test' } }).catch((caught: unknown) => caught);

        expect(error).toContain('400');
        expect(error).toContain('Invalid username or password');
        expect(error).not.toContain(auth.password);
        expect(thrown).toBeInstanceOf(Error);
        const message = thrown instanceof Error ? thrown.message : '';
        expect(message).not.toContain(auth.password);
        expect(message).not.toContain('Password');
        expect(sendRequest).not.toHaveBeenCalled();
        expect(logged().some((line) => line.includes(auth.password))).toBe(false);
    });

    it('never puts the password in a failed request error, even when the login fails inside it', async () => {
        const auth = { serverUrl: 'https://tenant2.example.test/rest', username: 'api@example.test', password: 'An0ther-Secret' };
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 500, body: 'Internal error' })));
        const thrown = await sellercloudClient.request({ auth, method: HttpMethod.GET, path: '/Warehouses' }).catch((caught: unknown) => caught);
        const message = thrown instanceof Error ? thrown.message : String(thrown);
        expect(message).toContain('login failed');
        expect(message).not.toContain(auth.password);
    });

    it('masks a credential that the server echoes back', () => {
        const auth = { serverUrl: 'https://x.example.test/rest', username: 'u', password: 'echoed-pw' };
        const error = new HttpError({ Password: auth.password }, httpFailure({ status: 400, data: { Message: 'bad password echoed-pw' } }));
        const message = sellercloudClient.safeErrorMessage({ error, auth });
        expect(message).not.toContain('echoed-pw');
        expect(message).toContain('[redacted]');
    });

    it('keeps each connection\'s token under its own store key', async () => {
        const store = memoryStore();
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
            const body: unknown = JSON.parse(init.body);
            const username = typeof body === 'object' && body !== null ? String(Object.fromEntries(Object.entries(body))['Username']) : '';
            return jsonResponse({ status: 200, body: { access_token: `token-for-${username}`, expires_in: 3600 } });
        }));
        const first = await sellercloudClient.getToken({ auth: { serverUrl: 'https://a.example.test/rest', username: 'one', password: 'p1' }, store });
        const second = await sellercloudClient.getToken({ auth: { serverUrl: 'https://a.example.test/rest', username: 'two', password: 'p2' }, store });
        expect(first).toBe('token-for-one');
        expect(second).toBe('token-for-two');
        const keys = [...store.data.keys()];
        expect(keys).toHaveLength(2);
        expect(keys.every((key) => key.startsWith('sellercloud_token_') && !key.includes('one') && !key.includes('two'))).toBe(true);
    });

    it('does not validate a wrong password with a token cached for the right one', async () => {
        const auth = { serverUrl: 'https://cache.example.test/rest', username: 'same-user', password: 'right-pw' };
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => (init.body.includes('right-pw')
            ? jsonResponse({ status: 200, body: { access_token: 'good', expires_in: 3600 } })
            : jsonResponse({ status: 400, body: { Message: 'Sorry, invalid username or password' } }))));
        expect(await sellercloudClient.tryGetToken({ auth })).toEqual({ error: null });
        const wrong = await sellercloudClient.tryGetToken({ auth: { ...auth, password: 'wrong-pw' } });
        expect(wrong.error).toContain('invalid username or password');
    });
});

describe('sellercloudClient rate limiting', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('recognises the rate-limit 409 but not a plain conflict', () => {
        expect(sellercloudClient.isRateLimited({ status: 409, body: { Error: 'Too many requests.', RateLimitResetTime: '2026-11-01T10:00:00Z' } })).toBe(true);
        expect(sellercloudClient.isRateLimited({ status: 409, body: { Message: 'Order is locked' } })).toBe(false);
        expect(sellercloudClient.isRateLimited({ status: 429, body: null })).toBe(true);
    });

    it('does not repeat a write that got a plain 409', async () => {
        const auth = { serverUrl: 'https://w.example.test/rest', username: 'u', password: 'p' };
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 200, body: { access_token: 't', expires_in: 3600 } })));
        const send = vi.spyOn(httpClient, 'sendRequest').mockImplementation(async (request) => {
            throw new HttpError(request.body, httpFailure({ status: 409, data: { Message: 'Conflict' } }));
        });
        await expect(sellercloudClient.request({ auth, method: HttpMethod.PUT, path: '/Orders/ShippingStatus', body: {} })).rejects.toThrow('409');
        expect(send.mock.calls.filter(([request]) => !request.url.endsWith('/token'))).toHaveLength(1);
    });
});

describe('company probe', () => {
    it('stays small for sparse IDs', () => {
        const candidates = sellercloudDropdowns.probeCandidates({ known: [5, 1200, 9000, 45000] });
        expect(candidates.length).toBeLessThanOrEqual(20);
        expect(candidates).not.toContain(600);
    });

    it('fills small gaps and the edges', () => {
        expect(sellercloudDropdowns.probeCandidates({ known: [10, 13] }).sort((a, b) => a - b)).toEqual([7, 8, 9, 11, 12, 14, 15, 16]);
    });
});

function jsonResponse({ status, body }: { status: number; body: unknown }): Response {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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

function httpFailure({ status, data }: { status: number; data?: unknown }): AxiosError {
    return Object.assign(new AxiosError('Request failed'), {
        response: { status, data, statusText: '', headers: {}, config: {} },
    });
}

function memoryStore(): { data: Map<string, unknown>; get: <T>(key: string) => Promise<T | null>; put: (key: string, value: unknown) => Promise<unknown> } {
    const data = new Map<string, unknown>();
    return {
        data,
        get: async <T>(key: string): Promise<T | null> => {
            const value: unknown = data.get(key);
            // A round trip through JSON, as the real store does.
            return value === undefined ? null : JSON.parse(JSON.stringify(value));
        },
        put: async (key: string, value: unknown) => {
            data.set(key, value);
            return value;
        },
    };
}
