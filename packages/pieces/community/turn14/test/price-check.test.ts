import { describe, expect, it } from 'vitest';
import { FetchChangedIds, PriceItems, turn14PriceCheck } from '../src/lib/common/price-check';
import { memoryStore } from './helpers';

const NOW = Date.parse('2026-11-01T15:00:00Z');
const TODAY = '2026-11-01';
const YESTERDAY = '2026-10-31';

function changes({ byDate }: { byDate: Record<string, string[]> }): FetchChangedIds {
    return async ({ date }) => ({ itemIds: byDate[date] ?? [], nextPage: null });
}

// A day split into pages; each call reads `perCall` pages from startPage.
function pagedChanges({ pages, perCall, calls, day = TODAY }: { pages: string[][]; perCall: number; calls?: { startPage: number; deadline: number }[]; day?: string }): FetchChangedIds {
    return async ({ date, startPage, deadline }) => {
        if (date !== day) {
            return { itemIds: [], nextPage: null };
        }
        calls?.push({ startPage, deadline });
        const last = Math.min(pages.length, startPage + perCall - 1);
        return { itemIds: pages.slice(startPage - 1, last).flat(), nextPage: last >= pages.length ? null : last + 1 };
    };
}

function pricer({ log, failWith, budget }: { log: string[]; failWith?: Error; budget?: number }): PriceItems {
    return async ({ itemIds }) => {
        log.push('price');
        if (failWith) {
            throw failWith;
        }
        return itemIds.slice(0, budget ?? itemIds.length).map((itemId) => ({ item_id: itemId, purchase_cost: 1, error: null }));
    };
}

