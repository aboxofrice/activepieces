import { describe, expect, it } from 'vitest';
import { Turn14Inventory } from '../src/lib/common/inventory';
import { ReadUpdates, turn14InventoryCheck } from '../src/lib/common/inventory-check';
import { memoryStore } from './helpers';

const NOW = Date.parse('2026-11-01T15:00:00Z');
const MINUTE = 60000;

function row({ id, qty }: { id: string; qty: number }): Turn14Inventory {
    return { id, attributes: { inventory: { '01': qty } } };
}

function reader({ pages, calls }: { pages: Turn14Inventory[][]; calls?: { window: number; startPage: number }[] }): ReadUpdates {
    return async ({ window, startPage }) => {
        calls?.push({ window, startPage });
        return { rows: pages[startPage - 1] ?? [], nextPage: null };
    };
}

function params({ store, now, readUpdates }: { store: ReturnType<typeof memoryStore>; now: number; readUpdates: ReadUpdates }) {
    return { store, now, deadline: now + 40000, filter: null, includeEta: false, readUpdates };
}

describe('turn14InventoryCheck.runInventoryCheck', () => {
    it('fires each change once across overlapping windows, even for thousands of items', async () => {
        const store = memoryStore();
        const rows = Array.from({ length: 12000 }, (_, index) => row({ id: String(100000 + index), qty: 5 }));
        await store.put('turn14_inventory_changed_state', { lastPollAt: NOW - 5 * MINUTE });
        const first = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW, readUpdates: reader({ pages: [rows] }) }));
        expect(first.outputs).toHaveLength(12000);
        const second = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 5 * MINUTE, readUpdates: reader({ pages: [rows] }) }));
        expect(second.outputs).toHaveLength(0);
        const changed = rows.map((entry, index) => (index === 7 ? row({ id: entry.id, qty: 4 }) : entry));
        const third = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 10 * MINUTE, readUpdates: reader({ pages: [changed] }) }));
        expect(third.outputs).toHaveLength(1);
        expect(third.outputs[0]['previous_total_quantity']).toBe(5);
        expect(third.outputs[0]['total_quantity']).toBe(4);
    });

    it('holds the watermark and continues from the next page when a read is cut short', async () => {
        const store = memoryStore();
        await store.put('turn14_inventory_changed_state', { lastPollAt: NOW - 5 * MINUTE });
        const calls: { window: number; startPage: number }[] = [];
        const cutShort: ReadUpdates = async ({ window, startPage }) => {
            calls.push({ window, startPage });
            return startPage === 1 ? { rows: [row({ id: '1', qty: 1 })], nextPage: 2 } : { rows: [row({ id: '2', qty: 2 })], nextPage: null };
        };
        const first = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW, readUpdates: cutShort }));
        expect(first.finished).toBe(false);
        const second = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 3 * MINUTE, readUpdates: cutShort }));
        expect(second.finished).toBe(true);
        expect(second.outputs.map((output) => output['item_id'])).toEqual(['2']);
        expect(calls).toEqual([{ window: 15, startPage: 1 }, { window: 15, startPage: 2 }]);
        const state = await store.get<{ lastPollAt: number; resume?: unknown }>('turn14_inventory_changed_state');
        expect(state).toEqual({ lastPollAt: NOW + 3 * MINUTE });
    });

    it('marks outputs truncated after more than a day without a check', async () => {
        const store = memoryStore();
        await store.put('turn14_inventory_changed_state', { lastPollAt: NOW - 30 * 60 * MINUTE });
        const calls: { window: number; startPage: number }[] = [];
        const result = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW, readUpdates: reader({ pages: [[row({ id: '1', qty: 1 })]], calls }) }));
        expect(calls[0].window).toBe(1440);
        expect(result.truncated).toBe(true);
        expect(result.outputs[0]['truncated']).toBe(true);
    });

    it('does not fire for stock reported before the trigger was enabled', async () => {
        const store = memoryStore();
        const rows = [row({ id: '1', qty: 1 }), row({ id: '2', qty: 2 })];
        await turn14InventoryCheck.seedInventoryState(params({ store, now: NOW, readUpdates: reader({ pages: [rows] }) }));
        const result = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 5 * MINUTE, readUpdates: reader({ pages: [[...rows, row({ id: '3', qty: 3 })]] }) }));
        expect(result.outputs.map((output) => output['item_id'])).toEqual(['3']);
    });
});
