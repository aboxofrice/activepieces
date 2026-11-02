import { createHash } from 'crypto';
import { tenantTime } from './tenant-time';

// One polling engine for every SellerCloud trigger. Each poll fetches a window that
// overlaps the previous one, and dedupe is by key + state rather than by timestamp:
// SellerCloud returns tenant-local times without a zone, some records are back-dated to
// midnight, and lists are capped at 50 per page, so a pure "newer than" watermark loses
// records. Remembering what was seen (and in which state) makes overlap harmless.
//
// A window larger than one poll's page budget is not dropped: the poll records a cursor
// and the next poll carries on reading the same window from where it stopped. The
// watermark only moves once a window has been read to the end, so nothing between the
// pages read and the end of the window is lost, whatever order SellerCloud lists it in.
async function poll<T>({ store, fingerprint, fetchItems, emitUnseen, retentionMs, overlapMs, keepState, now = Date.now() }: PollParams<T>): Promise<PollEmission<T>[]> {
    const state = await readState({ store, fingerprint });
    if (state === null) {
        await baseline({ store, fingerprint, fetchItems, retentionMs, keepState, now, sinceMs: now - overlapMs });
        return [];
    }
    const cursor = state.cursor ?? { sinceMs: state.lastPollAt - overlapMs, page: 1, startedAt: now, baseline: false };
    const result = await fetchItems({ since: new Date(cursor.sinceMs), startPage: cursor.page, seen: state.seen });
    if (result.partialError) {
        console.warn(`SellerCloud trigger: stopped after the pages read so far (${result.partialError}); the next poll continues from there.`);
    }
    const forgotten = parseEvicted({ evicted: state.evicted, now });
    const emissions = lastPerKey({ items: result.items })
        .filter((item) => item.eligible)
        .flatMap((item): TimedEmission<T>[] => {
            const previous = state.seen[item.key];
            if (previous !== undefined) {
                return previous[0] === item.state ? [] : [{ item: item.data, previousState: previous[0], eventTime: item.eventTime }];
            }
            const forgottenState = forgotten.get(shortHash({ text: item.key, length: KEY_HASH_CHARS }));
            if (forgottenState !== undefined) {
                // Trimmed for space, not new: report it only if its state is different now.
                return forgottenState === shortHash({ text: item.state, length: STATE_HASH_CHARS }) ? [] : [{ item: item.data, previousState: null, eventTime: item.eventTime }];
            }
            return emitUnseen && !isHistory({ item, cursor }) ? [{ item: item.data, previousState: null, eventTime: item.eventTime }] : [];
        });
    await writeState({ store, state: nextState({ state, cursor, result, now, retentionMs, fingerprint, keepState }) });
    return sortByEventTime({ emissions });
}

// A record that shifts across a page boundary between two page reads comes back twice;
// the later copy is the fresher one.
function lastPerKey<T>({ items }: { items: PolledItem<T>[] }): PolledItem<T>[] {
    return [...new Map(items.map((item) => [item.key, item])).values()];
}

// While a baseline is still being read, an unseen record is history unless it happened
// after the baseline started; a change to a record the baseline already holds is real.
function isHistory<T>({ item, cursor }: { item: PolledItem<T>; cursor: PollCursor }): boolean {
    return cursor.baseline && (item.eventTime === null || item.eventTime <= cursor.startedAt);
}

// Records everything currently visible without emitting, so enabling a trigger does not
// replay history. A window too big for one call is finished by the following polls.
async function baseline<T>({ store, fingerprint, fetchItems, retentionMs, keepState, now = Date.now(), sinceMs }: BaselineParams<T>): Promise<void> {
    const cursor: PollCursor = { sinceMs, page: 1, startedAt: now, baseline: true };
    const result = await fetchItems({ since: new Date(sinceMs), startPage: 1, seen: {} });
    const empty: PollState = { v: STATE_VERSION, fp: fingerprint, lastPollAt: now, seen: {}, evicted: '', cursor: null };
    await writeState({ store, state: nextState({ state: empty, cursor, result, now, retentionMs, fingerprint, keepState }) });
}

// Publishing a flow disables and re-enables its trigger. Re-baselining there marked
// everything since the last poll as seen, so events in that gap were never reported.
// Existing state for the same trigger and settings is kept; a long-disabled trigger
// starts fresh rather than replaying everything it missed.
async function enable<T>({ store, fingerprint, fetchItems, retentionMs, sinceMs, keepState, now = Date.now() }: BaselineParams<T>): Promise<'resumed' | 'baselined'> {
    const state = await readState({ store, fingerprint });
    if (state !== null && now - state.lastPollAt <= Math.min(retentionMs, MAX_RESUME_GAP_MS)) {
        return 'resumed';
    }
    await baseline({ store, fingerprint, fetchItems, retentionMs, keepState, now, sinceMs });
    return 'baselined';
}

// The store is scoped to the flow, not to the flow version, so state left here survives
// the disable/enable that a publish performs. It is deliberately not cleared on disable.
async function disable(): Promise<void> {
    return;
}

