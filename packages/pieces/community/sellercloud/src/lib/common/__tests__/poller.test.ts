import { afterEach, describe, expect, it, vi } from 'vitest';
import { sellercloudClient } from '../client';
import { sellercloudListing } from '../listing';
import { lowStock } from '../low-stock';
import { FetchItems, PolledItem, PollStore, sellercloudPoller } from '../poller';

describe('sellercloudPoller', () => {
    it('baselines on first enable and then reports only new records', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [record({ id: 1 }), record({ id: 2 })] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        source.records.push(record({ id: 3 }));
        const emitted = await poll({ store, fetchItems: source.fetch, now: T0 + MINUTE });
        expect(emitted).toEqual(['3']);
    });

    it('keeps its state across a disable and enable, so nothing in the gap is lost or repeated', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [record({ id: 1 })] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        source.records.push(record({ id: 2 }));
        expect(await poll({ store, fetchItems: source.fetch, now: T0 + MINUTE })).toEqual(['2']);

        // Publish: disable, an order arrives, enable, poll.
        await sellercloudPoller.disable();
        source.records.push(record({ id: 3 }));
        const outcome = await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 + 2 * MINUTE });
        expect(outcome).toBe('resumed');
        expect(await poll({ store, fetchItems: source.fetch, now: T0 + 3 * MINUTE })).toEqual(['3']);
        expect(await poll({ store, fetchItems: source.fetch, now: T0 + 4 * MINUTE })).toEqual([]);
    });

    it('starts again from a baseline when the trigger settings change', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [record({ id: 1 })] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        source.records.push(record({ id: 2 }));
        const outcome = await sellercloudPoller.enable({ store, fingerprint: 'other-settings', fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 + MINUTE });
        expect(outcome).toBe('baselined');
        expect(await poll({ store, fetchItems: source.fetch, now: T0 + 2 * MINUTE, fingerprint: 'other-settings' })).toEqual([]);
    });

    it('does not advance past a truncated window: the next polls read the rest', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [], pageSize: 2, maxPages: 2 });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        source.records.push(...Array.from({ length: 9 }, (_, index) => record({ id: 100 + index })));
        const first = await poll({ store, fetchItems: source.fetch, now: T0 + MINUTE });
        const second = await poll({ store, fetchItems: source.fetch, now: T0 + 2 * MINUTE });
        const third = await poll({ store, fetchItems: source.fetch, now: T0 + 3 * MINUTE });
        const fourth = await poll({ store, fetchItems: source.fetch, now: T0 + 4 * MINUTE });
        const fifth = await poll({ store, fetchItems: source.fetch, now: T0 + 5 * MINUTE });
        const all = [...first, ...second, ...third, ...fourth, ...fifth];
        expect(first).toHaveLength(4);
        expect(new Set(all).size).toBe(all.length);
        expect(all.sort()).toEqual(Array.from({ length: 9 }, (_, index) => String(100 + index)).sort());
        // Until the window is read to the end the same window is re-read; then the watermark
        // moves to when that window's read began.
        expect(source.sinceRequested.slice(1, 5).every((since) => since === T0 - sellercloudPoller.OVERLAP_MS)).toBe(true);
        expect(source.sinceRequested[5]).toBe(T0 + MINUTE - sellercloudPoller.OVERLAP_MS);
    });

    it('finishes a truncated baseline without emitting it', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: Array.from({ length: 7 }, (_, index) => record({ id: index + 1 })), pageSize: 2, maxPages: 2 });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        expect(await poll({ store, fetchItems: source.fetch, now: T0 + MINUTE })).toEqual([]);
        source.records.push(record({ id: 50, eventTime: T0 + 90 * 1000 }));
        const later = [
            ...await poll({ store, fetchItems: source.fetch, now: T0 + 2 * MINUTE }),
            ...await poll({ store, fetchItems: source.fetch, now: T0 + 3 * MINUTE }),
            ...await poll({ store, fetchItems: source.fetch, now: T0 + 4 * MINUTE }),
        ];
        expect(later).toEqual(['50']);
    });

    it('fails the poll on a store error instead of re-baselining', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [record({ id: 1 })] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        const broken: PollStore = { ...store, get: async () => {
            throw new Error('store unavailable');
        } };
        await expect(poll({ store: broken, fetchItems: source.fetch, now: T0 + MINUTE })).rejects.toThrow('store unavailable');
    });

    it('emits in the order things happened, whatever order the list came in', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        source.records.push(record({ id: 7, eventTime: 300 }), record({ id: 8, eventTime: 100 }), record({ id: 9, eventTime: 200 }));
        expect(await poll({ store, fetchItems: source.fetch, now: T0 + MINUTE })).toEqual(['8', '9', '7']);
    });

    it('reports a state change but not an unseen record when emitUnseen is off', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [record({ id: 1, state: '1' })] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        source.records[0] = record({ id: 1, state: '3' });
        source.records.push(record({ id: 2, state: '1' }));
        const emissions = await sellercloudPoller.poll({ store, fingerprint: FP, fetchItems: source.fetch, emitUnseen: false, retentionMs: DAY, overlapMs: sellercloudPoller.OVERLAP_MS, now: T0 + MINUTE });
        expect(emissions).toEqual([{ item: '1', previousState: '1' }]);
    });
});

