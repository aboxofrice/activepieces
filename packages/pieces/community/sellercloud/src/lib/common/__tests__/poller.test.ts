import { describe, expect, it } from 'vitest';
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
