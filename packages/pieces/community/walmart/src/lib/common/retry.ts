// Decides whether and how long to wait before repeating a failed Walmart call. Kept free of I/O
// so the policy can be unit tested.
function delayBeforeRetry({ failure, attempt, safeToRepeat, elapsedMs, random = Math.random }: DelayParams): number | null {
    if (attempt >= MAX_ATTEMPTS) {
        return null;
    }
    const delay = failureDelay({ failure, attempt, safeToRepeat, random });
    if (delay === null || elapsedMs + delay > MAX_TOTAL_RETRY_MS) {
        return null;
    }
    return delay;
}

// Retry-After is seconds or an HTTP date; Walmart's throttling also reports when its token
// bucket refills (x-next-replenish-time, epoch ms).
function serverRequestedDelayMs({ headers, now }: { headers: Headers; now: number }): number | null {
    const retryAfter = headers.get('retry-after');
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds >= 0) {
            return seconds * 1000;
        }
        const date = Date.parse(retryAfter);
        if (!Number.isNaN(date)) {
            return Math.max(0, date - now);
        }
    }
    const replenishAt = Number(headers.get('x-next-replenish-time'));
    return Number.isFinite(replenishAt) && replenishAt > now ? replenishAt - now : null;
}

function failureDelay({ failure, attempt, safeToRepeat, random }: { failure: RetryableFailure; attempt: number; safeToRepeat: boolean; random: () => number }): number | null {
    const jitter = Math.floor(random() * JITTER_MS);
    const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
    if (failure.kind === 'network') {
        // A dropped connection or timeout may come after a write landed; only reads repeat.
        return safeToRepeat ? backoff + jitter : null;
    }
    // Walmart rejects a throttled call (429) before doing any work, so that is safe to repeat
    // for every method. A 5xx may come after the write was applied (repeating an inventory
    // update or a ship call is not harmless), so only reads repeat it.
    if (failure.status === 429) {
        return Math.min(MAX_BACKOFF_MS, Math.max(failure.serverDelayMs ?? 0, backoff)) + jitter;
    }
    if (safeToRepeat && TRANSIENT_STATUSES.includes(failure.status)) {
        return Math.max(failure.serverDelayMs ?? 0, backoff) + jitter;
    }
    return null;
}

const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 60000;
const JITTER_MS = 1000;
const TRANSIENT_STATUSES = [500, 502, 503, 504];

export const walmartRetry = { delayBeforeRetry, serverRequestedDelayMs };

// A step has a few minutes in total; one request must not spend all of it waiting on a throttle.
export const MAX_TOTAL_RETRY_MS = 120000;

export const REQUEST_TIMEOUT_MS = 60000;

export type RetryableFailure =
    | { kind: 'network' }
    | { kind: 'http'; status: number; serverDelayMs: number | null };

type DelayParams = {
    failure: RetryableFailure;
    attempt: number;
    safeToRepeat: boolean;
    elapsedMs: number;
    random?: () => number;
};