describe('sellercloudPoller round 2', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reports a record once when it comes back twice in one poll (page shift)', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        source.records.push(record({ id: 5 }), record({ id: 6 }), record({ id: 5 }));
        expect(await poll({ store, fetchItems: source.fetch, now: T0 + MINUTE })).toEqual(['5', '6']);
    });

    it('does not re-report records trimmed for space when they come back unchanged', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const store = memoryStore();
        const lowProducts = Array.from({ length: 12000 }, (_, index) => ({ ...record({ id: index, state: 'low' }), key: `PDC-SKU-${String(index).padStart(8, '0')}-AWP|5` }));
        const source = fakeSource({ records: [...lowProducts], maxPages: 1000 });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: 7 * DAY, sinceMs: 0, now: T0 });
        const stored = await store.get<{ seen: Record<string, unknown>; evicted: string }>('sellercloud_poll_state');
        expect(Object.keys(stored?.seen ?? {}).length).toBeLessThan(12000);
        expect(stored?.evicted.length).toBeGreaterThan(0);
        // The next day's bulk update touches every product again, still low.
        const nextDay = await poll({ store, fetchItems: source.fetch, now: T0 + DAY });
        expect(nextDay).toEqual([]);
        // A trimmed product whose state did change is still reported.
        source.records[0] = { ...lowProducts[0], state: 'ok' };
        source.records[1] = { ...lowProducts[1], state: 'ok' };
        const changed = await poll({ store, fetchItems: source.fetch, now: T0 + DAY + MINUTE });
        expect(changed.length).toBeGreaterThan(0);
        expect(changed.length).toBeLessThanOrEqual(2);
        const size = Buffer.byteLength(JSON.stringify(await store.get('sellercloud_poll_state')), 'utf8');
        expect(size).toBeLessThan(512 * 1024);
    });

    it('trims "ok" entries before "low" ones in low-stock mode, so low products stay rechecked', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const store = memoryStore();
        const product = ({ index, state }: { index: number; state: string }) => ({ ...record({ id: index, state }), key: `PDC-SKU-${String(index).padStart(8, '0')}-AWP|5` });
        const low = Array.from({ length: 3000 }, (_, index) => product({ index, state: 'low' }));
        const ok = Array.from({ length: 9000 }, (_, index) => product({ index: 10000 + index, state: 'ok' }));
        const source = fakeSource({ records: [...low], maxPages: 1000 });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: 30 * DAY, sinceMs: 0, keepState: 'low', now: T0 });
        // The "ok" products are seen later, so they are the most recent entries.
        source.records.splice(0, source.records.length, ...ok);
        await sellercloudPoller.poll({ store, fingerprint: FP, fetchItems: source.fetch, emitUnseen: true, retentionMs: 30 * DAY, overlapMs: sellercloudPoller.OVERLAP_MS, keepState: 'low', now: T0 + MINUTE });
        const stored = await store.get<{ seen: Record<string, [string, number]> }>('sellercloud_poll_state');
        const seen = stored?.seen ?? {};
        expect(low.every((item) => seen[item.key]?.[0] === 'low')).toBe(true);
        expect(Object.keys(seen).length).toBeLessThan(low.length + ok.length);
        expect(lowStock.skusToRecheck({ seen, returned: new Set(), warehouseId: 5 })).toHaveLength(lowStock.MAX_RECHECK_PER_POLL);
    });

    it('expires a trimmed fingerprint after 7 days, so a product it hid is reported again', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const store = memoryStore();
        const products = Array.from({ length: 12000 }, (_, index) => ({ ...record({ id: index, state: 'low' }), key: `PDC-SKU-${String(index).padStart(8, '0')}-AWP|5` }));
        const source = fakeSource({ records: [...products], maxPages: 1000 });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: 30 * DAY, sinceMs: 0, now: T0 });
        const stored = await store.get<{ seen: Record<string, unknown> }>('sellercloud_poll_state');
        const trimmed = products.length - Object.keys(stored?.seen ?? {}).length;
        expect(trimmed).toBeGreaterThan(0);
        const pollAt = (now: number) => sellercloudPoller.poll({ store, fingerprint: FP, fetchItems: source.fetch, emitUnseen: true, retentionMs: 30 * DAY, overlapMs: sellercloudPoller.OVERLAP_MS, now });
        // Within 7 days the hidden products stay hidden (and seeing them refreshes the stamp)...
        expect(await pollAt(T0 + 6 * DAY)).toEqual([]);
        // ...but 7 days after they were last seen, the fingerprints are gone and they count as new.
        const afterExpiry = await pollAt(T0 + 14 * DAY);
        expect(afterExpiry.length).toBeGreaterThan(0);
        expect(afterExpiry.length).toBeLessThanOrEqual(trimmed);
    });

    it('keeps the progress of a poll whose later page failed', async () => {
        const store = memoryStore();
        const source = fakeSource({ records: [] });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems: source.fetch, retentionMs: DAY, sinceMs: 0, now: T0 });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const failing: FetchItems<string> = async ({ startPage }) => (startPage === 1
            ? { items: [record({ id: 1 }), record({ id: 2 })], truncated: true, nextPage: 3, partialError: 'page 3 failed' }
            : { items: [record({ id: 2 }), record({ id: 3 })], truncated: false, nextPage: 4 });
        expect(await poll({ store, fetchItems: failing, now: T0 + MINUTE })).toEqual(['1', '2']);
        const saved = await store.get<{ cursor: { page: number } | null }>('sellercloud_poll_state');
        expect(saved?.cursor?.page).toBe(2);
        expect(await poll({ store, fetchItems: failing, now: T0 + 2 * MINUTE })).toEqual(['3']);
    });

    it('returns the pages read when a later page fails, and throws when the first does', async () => {
        const auth = { serverUrl: 'https://p.example.test/rest', username: 'u', password: 'p' };
        vi.spyOn(sellercloudClient, 'request').mockImplementation(async ({ queryParams }) => {
            const page = Number(queryParams?.['model.pageNumber']);
            if (page >= 3) {
                throw new Error('SellerCloud GET /Orders failed: 504');
            }
            return { Items: [{ ID: page * 10 }], TotalResults: 500 };
        });
        const partial = await sellercloudListing.listPages<{ ID: number }>({ auth, token: 't', path: '/Orders', maxPages: 5, keepPartialOnError: true });
        expect(partial.items.map((item) => item.ID)).toEqual([10, 20]);
        expect(partial).toMatchObject({ truncated: true, nextPage: 3, partialError: 'SellerCloud GET /Orders failed: 504' });
        await expect(sellercloudListing.listPages({ auth, token: 't', path: '/Orders', maxPages: 5, startPage: 3, keepPartialOnError: true })).rejects.toThrow('504');
        await expect(sellercloudListing.listPages({ auth, token: 't', path: '/Orders', maxPages: 5 })).rejects.toThrow('504');
    });
});

