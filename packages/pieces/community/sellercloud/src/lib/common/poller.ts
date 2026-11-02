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
async function poll<T>({ store, fingerprint, fetchItems, emitUnseen, retentionMs, overlapMs, now = Date.now() }: PollParams<T>): Promise<PollEmission<T>[]> {
    const state = await readState({ store, fingerprint });
    if (state === null) {
        await baseline({ store, fingerprint, fetchItems, retentionMs, now, sinceMs: now - overlapMs });
        return [];
    }
    const cursor = state.cursor ?? { sinceMs: state.lastPollAt - overlapMs, page: 1, startedAt: now, baseline: false };
    const result = await fetchItems({ since: new Date(cursor.sinceMs), startPage: cursor.page, seen: state.seen });
    const emissions = result.items
        .filter((item) => item.eligible)
        .flatMap((item): TimedEmission<T>[] => {
            const previous = state.seen[item.key];
            if (previous === undefined) {
                return emitUnseen && !isHistory({ item, cursor }) ? [{ item: item.data, previousState: null, eventTime: item.eventTime }] : [];
            }
            return previous[0] === item.state ? [] : [{ item: item.data, previousState: previous[0], eventTime: item.eventTime }];
        });
    await writeState({ store, state: nextState({ state, cursor, result, now, retentionMs, fingerprint }) });
    return sortByEventTime({ emissions });
}

// While a baseline is still being read, an unseen record is history unless it happened
// after the baseline started; a change to a record the baseline already holds is real.
function isHistory<T>({ item, cursor }: { item: PolledItem<T>; cursor: PollCursor }): boolean {
    return cursor.baseline && (item.eventTime === null || item.eventTime <= cursor.startedAt);
}

// Records everything currently visible without emitting, so enabling a trigger does not
// replay history. A window too big for one call is finished by the following polls.
async function baseline<T>({ store, fingerprint, fetchItems, retentionMs, now = Date.now(), sinceMs }: BaselineParams<T>): Promise<void> {
    const cursor: PollCursor = { sinceMs, page: 1, startedAt: now, baseline: true };
    const result = await fetchItems({ since: new Date(sinceMs), startPage: 1, seen: {} });
    const empty: PollState = { v: STATE_VERSION, fp: fingerprint, lastPollAt: now, seen: {}, cursor: null };
    await writeState({ store, state: nextState({ state: empty, cursor, result, now, retentionMs, fingerprint }) });
}

// Publishing a flow disables and re-enables its trigger. Re-baselining there marked
// everything since the last poll as seen, so events in that gap were never reported.
// Existing state for the same trigger and settings is kept; a long-disabled trigger
// starts fresh rather than replaying everything it missed.
async function enable<T>({ store, fingerprint, fetchItems, retentionMs, sinceMs, now = Date.now() }: BaselineParams<T>): Promise<'resumed' | 'baselined'> {
    const state = await readState({ store, fingerprint });
    if (state !== null && now - state.lastPollAt <= Math.min(retentionMs, MAX_RESUME_GAP_MS)) {
        return 'resumed';
    }
    await baseline({ store, fingerprint, fetchItems, retentionMs, now, sinceMs });
    return 'baselined';
}

// The store is scoped to the flow, not to the flow version, so state left here survives
// the disable/enable that a publish performs. It is deliberately not cleared on disable.
async function disable(): Promise<void> {
    return;
}

function nextState<T>({ state, cursor, result, now, retentionMs, fingerprint }: NextStateParams<T>): PollState {
    const seen = mergeSeen({ seen: state.seen, items: result.items, now, retentionMs });
    if (result.truncated && result.nextPage > cursor.page) {
        // Re-read the last page next time: records added mid-window shift the pages.
        return { v: STATE_VERSION, fp: fingerprint, lastPollAt: state.lastPollAt, seen, cursor: { ...cursor, page: Math.max(cursor.page + 1, result.nextPage - 1) } };
    }
    return { v: STATE_VERSION, fp: fingerprint, lastPollAt: cursor.startedAt, seen, cursor: null };
}

function mergeSeen<T>({ seen, items, now, retentionMs }: { seen: Record<string, SeenEntry>; items: PolledItem<T>[]; now: number; retentionMs: number }): Record<string, SeenEntry> {
    const nowSec = Math.floor(now / 1000);
    const cutoffSec = Math.floor((now - retentionMs) / 1000);
    const merged: Record<string, SeenEntry> = {
        ...seen,
        ...Object.fromEntries(items.map((item) => [item.key, [item.state, nowSec] satisfies SeenEntry])),
    };
    const newestFirst = Object.entries(merged)
        .filter(([, entry]) => entry[1] >= cutoffSec)
        .sort((a, b) => b[1][1] - a[1][1]);
    return Object.fromEntries(fitToStore({ entries: newestFirst }));
}

// Store values are capped at 512 KB. Keys vary in length (order IDs vs SKU|warehouse),
// so the cap is on the serialised size rather than an entry count.
function fitToStore({ entries }: { entries: [string, SeenEntry][] }): [string, SeenEntry][] {
    const sizes = entries.map(([key, entry]) => key.length + JSON.stringify(entry).length + ENTRY_OVERHEAD_CHARS);
    const totals = sizes.reduce<number[]>((acc, size) => [...acc, (acc[acc.length - 1] ?? 0) + size], []);
    const fit = totals.findIndex((total) => total > MAX_SEEN_CHARS);
    return fit === -1 ? entries : entries.slice(0, fit);
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
    return data;
}

function isPollState(value: unknown): value is PollState {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate: Partial<Record<keyof PollState, unknown>> = Object.fromEntries(Object.entries(value));
    return candidate.v === STATE_VERSION
        && typeof candidate.fp === 'string'
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
const STATE_VERSION = 2;
// Covers a late poll and clock skew between this worker and SellerCloud.
const OVERLAP_MS = 10 * 60 * 1000;
const MAX_RESUME_GAP_MS = 6 * 60 * 60 * 1000;
const MAX_SEEN_CHARS = 400 * 1024;
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
    cursor: PollCursor | null;
};

type PollParams<T> = {
    store: PollStore;
    fingerprint: string;
    fetchItems: FetchItems<T>;
    emitUnseen: boolean;
    retentionMs: number;
    overlapMs: number;
    now?: number;
};

type BaselineParams<T> = {
    store: PollStore;
    fingerprint: string;
    fetchItems: FetchItems<T>;
    retentionMs: number;
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
};
