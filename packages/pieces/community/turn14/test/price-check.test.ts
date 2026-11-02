import { describe, expect, it } from 'vitest';
import { FetchChangedIds, PriceItems, turn14PriceCheck } from '../src/lib/common/price-check';
import { memoryStore } from './helpers';

const NOW = Date.parse('2026-11-01T15:00:00Z');
const TODAY = '2026-11-01';

function changes({ byDate }: { byDate: Record<string, string[]> }): FetchChangedIds {
    return async ({ date }) => ({ itemIds: byDate[date] ?? [], truncated: false });
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
        const fetchChangedIds: FetchChangedIds = async ({ date }) => ({ itemIds: date === TODAY ? ['1'] : [], truncated: date === TODAY });
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
});
