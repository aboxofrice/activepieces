import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_RETRY_MS, spApiRetry } from './retry';

const noJitter = () => 0;

describe('spApiRetry.delayBeforeRetry', () => {
    it('waits at least as long as the server asks on a 429', () => {
        const delay = spApiRetry.delayBeforeRetry({ failure: { kind: 'http', status: 429, serverDelayMs: 20000 }, attempt: 1, safeToRepeat: false, elapsedMs: 0, random: noJitter });
        expect(delay).toBe(20000);
    });

    it('retries network errors on reads only', () => {
        expect(spApiRetry.delayBeforeRetry({ failure: { kind: 'network' }, attempt: 1, safeToRepeat: true, elapsedMs: 0, random: noJitter })).toBe(2000);
        expect(spApiRetry.delayBeforeRetry({ failure: { kind: 'network' }, attempt: 1, safeToRepeat: false, elapsedMs: 0, random: noJitter })).toBeNull();
    });

    it('does not repeat a write after a 5xx', () => {
        expect(spApiRetry.delayBeforeRetry({ failure: { kind: 'http', status: 503, serverDelayMs: null }, attempt: 1, safeToRepeat: false, elapsedMs: 0, random: noJitter })).toBeNull();
    });

    it('gives up once the retry budget would be exceeded', () => {
        expect(spApiRetry.delayBeforeRetry({ failure: { kind: 'http', status: 429, serverDelayMs: null }, attempt: 3, safeToRepeat: true, elapsedMs: MAX_TOTAL_RETRY_MS - 1000, random: noJitter })).toBeNull();
    });
});

describe('spApiRetry.serverRequestedDelayMs', () => {
    it('reads Retry-After seconds, then the rate-limit header', () => {
        expect(spApiRetry.serverRequestedDelayMs({ headers: new Headers({ 'Retry-After': '3' }), now: 0 })).toBe(3000);
        expect(spApiRetry.serverRequestedDelayMs({ headers: new Headers({ 'x-amzn-RateLimit-Limit': '0.0167' }), now: 0 })).toBe(59881);
        expect(spApiRetry.serverRequestedDelayMs({ headers: new Headers(), now: 0 })).toBeNull();
    });
});
