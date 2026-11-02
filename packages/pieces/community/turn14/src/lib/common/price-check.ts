import { Store } from '@activepieces/pieces-framework';
import { turn14Client } from './client';
import { turn14Orders } from './orders';
import { turn14Polling } from './polling';
import { FlatPricing } from './pricing';

// One Price Changed poll. Each day's change list is read from a stored page cursor, so a busy day
// is worked through across polls instead of re-reading page 1 every time; when a day's last page
// has been read the cursor wraps to page 1 and the next sweep starts. Reading the lists gets the
// first share of the time budget and the price lookups the rest, so carried-over lookups always
// make progress. Nothing is saved until the lookups are done, so a run that fails part-way is
// simply repeated. Changes that were due a lookup but did not get one are carried to the next poll.
// Today is read first; yesterday, once read to the end, is only re-swept every 30 minutes, so
// today's changes never wait behind a full re-read of yesterday.
async function runPriceCheck({ store, now, deadline, fetchChangedIds, priceItems, includePricing, maxLookups }: PriceCheckParams): Promise<PriceCheckResult> {
    const dates = datesToCheck({ now });
    const listDeadline = now + Math.floor((deadline - now) * LIST_SHARE);
    const state = await turn14Polling.readState({ store, key: STATE_KEY, isValid: isState });
    const pending = parseChanges({ entries: [...await turn14Polling.readIdSet({ store, prefix: PENDING_PREFIX })] });
    const pendingKeys = new Set(pending.map((change) => changeKey({ change })));
    const perDate = await dates.reduce<Promise<DateScan[]>>(async (previous, date) => {
        const collected = await previous;
        const startPage = state?.cursors?.[date] ?? 1;
        const seeding = state?.seeding?.includes(date) ?? false;
        const unsure = state?.unsure?.includes(date) ?? false;
        const sweptAt = state?.sweptAt?.[date] ?? null;
        const recentlySwept = date !== dates[0] && startPage === 1 && sweptAt !== null && now - sweptAt < RESWEEP_MS && !seeding && !unsure;
        if (recentlySwept) {
            return [...collected, { date, seen: new Set<string>(), fresh: [], seededIds: [], startPage, nextPage: null, seeding: false, unsure: false, sweptAt, skipped: true }];
        }
        const { itemIds, nextPage } = await fetchChangedIds({ date, startPage, deadline: listDeadline });
        const seen = await turn14Polling.readIdSet({ store, prefix: seenPrefix({ date }) });
        const unseen = itemIds.filter((itemId) => !seen.has(itemId) && !pendingKeys.has(changeKey({ change: { itemId, date } })));
        return [...collected, {
            date,
            seen,
            fresh: seeding ? [] : unseen.map((itemId) => ({ itemId, date })),
            seededIds: seeding ? unseen : [],
            startPage,
            nextPage,
            seeding: seeding && nextPage !== null,
            unsure: unsure && nextPage !== null,
            sweptAt: nextPage === null ? now : sweptAt,
            skipped: false,
        }];
    }, Promise.resolve([]));
    const candidates = [...pending, ...perDate.flatMap((scan) => scan.fresh)];
    const lookupCap = includePricing ? Math.min(MAX_LOOKUPS_PER_POLL, Math.max(0, Math.floor(maxLookups))) : 0;
    const toPrice = candidates.slice(0, lookupCap);
    const priced = toPrice.length > 0 ? await priceItems({ itemIds: toPrice.map((change) => change.itemId), deadline }) : [];
    const deferred = toPrice.slice(priced.length);
    const truncated = perDate.some((scan) => scan.nextPage !== null);
    // Turn14's change rows carry no timestamp, so on the day the trigger was enabled a change read
    // after enabling may predate it; such rows fire (rather than being swallowed) and say so.
    const unsureDates = new Set(state?.unsure ?? []);
    const flags = (change: Change) => ({ truncated, possibly_before_enable: unsureDates.has(change.date) });
    const rows = [
        ...toPrice.slice(0, priced.length).map((change, index) => ({ item_id: change.itemId, change_date: change.date, pricing_included: true, ...priced[index], ...flags(change) })),
        ...candidates.slice(lookupCap).map((change) => ({ item_id: change.itemId, change_date: change.date, pricing_included: false, ...flags(change) })),
    ];
    const emittedKeys = new Set(rows.map((row) => changeKey({ change: { itemId: row.item_id, date: row.change_date } })));
    await Promise.all(perDate.filter((scan) => !scan.skipped).map(async (scan) => {
        const emitted = candidates.filter((change) => change.date === scan.date && emittedKeys.has(changeKey({ change })) && !scan.seen.has(change.itemId)).map((change) => change.itemId);
        const added = [...emitted, ...scan.seededIds];
        if (added.length > 0 || state === null) {
            await turn14Polling.writeIdSet({ store, prefix: seenPrefix({ date: scan.date }), ids: [...scan.seen, ...added] });
        }
    }));
    await turn14Polling.writeIdSet({ store, prefix: PENDING_PREFIX, ids: deferred.map((change) => changeKey({ change })) });
    const expired = (state?.dates ?? []).filter((date) => !dates.includes(date));
    await Promise.all(expired.map((date) => turn14Polling.deleteIdSet({ store, prefix: seenPrefix({ date }) })));
    await store.put(STATE_KEY, stateAfter({ dates, perDate }));
    if (truncated) {
        console.warn(`[turn14] Price Changed: ${perDate.filter((scan) => scan.nextPage !== null).map((scan) => `${scan.date} read pages ${scan.startPage}-${(scan.nextPage ?? 1) - 1}, continuing at page ${scan.nextPage}`).join('; ')} on the next check.`);
    }
    return { rows, deferredCount: deferred.length, truncated };
}

