import { Store } from '@activepieces/pieces-framework';
import { turn14Client } from './client';
import { Turn14Inventory, turn14Inventory } from './inventory';
import { turn14Polling } from './polling';

// One Inventory Changed poll. /v1/inventory/updates only takes fixed look-back windows, so each
// poll reads a window that overlaps the previous one, and a persisted set of (item, fingerprint)
// entries makes each change fire once. Entries are kept for a full day plus overlap whatever the
// window, so an item that reappears after a long gap is not mistaken for a new change; they are
// stored in hourly buckets so a poll only rewrites the current hour. Turn14 posts most of a day's
// updates in one burst (hundreds of pages), so a read that hits the deadline keeps its place: the
// watermark is held, the next poll continues from the next page, and when the scan finishes the
// watermark becomes the time the scan started, so nothing posted mid-scan is skipped.
async function runInventoryCheck({ store, now, deadline, filter, includeEta, readUpdates }: InventoryCheckParams): Promise<InventoryCheckResult> {
    const state = (await turn14Polling.readState({ store, key: STATE_KEY, isValid: isState })) ?? { lastPollAt: now - DEFAULT_LOOKBACK_MS };
    const lagMinutes = Math.ceil((now - state.lastPollAt) / 60000) + WINDOW_OVERLAP_MINUTES;
    const bucket = windowFor({ minutes: lagMinutes });
    const resume = state.resume && state.resume.window >= bucket ? state.resume : null;
    const window = resume ? resume.window : bucket;
    const scanStartedAt = resume ? resume.scanStartedAt : now;
    const { rows, nextPage } = await readUpdates({ window, startPage: resume ? resume.nextPage : 1, deadline });
    // Turn14 keeps at most a day of updates; anything older than that is gone.
    const truncated = lagMinutes > MAX_WINDOW_MINUTES;
    const buckets = await readBuckets({ store, hours: state.buckets ?? [] });
    const oldestHour = oldestKeptHour({ now, window });
    const seen = new Map(buckets.filter((entry) => entry.hour >= oldestHour).flatMap((entry) => [...entry.entries]));
    const changes = detectChanges({ rows: rows.filter((row) => filter === null || filter.has(row.id)), seen, includeEta, now, truncated });
    const hours = await writeBuckets({ store, buckets, changes, now, window });
    // Finishing the scan the enable-time seed could not complete: those rows may predate enabling.
    const unsure = state.unsure === true && resume !== null;
    const nextState: InventoryState = nextPage === null
        ? { lastPollAt: scanStartedAt, buckets: hours }
        : { lastPollAt: state.lastPollAt, resume: { window, nextPage, scanStartedAt }, buckets: hours, ...(unsure ? { unsure: true } : {}) };
    await store.put(STATE_KEY, nextState);
    if (nextPage !== null || truncated) {
        console.warn(`[turn14] Inventory Changed: ${truncated ? `last check was ${lagMinutes} minutes ago, beyond Turn14's ${MAX_WINDOW_MINUTES}-minute limit, so older changes were missed. ` : ''}${nextPage !== null ? `Window of ${window} minutes not finished; the next check continues at page ${nextPage}.` : ''}`);
    }
    return { outputs: changes.map((change) => ({ ...change.output, possibly_before_enable: unsure })), truncated, finished: nextPage === null };
}

// Records everything Turn14 currently reports as already seen, so only later changes fire. If the
// window cannot be read in full, its cursor is kept and the first polls finish it; rows have no
// timestamp, so those rows fire flagged possibly_before_enable rather than being swallowed.
async function seedInventoryState({ store, now, deadline, filter, includeEta, readUpdates }: InventoryCheckParams): Promise<void> {
    await clearInventoryState({ store });
    const window = UPDATE_WINDOWS_MINUTES[0];
    const { rows, nextPage } = await readUpdates({ window, startPage: 1, deadline });
    const changes = detectChanges({ rows: rows.filter((row) => filter === null || filter.has(row.id)), seen: new Map(), includeEta, now, truncated: false });
    const hours = await writeBuckets({ store, buckets: [], changes, now, window });
    const state: InventoryState = nextPage === null
        ? { lastPollAt: now, buckets: hours }
        : { lastPollAt: now, resume: { window, nextPage, scanStartedAt: now }, buckets: hours, unsure: true };
    await store.put(STATE_KEY, state);
}

async function hasInventoryState({ store }: { store: Store }): Promise<boolean> {
    return (await turn14Polling.readState({ store, key: STATE_KEY, isValid: isState })) !== null;
}

async function clearInventoryState({ store }: { store: Store }): Promise<void> {
    const state = await turn14Polling.readState({ store, key: STATE_KEY, isValid: isState });
    await Promise.all((state?.buckets ?? []).map((hour) => turn14Polling.deleteIdSet({ store, prefix: bucketPrefix({ hour }) })));
    await store.delete(STATE_KEY);
}

async function readBuckets({ store, hours }: { store: Store; hours: number[] }): Promise<SeenBucket[]> {
    const sorted = [...hours].sort((left, right) => left - right);
    return Promise.all(sorted.map(async (hour) => {
        const encoded = await turn14Polling.readIdSet({ store, prefix: bucketPrefix({ hour }) });
        return { hour, entries: new Map([...encoded].flatMap((value) => decodeEntry({ encoded: value }))) };
    }));
}

// Adds this poll's changes to the current hour's bucket, drops buckets older than the retention and
// returns the hours still stored.
async function writeBuckets({ store, buckets, changes, now, window }: { store: Store; buckets: SeenBucket[]; changes: InventoryChange[]; now: number; window: number }): Promise<number[]> {
    const oldestHour = oldestKeptHour({ now, window });
    const currentHour = Math.floor(now / HOUR_MS);
    const expired = buckets.filter((entry) => entry.hour < oldestHour);
    await Promise.all(expired.map((entry) => turn14Polling.deleteIdSet({ store, prefix: bucketPrefix({ hour: entry.hour }) })));
    const current = buckets.find((entry) => entry.hour === currentHour);
    if (changes.length > 0 || current === undefined) {
        const entries = new Map([...(current?.entries ?? []), ...changes.map((change): [string, SeenEntry] => [change.id, change.entry])]);
        await turn14Polling.writeIdSet({ store, prefix: bucketPrefix({ hour: currentHour }), ids: [...entries].map(([id, entry]) => encodeEntry({ id, entry })), chunkSize: SEEN_CHUNK_SIZE });
    }
    return [...new Set([...buckets.filter((entry) => entry.hour >= oldestHour).map((entry) => entry.hour), currentHour])].sort((left, right) => left - right);
}

function oldestKeptHour({ now, window }: { now: number; window: number }): number {
    const retentionMs = Math.max(window + WINDOW_OVERLAP_MINUTES * 2, SEEN_RETENTION_MINUTES) * 60000;
    return Math.floor((now - retentionMs) / HOUR_MS);
}

function bucketPrefix({ hour }: { hour: number }): string {
    return `${SEEN_PREFIX}_${hour}`;
}

function detectChanges({ rows, seen, includeEta, now, truncated }: { rows: Turn14Inventory[]; seen: Map<string, SeenEntry>; includeEta: boolean; now: number; truncated: boolean }): InventoryChange[] {
    const flat = turn14Inventory.flattenInventory({ rows });
    const detectedAt = new Date(now).toISOString();
    // A burst can hold hundreds of thousands of rows, so this builds its maps in place.
    const latest = new Map(seen);
    const changes = new Map<string, InventoryChange>();
    rows.forEach((row, index) => {
        const hash = turn14Polling.fingerprint({ value: fingerprintSource({ row, includeEta }) });
        const previous = latest.get(row.id);
        if (previous && previous.hash === hash) {
            return;
        }
        const entry: SeenEntry = { hash, at: now, quantity: Number(flat[index]['total_quantity'] ?? 0) };
        latest.set(row.id, entry);
        changes.set(row.id, {
            id: row.id,
            entry,
            output: { ...flat[index], previous_total_quantity: previous ? previous.quantity : null, detected_at: detectedAt, truncated },
        });
    });
    return [...changes.values()];
}

function fingerprintSource({ row, includeEta }: { row: Turn14Inventory; includeEta: boolean }): unknown {
    const inventory = row.attributes?.inventory ?? {};
    const sortedInventory = Object.keys(inventory).sort().map((key) => [key, inventory[key]]);
    return includeEta
        ? [sortedInventory, row.attributes?.manufacturer?.stock ?? null, row.attributes?.eta ?? null, row.attributes?.manufacturer?.esd ?? null]
        : [sortedInventory, row.attributes?.manufacturer?.stock ?? null];
}

function encodeEntry({ id, entry }: { id: string; entry: SeenEntry }): string {
    return `${id}|${entry.hash}|${entry.at}|${entry.quantity}`;
}

function decodeEntry({ encoded }: { encoded: string }): [string, SeenEntry][] {
    const [id, hash, at, quantity] = encoded.split('|');
    const atMs = Number(at);
    const quantityValue = Number(quantity);
    if (!id || !hash || !Number.isFinite(atMs) || !Number.isFinite(quantityValue)) {
        return [];
    }
    return [[id, { hash, at: atMs, quantity: quantityValue }]];
}

function windowFor({ minutes }: { minutes: number }): number {
    return UPDATE_WINDOWS_MINUTES.find((window) => window >= minutes) ?? MAX_WINDOW_MINUTES;
}

function isState(value: unknown): value is InventoryState {
    if (!turn14Client.isRecord(value) || !turn14Polling.isNumber(value['lastPollAt'])) {
        return false;
    }
    const resume = value['resume'];
    const buckets = value['buckets'];
    const resumeValid = resume === undefined || (turn14Client.isRecord(resume) && turn14Polling.isNumber(resume['window']) && turn14Polling.isNumber(resume['nextPage']) && turn14Polling.isNumber(resume['scanStartedAt']));
    return resumeValid && (value['unsure'] === undefined || typeof value['unsure'] === 'boolean') && (buckets === undefined || (Array.isArray(buckets) && buckets.every(turn14Polling.isNumber)));
}

// Turn14 only accepts these window sizes for /v1/inventory/updates.
const UPDATE_WINDOWS_MINUTES = [15, 30, 60, 240, 480, 1440];
const MAX_WINDOW_MINUTES = 1440;
const WINDOW_OVERLAP_MINUTES = 5;
const DEFAULT_LOOKBACK_MS = 15 * 60 * 1000;
const SEEN_RETENTION_MINUTES = MAX_WINDOW_MINUTES + WINDOW_OVERLAP_MINUTES * 2;
const HOUR_MS = 60 * 60 * 1000;
// "078595|0123456789ab|1700000000000|12345" is about 40 characters; 8,000 stay well under 512 KB.
const SEEN_CHUNK_SIZE = 8000;
const STATE_KEY = 'turn14_inventory_changed_state';
const SEEN_PREFIX = 'turn14_inventory_seen';

export const turn14InventoryCheck = { runInventoryCheck, seedInventoryState, hasInventoryState, clearInventoryState, detectChanges, windowFor };

export type ReadUpdates = (input: { window: number; startPage: number; deadline: number }) => Promise<{ rows: Turn14Inventory[]; nextPage: number | null }>;

export type InventoryCheckResult = { outputs: Record<string, unknown>[]; truncated: boolean; finished: boolean };

export type SeenEntry = { hash: string; at: number; quantity: number };

export type InventoryChange = { id: string; entry: SeenEntry; output: Record<string, unknown> };

type InventoryState = { lastPollAt: number; resume?: { window: number; nextPage: number; scanStartedAt: number }; buckets?: number[]; unsure?: boolean };

type SeenBucket = { hour: number; entries: Map<string, SeenEntry> };

type InventoryCheckParams = {
    store: Store;
    now: number;
    deadline: number;
    filter: Set<string> | null;
    includeEta: boolean;
    readUpdates: ReadUpdates;
};
