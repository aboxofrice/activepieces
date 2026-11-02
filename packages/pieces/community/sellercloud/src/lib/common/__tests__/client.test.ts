import { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { sellercloudClient } from '../client';
import { sellercloudDropdowns } from '../dropdowns';

describe('sellercloudClient secrets', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('never puts the password in a failed login error', async () => {
        const auth = { serverUrl: 'https://tenant.example.test/rest', username: 'api@example.test', password: 'Sup3r-Secret-Pw', pinCode: '9911' };
        vi.spyOn(httpClient, 'sendRequest').mockImplementation(async (request) => {
            throw new HttpError(request.body, httpFailure({ status: 400, data: { Message: 'Invalid username or password' } }));
        });
        const { error } = await sellercloudClient.tryGetToken({ auth });
        const thrown = await sellercloudClient.getToken({ auth: { ...auth, username: 'other@example.test' } }).catch((caught: unknown) => caught);

        expect(error).toContain('400');
        expect(error).toContain('Invalid username or password');
        expect(error).not.toContain(auth.password);
        expect(thrown).toBeInstanceOf(Error);
        const message = thrown instanceof Error ? thrown.message : '';
        expect(message).not.toContain(auth.password);
        expect(message).not.toContain('Password');
    });

    it('never puts the password in a failed request error, even when the login fails inside it', async () => {
        const auth = { serverUrl: 'https://tenant2.example.test/rest', username: 'api@example.test', password: 'An0ther-Secret' };
        vi.spyOn(httpClient, 'sendRequest').mockImplementation(async (request) => {
            throw new HttpError(request.body, httpFailure({ status: 500 }));
        });
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
        vi.spyOn(httpClient, 'sendRequest').mockImplementation(async (request) => {
            const body = typeof request.body === 'object' && request.body !== null ? Object.fromEntries(Object.entries(request.body)) : {};
            return { status: 200, headers: {}, body: { access_token: `token-for-${String(body['Username'])}`, expires_in: 3600 } };
        });
        const first = await sellercloudClient.getToken({ auth: { serverUrl: 'https://a.example.test/rest', username: 'one', password: 'p1' }, store });
        const second = await sellercloudClient.getToken({ auth: { serverUrl: 'https://a.example.test/rest', username: 'two', password: 'p2' }, store });
        expect(first).toBe('token-for-one');
        expect(second).toBe('token-for-two');
        const keys = [...store.data.keys()];
        expect(keys).toHaveLength(2);
        expect(keys.every((key) => key.startsWith('sellercloud_token_') && !key.includes('one') && !key.includes('two'))).toBe(true);
    });
});

describe('sellercloudClient rate limiting', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('recognises the rate-limit 409 but not a plain conflict', () => {
        expect(sellercloudClient.isRateLimited({ status: 409, body: { Error: 'Too many requests.', RateLimitResetTime: '2026-11-01T10:00:00Z' } })).toBe(true);
        expect(sellercloudClient.isRateLimited({ status: 409, body: { Message: 'Order is locked' } })).toBe(false);
        expect(sellercloudClient.isRateLimited({ status: 429, body: null })).toBe(true);
    });

    it('does not repeat a write that got a plain 409', async () => {
        const auth = { serverUrl: 'https://w.example.test/rest', username: 'u', password: 'p' };
        const send = vi.spyOn(httpClient, 'sendRequest').mockImplementation(async (request) => {
            if (request.url.endsWith('/token')) {
                return { status: 200, headers: {}, body: { access_token: 't', expires_in: 3600 } };
            }
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
