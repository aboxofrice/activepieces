// Decides whether and how long to wait before repeating a failed SP-API call. Kept free of I/O
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

// Retry-After is either seconds or an HTTP date. SP-API rarely sends it, but every response
// carries x-amzn-RateLimit-Limit (requests per second), so one token's refill time is the
// shortest wait that can succeed.
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
    const rate = Number(headers.get('x-amzn-ratelimit-limit'));
    return Number.isFinite(rate) && rate > 0 ? Math.ceil(1000 / rate) : null;
}

function failureDelay({ failure, attempt, safeToRepeat, random }: { failure: RetryableFailure; attempt: number; safeToRepeat: boolean; random: () => number }): number | null {
    const jitter = Math.floor(random() * JITTER_MS);
    // getOrders restores one request a minute once its burst is spent, so the backoff has
    // to reach a minute or every retry lands inside the same empty bucket.
    const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
    if (failure.kind === 'network') {
        // A dropped connection or timeout may come after a write landed; only reads repeat.
        return safeToRepeat ? backoff + jitter : null;
    }
    // SP-API answers a throttled call with 429 before doing any work, so a 429 is safe to
    // repeat even for a write. A 5xx may mean the write landed, so only reads repeat it.
    if (failure.status === 429) {
        return Math.min(MAX_BACKOFF_MS, Math.max(failure.serverDelayMs ?? 0, backoff)) + jitter;
    }
    if (safeToRepeat && TRANSIENT_STATUSES.includes(failure.status)) {
        return Math.max(failure.serverDelayMs ?? 0, backoff) + jitter;
    }
    return null;
}

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;
const JITTER_MS = 1000;
const TRANSIENT_STATUSES = [500, 502, 503, 504];

export const spApiRetry = { delayBeforeRetry, serverRequestedDelayMs };

// A step has a few minutes in total; one request must not spend all of it waiting on a throttle.
export const MAX_TOTAL_RETRY_MS = 150000;

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
