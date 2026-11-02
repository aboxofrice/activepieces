import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_RETRY_MS, walmartRetry } from './retry';

const noJitter = () => 0;

describe('walmartRetry.delayBeforeRetry', () => {
    it('waits until the token bucket refills on a 429', () => {
        const serverDelayMs = walmartRetry.serverRequestedDelayMs({ headers: new Headers({ 'x-next-replenish-time': '1700000004000' }), now: 1700000000000 });
        expect(serverDelayMs).toBe(4000);
        expect(walmartRetry.delayBeforeRetry({ failure: { kind: 'http', status: 429, serverDelayMs }, attempt: 1, safeToRepeat: false, elapsedMs: 0, random: noJitter })).toBe(4000);
    });

    it('retries network errors and 5xx on reads only', () => {
        expect(walmartRetry.delayBeforeRetry({ failure: { kind: 'network' }, attempt: 1, safeToRepeat: true, elapsedMs: 0, random: noJitter })).toBe(1500);
        expect(walmartRetry.delayBeforeRetry({ failure: { kind: 'network' }, attempt: 1, safeToRepeat: false, elapsedMs: 0, random: noJitter })).toBeNull();
        expect(walmartRetry.delayBeforeRetry({ failure: { kind: 'http', status: 502, serverDelayMs: null }, attempt: 1, safeToRepeat: false, elapsedMs: 0, random: noJitter })).toBeNull();
    });

    it('stops within the retry budget', () => {
        expect(walmartRetry.delayBeforeRetry({ failure: { kind: 'http', status: 429, serverDelayMs: 30000 }, attempt: 2, safeToRepeat: true, elapsedMs: MAX_TOTAL_RETRY_MS - 10000, random: noJitter })).toBeNull();
    });
});