describe('turn14PriceCheck.runPriceCheck', () => {
    it('saves nothing until pricing has been looked up', async () => {
        const store = memoryStore();
        const log = store.log;
        await turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds: changes({ byDate: { [TODAY]: ['1', '2'] } }), priceItems: pricer({ log }), includePricing: true, maxLookups: 10 });
        const priceIndex = log.indexOf('price');
        expect(priceIndex).toBeGreaterThanOrEqual(0);
        expect(log.slice(0, priceIndex).some((entry) => entry.startsWith('put:') || entry.startsWith('delete:'))).toBe(false);
    });

    it('leaves state untouched when the pricing lookup fails, so the next poll repeats the work', async () => {
        const store = memoryStore();
        const fetchChangedIds = changes({ byDate: { [TODAY]: ['1', '2'] } });
        await expect(turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds, priceItems: pricer({ log: [], failWith: new Error('boom') }), includePricing: true, maxLookups: 10 }))
            .rejects.toThrow('boom');
        expect(store.data.size).toBe(0);
        const retry = await turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds, priceItems: pricer({ log: [] }), includePricing: true, maxLookups: 10 });
        expect(retry.rows.map((row) => row.item_id)).toEqual(['1', '2']);
    });

    it('carries changes it ran out of time to price into the next poll, and fires each once', async () => {
        const store = memoryStore();
        const fetchChangedIds = changes({ byDate: { [TODAY]: ['1', '2', '3', '4'] } });
        const first = await turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds, priceItems: pricer({ log: [], budget: 1 }), includePricing: true, maxLookups: 3 });
        expect(first.rows.map((row) => [row.item_id, row.pricing_included])).toEqual([['1', true], ['4', false]]);
        expect(first.deferredCount).toBe(2);
        const second = await turn14PriceCheck.runPriceCheck({ store, now: NOW + 60000, deadline: NOW + 100000, fetchChangedIds, priceItems: pricer({ log: [] }), includePricing: true, maxLookups: 3 });
        expect(second.rows.map((row) => [row.item_id, row.pricing_included])).toEqual([['2', true], ['3', true]]);
        const third = await turn14PriceCheck.runPriceCheck({ store, now: NOW + 120000, deadline: NOW + 160000, fetchChangedIds, priceItems: pricer({ log: [] }), includePricing: true, maxLookups: 3 });
        expect(third.rows).toEqual([]);
    });

    it('caps lookups at 100 per poll whatever the setting', async () => {
        const store = memoryStore();
        const ids = Array.from({ length: 150 }, (_, index) => String(1000 + index));
        const result = await turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds: changes({ byDate: { [TODAY]: ids } }), priceItems: pricer({ log: [] }), includePricing: true, maxLookups: 5000 });
        expect(result.rows.filter((row) => row.pricing_included)).toHaveLength(turn14PriceCheck.MAX_LOOKUPS_PER_POLL);
        expect(result.rows).toHaveLength(150);
    });

    it('marks rows truncated when a day\'s change list was not read in full', async () => {
        const store = memoryStore();
        const fetchChangedIds: FetchChangedIds = async ({ date }) => ({ itemIds: date === TODAY ? ['1'] : [], nextPage: date === TODAY ? 2 : null });
        const result = await turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds, priceItems: pricer({ log: [] }), includePricing: false, maxLookups: 0 });
        expect(result.truncated).toBe(true);
        expect(result.rows[0].truncated).toBe(true);
    });

    it('does not fire for changes that existed when the trigger was enabled', async () => {
        const store = memoryStore();
        const fetchChangedIds = changes({ byDate: { [TODAY]: ['1', '2'] } });
        await turn14PriceCheck.seedPriceState({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds });
        const result = await turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds: changes({ byDate: { [TODAY]: ['1', '2', '3'] } }), priceItems: pricer({ log: [] }), includePricing: true, maxLookups: 10 });
        expect(result.rows.map((row) => row.item_id)).toEqual(['3']);
    });

    it('continues a long day from its page cursor and wraps to page 1 after the last page', async () => {
        const store = memoryStore();
        const calls: { startPage: number; deadline: number }[] = [];
        const fetchChangedIds = pagedChanges({ pages: [['1'], ['2'], ['3'], ['4'], ['5']], perCall: 2, calls });
        const run = (offset: number) => turn14PriceCheck.runPriceCheck({ store, now: NOW + offset, deadline: NOW + offset + 40000, fetchChangedIds, priceItems: pricer({ log: [] }), includePricing: false, maxLookups: 0 });
        const first = await run(0);
        const second = await run(60000);
        const third = await run(120000);
        const fourth = await run(180000);
        expect([first, second, third].map((result) => result.rows.map((row) => row.item_id))).toEqual([['1', '2'], ['3', '4'], ['5']]);
        expect([first.truncated, second.truncated, third.truncated]).toEqual([true, true, false]);
        expect(calls.map((call) => call.startPage)).toEqual([1, 3, 5, 1]);
        expect(fourth.rows).toEqual([]);
    });

    it('reserves part of the time budget for price lookups', async () => {
        const store = memoryStore();
        const calls: { startPage: number; deadline: number }[] = [];
        const lookupDeadlines: number[] = [];
        const priceItems: PriceItems = async ({ itemIds, deadline }) => {
            lookupDeadlines.push(deadline);
            return itemIds.map((itemId) => ({ item_id: itemId, error: null }));
        };
        await turn14PriceCheck.runPriceCheck({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds: pagedChanges({ pages: [['1']], perCall: 1, calls }), priceItems, includePricing: true, maxLookups: 10 });
        expect(calls[0].deadline).toBeLessThan(NOW + 30000);
        expect(lookupDeadlines).toEqual([NOW + 40000]);
    });

    it('keeps seeding yesterday when it could not be read in full at enable time, without firing its old changes', async () => {
        const store = memoryStore();
        const pages = [['1'], ['2'], ['3']];
        await turn14PriceCheck.seedPriceState({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds: pagedChanges({ pages, perCall: 1, day: YESTERDAY }) });
        const run = (offset: number, fetchChangedIds: FetchChangedIds) => turn14PriceCheck.runPriceCheck({ store, now: NOW + offset, deadline: NOW + offset + 40000, fetchChangedIds, priceItems: pricer({ log: [] }), includePricing: false, maxLookups: 0 });
        expect((await run(60000, pagedChanges({ pages, perCall: 1, day: YESTERDAY }))).rows).toEqual([]);
        expect((await run(120000, pagedChanges({ pages, perCall: 1, day: YESTERDAY }))).rows).toEqual([]);
        const later = await run(40 * 60000, pagedChanges({ pages: [['1', '4'], ['2'], ['3']], perCall: 3, day: YESTERDAY }));
        expect(later.rows.map((row) => row.item_id)).toEqual(['4']);
    });

    it('fires today\'s changes read after an incomplete seed, flagged possibly_before_enable, instead of swallowing them', async () => {
        const store = memoryStore();
        const pages = [['1'], ['2'], ['3']];
        await turn14PriceCheck.seedPriceState({ store, now: NOW, deadline: NOW + 40000, fetchChangedIds: pagedChanges({ pages, perCall: 1 }) });
        const run = (offset: number) => turn14PriceCheck.runPriceCheck({ store, now: NOW + offset, deadline: NOW + offset + 40000, fetchChangedIds: pagedChanges({ pages, perCall: 1 }), priceItems: pricer({ log: [] }), includePricing: false, maxLookups: 0 });
        const first = await run(60000);
        expect(first.rows.map((row) => [row.item_id, row['possibly_before_enable']])).toEqual([['2', true]]);
        const second = await run(120000);
        expect(second.rows.map((row) => [row.item_id, row['possibly_before_enable']])).toEqual([['3', true]]);
        expect((await run(180000)).rows).toEqual([]);
    });

    it('reads today first and re-sweeps a finished yesterday only every 30 minutes', async () => {
        const store = memoryStore();
        const order: string[] = [];
        const fetchChangedIds: FetchChangedIds = async ({ date }) => {
            order.push(date);
            return { itemIds: [], nextPage: null };
        };
        const run = (offset: number) => turn14PriceCheck.runPriceCheck({ store, now: NOW + offset, deadline: NOW + offset + 40000, fetchChangedIds, priceItems: pricer({ log: [] }), includePricing: false, maxLookups: 0 });
        await run(0);
        await run(10 * 60000);
        await run(31 * 60000);
        expect(order).toEqual([TODAY, YESTERDAY, TODAY, TODAY, YESTERDAY]);
    });
});