describe('low stock recovery', () => {
    it('re-reads remembered low products that a poll did not return, oldest check first', () => {
        const skus = lowStock.skusToRecheck({
            seen: { 'A|5': ['low', 300], 'B|5': ['low', 100], 'C|5': ['ok', 50], 'D|5': ['low', 200], 'E|7': ['low', 10] },
            returned: new Set(['D|5']),
            warehouseId: 5,
        });
        expect(skus).toEqual(['B', 'A']);
    });

    it('fires again for a second drop after a recovery', async () => {
        const store = memoryStore();
        const quantities = new Map<string, number>([['SKU1', 5]]);
        const threshold = 0;
        // Mimics warehouse-only mode: the feed only returns products at or below the threshold,
        // and the recheck reads remembered-low products directly.
        const fetchItems: FetchItems<string> = async ({ seen }) => {
            const low = [...quantities.entries()].filter(([, qty]) => qty <= threshold).map(([sku]) => sku);
            const returned = new Set(low.map((sku) => `${sku}|5`));
            const recheck = lowStock.skusToRecheck({ seen, returned, warehouseId: 5 });
            const items = [...low, ...recheck].map((sku): PolledItem<string> => {
                const qty = quantities.get(sku) ?? 0;
                return { key: `${sku}|5`, state: qty <= threshold ? 'low' : 'ok', eligible: qty <= threshold, eventTime: null, data: sku };
            });
            return { items, truncated: false, nextPage: 1 };
        };
        const run = (now: number) => sellercloudPoller.poll({ store, fingerprint: FP, fetchItems, emitUnseen: true, retentionMs: 7 * DAY, overlapMs: sellercloudPoller.OVERLAP_MS, now });
        await sellercloudPoller.enable({ store, fingerprint: FP, fetchItems, retentionMs: 7 * DAY, sinceMs: 0, now: T0 });
        quantities.set('SKU1', 0);
        expect((await run(T0 + MINUTE)).map((emission) => emission.item)).toEqual(['SKU1']);
        quantities.set('SKU1', 10);
        expect(await run(T0 + 2 * MINUTE)).toEqual([]);
        quantities.set('SKU1', 0);
        expect((await run(T0 + 3 * MINUTE)).map((emission) => emission.item)).toEqual(['SKU1']);
    });
});

