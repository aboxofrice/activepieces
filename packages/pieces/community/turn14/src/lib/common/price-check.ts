import { Store } from '@activepieces/pieces-framework';
import { turn14Client } from './client';
import { turn14Orders } from './orders';
import { turn14Polling } from './polling';
import { FlatPricing } from './pricing';

// One Price Changed poll. Nothing is saved until the new prices have been looked up, so a run that
// fails or times out part-way is simply repeated. Lookups stop at the deadline; changes that were
// due a lookup but did not get one are carried to the next poll instead of being marked seen.
async function runPriceCheck({ store, now, deadline, fetchChangedIds, priceItems, includePricing, maxLookups }: PriceCheckParams): Promise<PriceCheckResult> {
    const dates = datesToCheck({ now });
    const state = await turn14Polling.readState({ store, key: STATE_KEY, isValid: isState });
    const pending = parseChanges({ entries: [...await turn14Polling.readIdSet({ store, prefix: PENDING_PREFIX })] });
    const pendingKeys = new Set(pending.map((change) => changeKey({ change })));
    const perDate = await dates.reduce<Promise<DateScan[]>>(async (previous, date) => {
        const collected = await previous;
        const { itemIds, truncated } = await fetchChangedIds({ date, deadline });
        const seen = await turn14Polling.readIdSet({ store, prefix: seenPrefix({ date }) });
        const fresh = itemIds.filter((itemId) => !seen.has(itemId) && !pendingKeys.has(changeKey({ change: { itemId, date } }))).map((itemId) => ({ itemId, date }));
        return [...collected, { date, seen, fresh, truncated }];
    }, Promise.resolve([]));
    const candidates = [...pending, ...perDate.flatMap((scan) => scan.fresh)];
    const lookupCap = includePricing ? Math.min(MAX_LOOKUPS_PER_POLL, Math.max(0, Math.floor(maxLookups))) : 0;
    const toPrice = candidates.slice(0, lookupCap);
    const priced = toPrice.length > 0 ? await priceItems({ itemIds: toPrice.map((change) => change.itemId), deadline }) : [];
    const deferred = toPrice.slice(priced.length);
    const truncated = perDate.some((scan) => scan.truncated);
    const rows = [
        ...toPrice.slice(0, priced.length).map((change, index) => ({ item_id: change.itemId, change_date: change.date, pricing_included: true, ...priced[index], truncated })),
        ...candidates.slice(lookupCap).map((change) => ({ item_id: change.itemId, change_date: change.date, pricing_included: false, truncated })),
    ];
    const emittedKeys = new Set(rows.map((row) => changeKey({ change: { itemId: row.item_id, date: row.change_date } })));
    await Promise.all(perDate.map(async (scan) => {
        const newlySeen = candidates.filter((change) => change.date === scan.date && emittedKeys.has(changeKey({ change })) && !scan.seen.has(change.itemId));
        if (newlySeen.length > 0 || state === null) {
            await turn14Polling.writeIdSet({ store, prefix: seenPrefix({ date: scan.date }), ids: [...scan.seen, ...newlySeen.map((change) => change.itemId)] });
        }
    }));
    await turn14Polling.writeIdSet({ store, prefix: PENDING_PREFIX, ids: deferred.map((change) => changeKey({ change })) });
    const expired = (state?.dates ?? []).filter((date) => !dates.includes(date));
    await Promise.all(expired.map((date) => turn14Polling.deleteIdSet({ store, prefix: seenPrefix({ date }) })));
    await store.put(STATE_KEY, { dates });
    if (truncated) {
        console.warn(`[turn14] Price Changed: the change list for ${perDate.filter((scan) => scan.truncated).map((scan) => scan.date).join(', ')} was not read in full; unread changes are picked up by a later poll.`);
    }
    return { rows, deferredCount: deferred.length, truncated };
}

// Marks every change Turn14 currently lists as seen, so only later changes fire.
async function seedPriceState({ store, now, deadline, fetchChangedIds }: { store: Store; now: number; deadline: number; fetchChangedIds: FetchChangedIds }): Promise<void> {
    await clearPriceState({ store });
    const dates = datesToCheck({ now });
    await dates.reduce<Promise<void>>(async (previous, date) => {
        await previous;
        const { itemIds } = await fetchChangedIds({ date, deadline });
        await turn14Polling.writeIdSet({ store, prefix: seenPrefix({ date }), ids: itemIds });
    }, Promise.resolve());
    await store.put(STATE_KEY, { dates });
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

// Turn14 dates its changes by day. Yesterday is re-checked so late-posted changes and the gap
// between Turn14's timezone and UTC are not missed.
function datesToCheck({ now }: { now: number }): string[] {
    return [turn14Orders.isoDate({ epochMs: now - turn14Orders.DAY_MS }), turn14Orders.isoDate({ epochMs: now })];
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

function isState(value: unknown): value is { dates: string[] } {
    return turn14Client.isRecord(value) && Array.isArray(value['dates']) && value['dates'].every((date) => typeof date === 'string');
}

const STATE_KEY = 'turn14_price_changed_state';
const PENDING_PREFIX = 'turn14_price_pending';
const MAX_LOOKUPS_PER_POLL = 100;

export const turn14PriceCheck = { runPriceCheck, seedPriceState, hasPriceState, clearPriceState, datesToCheck, MAX_LOOKUPS_PER_POLL };

export type Change = { itemId: string; date: string };

export type FetchChangedIds = (input: { date: string; deadline: number }) => Promise<{ itemIds: string[]; truncated: boolean }>;

export type PriceItems = (input: { itemIds: string[]; deadline: number }) => Promise<FlatPricing[]>;

export type PriceCheckResult = { rows: PriceRow[]; deferredCount: number; truncated: boolean };

export type PriceRow = { item_id: string; change_date: string; pricing_included: boolean; truncated: boolean } & Record<string, unknown>;

type DateScan = { date: string; seen: Set<string>; fresh: Change[]; truncated: boolean };

type PriceCheckParams = {
    store: Store;
    now: number;
    deadline: number;
    fetchChangedIds: FetchChangedIds;
    priceItems: PriceItems;
    includePricing: boolean;
    maxLookups: number;
};