// Marks every change Turn14 currently lists as seen, so only later changes fire. Today is read first
// so it gets the time. A day too long to read in one go keeps its cursor: yesterday stays in
// seeding mode (all of it predates enabling, so later polls mark it seen without firing until it
// has been read to the end once), while today's remaining changes fire flagged
// possibly_before_enable, since newly landed changes cannot be told apart from older ones.
async function seedPriceState({ store, now, deadline, fetchChangedIds }: { store: Store; now: number; deadline: number; fetchChangedIds: FetchChangedIds }): Promise<void> {
    await clearPriceState({ store });
    const dates = datesToCheck({ now });
    const perDate = await dates.reduce<Promise<DateScan[]>>(async (previous, date) => {
        const collected = await previous;
        const { itemIds, nextPage } = await fetchChangedIds({ date, startPage: 1, deadline });
        await turn14Polling.writeIdSet({ store, prefix: seenPrefix({ date }), ids: itemIds });
        const incomplete = nextPage !== null;
        const isEnableDay = date === dates[0];
        return [...collected, { date, seen: new Set<string>(), fresh: [], seededIds: [], startPage: 1, nextPage, seeding: incomplete && !isEnableDay, unsure: incomplete && isEnableDay, sweptAt: incomplete ? null : now, skipped: false }];
    }, Promise.resolve([]));
    await store.put(STATE_KEY, stateAfter({ dates, perDate }));
}

async function hasPriceState({ store }: { store: Store }): Promise<boolean> {
    return (await turn14Polling.readState({ store, key: STATE_KEY, isValid: isState })) !== null;
}

async function clearPriceState({ store }: { store: Store }): Promise<void> {
    const state = await turn14Polling.readState({ store, key: STATE_KEY, isValid: isState });
    await Promise.all((state?.dates ?? []).map((date) => turn14Polling.deleteIdSet({ store, prefix: seenPrefix({ date }) })));
    await turn14Polling.deleteIdSet({ store, prefix: PENDING_PREFIX });
    await store.delete(STATE_KEY);
}

function stateAfter({ dates, perDate }: { dates: string[]; perDate: DateScan[] }): PriceState {
    return {
        dates,
        cursors: Object.fromEntries(perDate.map((scan) => [scan.date, scan.nextPage ?? 1])),
        seeding: perDate.filter((scan) => scan.seeding).map((scan) => scan.date),
        unsure: perDate.filter((scan) => scan.unsure).map((scan) => scan.date),
        sweptAt: Object.fromEntries(perDate.flatMap((scan) => (scan.sweptAt === null ? [] : [[scan.date, scan.sweptAt]]))),
    };
}

// Turn14 dates its changes by day. Yesterday is re-checked so late-posted changes and the gap
// between Turn14's timezone and UTC are not missed. Today comes first.
function datesToCheck({ now }: { now: number }): string[] {
    return [turn14Orders.isoDate({ epochMs: now }), turn14Orders.isoDate({ epochMs: now - turn14Orders.DAY_MS })];
}

function parseChanges({ entries }: { entries: string[] }): Change[] {
    return entries.flatMap((entry) => {
        const [date, itemId] = entry.split('|');
        return date && itemId ? [{ date, itemId }] : [];
    });
}

function changeKey({ change }: { change: Change }): string {
    return `${change.date}|${change.itemId}`;
}

function seenPrefix({ date }: { date: string }): string {
    return `turn14_price_seen_${date}`;
}

function isState(value: unknown): value is PriceState {
    if (!turn14Client.isRecord(value) || !isStringList(value['dates'])) {
        return false;
    }
    const cursors = value['cursors'];
    const sweptAt = value['sweptAt'];
    const numberMap = (map: unknown) => map === undefined || (turn14Client.isRecord(map) && Object.values(map).every(turn14Polling.isNumber));
    const stringList = (list: unknown) => list === undefined || isStringList(list);
    return numberMap(cursors) && numberMap(sweptAt) && stringList(value['seeding']) && stringList(value['unsure']);
}

function isStringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

const STATE_KEY = 'turn14_price_changed_state';
const PENDING_PREFIX = 'turn14_price_pending';
const MAX_LOOKUPS_PER_POLL = 100;
const LIST_SHARE = 0.6;
const RESWEEP_MS = 30 * 60 * 1000;

export const turn14PriceCheck = { runPriceCheck, seedPriceState, hasPriceState, clearPriceState, datesToCheck, MAX_LOOKUPS_PER_POLL };

export type Change = { itemId: string; date: string };

export type FetchChangedIds = (input: { date: string; startPage: number; deadline: number }) => Promise<{ itemIds: string[]; nextPage: number | null }>;

export type PriceItems = (input: { itemIds: string[]; deadline: number }) => Promise<FlatPricing[]>;

export type PriceCheckResult = { rows: PriceRow[]; deferredCount: number; truncated: boolean };

export type PriceRow = { item_id: string; change_date: string; pricing_included: boolean; truncated: boolean } & Record<string, unknown>;

type DateScan = { date: string; seen: Set<string>; fresh: Change[]; seededIds: string[]; startPage: number; nextPage: number | null; seeding: boolean; unsure: boolean; sweptAt: number | null; skipped: boolean };

type PriceState = { dates: string[]; cursors?: Record<string, number>; seeding?: string[]; unsure?: string[]; sweptAt?: Record<string, number> };

type PriceCheckParams = {
    store: Store;
    now: number;
    deadline: number;
    fetchChangedIds: FetchChangedIds;
    priceItems: PriceItems;
    includePricing: boolean;
    maxLookups: number;
};