async function poll({ store, fetchItems, now, fingerprint = FP }: { store: PollStore; fetchItems: FetchItems<string>; now: number; fingerprint?: string }): Promise<string[]> {
    const emissions = await sellercloudPoller.poll({ store, fingerprint, fetchItems, emitUnseen: true, retentionMs: DAY, overlapMs: sellercloudPoller.OVERLAP_MS, now });
    return emissions.map((emission) => emission.item);
}

function record({ id, state = 'seen', eventTime = null }: { id: number; state?: string; eventTime?: number | null }): PolledItem<string> {
    return { key: String(id), state, eligible: true, eventTime, data: String(id) };
}

// A paged list whose window ignores `since` (every record is "in" it), like a busy window.
function fakeSource({ records, pageSize = 50, maxPages = 20 }: { records: PolledItem<string>[]; pageSize?: number; maxPages?: number }): { records: PolledItem<string>[]; sinceRequested: number[]; fetch: FetchItems<string> } {
    const sinceRequested: number[] = [];
    const fetch: FetchItems<string> = async ({ since, startPage }) => {
        sinceRequested.push(since.getTime());
        const from = (startPage - 1) * pageSize;
        const to = from + pageSize * maxPages;
        const items = records.slice(from, to);
        const truncated = records.length > to;
        return { items, truncated, nextPage: startPage + maxPages };
    };
    return { records, sinceRequested, fetch };
}

function memoryStore(): PollStore {
    const data = new Map<string, string>();
    return {
        get: async (key) => {
            const value = data.get(key);
            return value === undefined ? null : JSON.parse(value);
        },
        put: async (key, value) => {
            data.set(key, JSON.stringify(value));
            return value;
        },
        delete: async (key) => {
            data.delete(key);
        },
    };
}

const FP = 'test-trigger:{}';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const T0 = Date.UTC(2026, 10, 1, 12, 0, 0);