function nextState<T>({ state, cursor, result, now, retentionMs, fingerprint, keepState }: NextStateParams<T>): PollState {
    const { seen, trimmed } = mergeSeen({ seen: state.seen, items: lastPerKey({ items: result.items }), now, retentionMs, keepState });
    const evicted = mergeEvicted({ evicted: state.evicted, trimmed, seen, now });
    if (result.truncated && result.nextPage > cursor.page) {
        // Re-read the last page next time: records added mid-window shift the pages.
        return { v: STATE_VERSION, fp: fingerprint, lastPollAt: state.lastPollAt, seen, evicted, cursor: { ...cursor, page: Math.max(cursor.page + 1, result.nextPage - 1) } };
    }
    return { v: STATE_VERSION, fp: fingerprint, lastPollAt: cursor.startedAt, seen, evicted, cursor: null };
}

// `keepState` entries are trimmed last: in low-stock mode only full "low" entries are
// re-read for recovery, so they are the ones worth keeping in full.
function mergeSeen<T>({ seen, items, now, retentionMs, keepState }: { seen: Record<string, SeenEntry>; items: PolledItem<T>[]; now: number; retentionMs: number; keepState?: string }): { seen: Record<string, SeenEntry>; trimmed: [string, SeenEntry][] } {
    const nowSec = Math.floor(now / 1000);
    const cutoffSec = Math.floor((now - retentionMs) / 1000);
    const merged: Record<string, SeenEntry> = {
        ...seen,
        ...Object.fromEntries(items.map((item) => [item.key, [item.state, nowSec] satisfies SeenEntry])),
    };
    const newestFirst = Object.entries(merged)
        .filter(([, entry]) => entry[1] >= cutoffSec)
        .sort((a, b) => Number(b[1][0] === keepState) - Number(a[1][0] === keepState) || b[1][1] - a[1][1]);
    const fit = fitCount({ entries: newestFirst });
    return { seen: Object.fromEntries(newestFirst.slice(0, fit)), trimmed: newestFirst.slice(fit) };
}

// Store values are capped at 512 KB. Keys vary in length (order IDs vs SKU|warehouse),
// so the cap is on the serialised size rather than an entry count.
function fitCount({ entries }: { entries: [string, SeenEntry][] }): number {
    let total = 0;
    for (let index = 0; index < entries.length; index++) {
        const [key, entry] = entries[index];
        total += key.length + JSON.stringify(entry).length + ENTRY_OVERHEAD_CHARS;
        if (total > MAX_SEEN_CHARS) {
            return index;
        }
    }
    return entries.length;
}

// Entries trimmed for space keep a fixed-width fingerprint (key hash + state hash + day),
// about a third of the size, so a busy warehouse whose low products outgrow the full
// entries does not report every one of them again after the next bulk update. A trimmed
// product cannot be re-read for recovery, so its fingerprint expires after a bounded time
// and the product is then treated as new again; past the fingerprint cap a warning is logged.
function mergeEvicted({ evicted, trimmed, seen, now }: { evicted: string; trimmed: [string, SeenEntry][]; seen: Record<string, SeenEntry>; now: number }): string {
    const today = dayOf({ ms: now });
    const remembered = new Set(Object.keys(seen).map((key) => shortHash({ text: key, length: KEY_HASH_CHARS })));
    const fresh = trimmed.map(([key, entry]) => shortHash({ text: key, length: KEY_HASH_CHARS }) + shortHash({ text: entry[0], length: STATE_HASH_CHARS }) + today.toString(16).padStart(DAY_CHARS, '0'));
    const freshKeys = new Set(fresh.map((token) => token.slice(0, KEY_HASH_CHARS)));
    const older = liveTokens({ evicted, now }).filter((token) => !freshKeys.has(token.slice(0, KEY_HASH_CHARS)));
    const all = [...fresh, ...older].filter((token) => !remembered.has(token.slice(0, KEY_HASH_CHARS)));
    if (all.length > MAX_EVICTED) {
        console.warn(`SellerCloud trigger: watching more records than its state can hold (${all.length + Object.keys(seen).length}); ${all.length - MAX_EVICTED} of the least recently seen may be reported again. Narrow the trigger (warehouse, company or threshold).`);
    }
    return all.slice(0, MAX_EVICTED).join('');
}

function parseEvicted({ evicted, now }: { evicted: string; now: number }): Map<string, string> {
    return new Map(liveTokens({ evicted, now }).map((token) => [token.slice(0, KEY_HASH_CHARS), token.slice(KEY_HASH_CHARS, KEY_HASH_CHARS + STATE_HASH_CHARS)]));
}

function liveTokens({ evicted, now }: { evicted: string; now: number }): string[] {
    const width = KEY_HASH_CHARS + STATE_HASH_CHARS + DAY_CHARS;
    const oldestDay = dayOf({ ms: now }) - EVICTED_TTL_DAYS;
    return Array.from({ length: Math.floor(evicted.length / width) }, (_, index) => evicted.slice(index * width, (index + 1) * width))
        .filter((token) => Number.parseInt(token.slice(KEY_HASH_CHARS + STATE_HASH_CHARS), 16) >= oldestDay);
}

function dayOf({ ms }: { ms: number }): number {
    return Math.floor(ms / DAY_MS);
}

