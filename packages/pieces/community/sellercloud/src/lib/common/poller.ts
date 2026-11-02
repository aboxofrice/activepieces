import { tryCatch } from '@activepieces/shared';

// One polling engine for every SellerCloud trigger. Each poll fetches a window that
// overlaps the previous one, and dedupe is by key + state rather than by timestamp:
// SellerCloud returns tenant-local times without a zone, some records are back-dated to
// midnight, and lists are capped at 50 per page, so a pure "newer than" watermark loses
// records. Remembering what was seen (and in which state) makes overlap harmless.
async function poll<T>({ store, fetchItems, emitUnseen, retentionMs, now = Date.now() }: PollParams<T>): Promise<PollEmission<T>[]> {
    const state = await readState({ store });
    if (state === null) {
        await baseline({ store, fetchItems, retentionMs, now, sinceMs: now - DEFAULT_LOOKBACK_MS });
        return [];
    }
    const items = await fetchItems({ since: new Date(state.lastPollAt - OVERLAP_MS) });
    const emissions = items
        .filter((item) => item.eligible)
        .flatMap((item): PollEmission<T>[] => {
            const previous = state.seen[item.key];
            if (previous === undefined) {
                return emitUnseen ? [{ item: item.data, previousState: null }] : [];
            }
            return previous[0] === item.state ? [] : [{ item: item.data, previousState: previous[0] }];
        });
    await writeState({ store, state: mergeSeen({ state, items, now, retentionMs }) });
    // Lists come back newest first; emit in the order things happened.
    return [...emissions].reverse();
}

// Records everything currently visible without emitting, so enabling a trigger does not
// replay history.
async function baseline<T>({ store, fetchItems, retentionMs, now = Date.now(), sinceMs }: BaselineParams<T>): Promise<void> {
    const items = await fetchItems({ since: new Date(sinceMs) });
    await writeState({ store, state: mergeSeen({ state: { lastPollAt: now, seen: {} }, items, now, retentionMs }) });
}

async function clear({ store }: { store: PollStore }): Promise<void> {
    await tryCatch(() => store.delete(STATE_KEY));
}

function mergeSeen<T>({ state, items, now, retentionMs }: { state: PollState; items: PolledItem<T>[]; now: number; retentionMs: number }): PollState {
    const nowSec = Math.floor(now / 1000);
    const cutoffSec = Math.floor((now - retentionMs) / 1000);
    const merged: Record<string, SeenEntry> = {
        ...state.seen,
        ...Object.fromEntries(items.map((item) => [item.key, [item.state, nowSec] satisfies SeenEntry])),
    };
    const kept = Object.entries(merged)
        .filter(([, entry]) => entry[1] >= cutoffSec)
        .sort((a, b) => b[1][1] - a[1][1])
        .slice(0, MAX_SEEN_ENTRIES);
    return { lastPollAt: now, seen: Object.fromEntries(kept) };
}

async function readState({ store }: { store: PollStore }): Promise<PollState | null> {
    const { data } = await tryCatch(() => store.get<PollState>(STATE_KEY));
    if (!data || typeof data.lastPollAt !== 'number' || typeof data.seen !== 'object' || data.seen === null) {
        return null;
    }
    return data;
}

async function writeState({ store, state }: { store: PollStore; state: PollState }): Promise<void> {
    await store.put(STATE_KEY, state);
}

const STATE_KEY = 'sellercloud_poll_state';
// Covers a late poll and clock skew between this worker and SellerCloud.
const OVERLAP_MS = 10 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 60 * 60 * 1000;
// Store values are capped at 512 KB; an entry is ~30 bytes.
const MAX_SEEN_ENTRIES = 8000;

export const sellercloudPoller = { poll, baseline, clear, OVERLAP_MS };

export type PolledItem<T> = {
    key: string;
    state: string;
    eligible: boolean;
    data: T;
};

export type PollEmission<T> = {
    item: T;
    previousState: string | null;
};

export type FetchItems<T> = (params: { since: Date }) => Promise<PolledItem<T>[]>;

export type PollStore = {
    get: <V>(key: string) => Promise<V | null>;
    put: <V>(key: string, value: V) => Promise<V>;
    delete: (key: string) => Promise<void>;
};

type SeenEntry = [string, number];

type PollState = {
    lastPollAt: number;
    seen: Record<string, SeenEntry>;
};

type PollParams<T> = {
    store: PollStore;
    fetchItems: FetchItems<T>;
    emitUnseen: boolean;
    retentionMs: number;
    now?: number;
};

type BaselineParams<T> = {
    store: PollStore;
    fetchItems: FetchItems<T>;
    retentionMs: number;
    now?: number;
    sinceMs: number;
};