function shortHash({ text, length }: { text: string; length: number }): string {
    return createHash('sha1').update(text).digest('hex').slice(0, length);
}

function sortByEventTime<T>({ emissions }: { emissions: TimedEmission<T>[] }): PollEmission<T>[] {
    return emissions
        .map((emission, index) => ({ emission, index }))
        .sort((a, b) => (a.emission.eventTime ?? Number.MAX_SAFE_INTEGER) - (b.emission.eventTime ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
        .map(({ emission }) => ({ item: emission.item, previousState: emission.previousState }));
}

// Only a missing key means "no state". A store outage must fail the poll, not quietly
// re-baseline and mark the events in the outage as seen.
async function readState({ store, fingerprint }: { store: PollStore; fingerprint: string }): Promise<PollState | null> {
    const data = await store.get<unknown>(STATE_KEY);
    if (!isPollState(data) || data.fp !== fingerprint) {
        return null;
    }
    return { ...data, evicted: data.evicted ?? '' };
}

function isPollState(value: unknown): value is PollState {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate: Partial<Record<keyof PollState, unknown>> = Object.fromEntries(Object.entries(value));
    return candidate.v === STATE_VERSION
        && typeof candidate.fp === 'string'
        && (candidate.evicted === undefined || typeof candidate.evicted === 'string')
        && typeof candidate.lastPollAt === 'number'
        && typeof candidate.seen === 'object' && candidate.seen !== null
        && (candidate.cursor === null || candidate.cursor === undefined || isCursor(candidate.cursor));
}

function isCursor(value: unknown): value is PollCursor {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate: Partial<Record<keyof PollCursor, unknown>> = Object.fromEntries(Object.entries(value));
    return typeof candidate.sinceMs === 'number' && typeof candidate.page === 'number' && typeof candidate.startedAt === 'number' && typeof candidate.baseline === 'boolean';
}

async function writeState({ store, state }: { store: PollStore; state: PollState }): Promise<void> {
    await store.put(STATE_KEY, state);
}

// The settings a trigger's state depends on. A changed filter means the remembered set no
// longer describes what the trigger watches, so it starts again from a baseline.
function fingerprintOf({ trigger, settings }: { trigger: string; settings: unknown }): string {
    return `${trigger}:${JSON.stringify(settings ?? null)}`;
}

function toEventTime({ tenantLocal }: { tenantLocal: string | null | undefined }): number | null {
    const utc = tenantTime.tenantLocalToUtc({ value: tenantLocal });
    return utc === null ? null : Date.parse(utc);
}

const STATE_KEY = 'sellercloud_poll_state';
const STATE_VERSION = 3;
// Covers a late poll and clock skew between this worker and SellerCloud.
const OVERLAP_MS = 10 * 60 * 1000;
const MAX_RESUME_GAP_MS = 6 * 60 * 60 * 1000;
const MAX_SEEN_CHARS = 320 * 1024;
const KEY_HASH_CHARS = 8;
const STATE_HASH_CHARS = 2;
const MAX_EVICTED = 11000;
const DAY_CHARS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const EVICTED_TTL_DAYS = 7;
const ENTRY_OVERHEAD_CHARS = 6;

export const sellercloudPoller = { poll, baseline, enable, disable, fingerprintOf, toEventTime, OVERLAP_MS };

export type PolledItem<T> = {
    key: string;
    state: string;
    eligible: boolean;
    eventTime: number | null;
    data: T;
};

export type PollEmission<T> = {
    item: T;
    previousState: string | null;
};

export type FetchResult<T> = {
    items: PolledItem<T>[];
    truncated: boolean;
    nextPage: number;
    partialError?: string;
};

export type SeenEntry = [string, number];

export type FetchItems<T> = (params: { since: Date; startPage: number; seen: Readonly<Record<string, SeenEntry>> }) => Promise<FetchResult<T>>;

export type PollStore = {
    get: <V>(key: string) => Promise<V | null>;
    put: <V>(key: string, value: V) => Promise<V>;
    delete: (key: string) => Promise<void>;
};

type TimedEmission<T> = PollEmission<T> & { eventTime: number | null };

type PollCursor = {
    sinceMs: number;
    page: number;
    startedAt: number;
    baseline: boolean;
};

type PollState = {
    v: number;
    fp: string;
    lastPollAt: number;
    seen: Record<string, SeenEntry>;
    evicted: string;
    cursor: PollCursor | null;
};

type PollParams<T> = {
    store: PollStore;
    fingerprint: string;
    fetchItems: FetchItems<T>;
    emitUnseen: boolean;
    retentionMs: number;
    overlapMs: number;
    keepState?: string;
    now?: number;
};

type BaselineParams<T> = {
    store: PollStore;
    fingerprint: string;
    fetchItems: FetchItems<T>;
    retentionMs: number;
    keepState?: string;
    now?: number;
    sinceMs: number;
};

type NextStateParams<T> = {
    state: PollState;
    cursor: PollCursor;
    result: FetchResult<T>;
    now: number;
    retentionMs: number;
    fingerprint: string;
    keepState?: string;
};
