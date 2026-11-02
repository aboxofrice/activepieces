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
        // The watermark is the time the scan started, not when it finished.
        const state = await store.get<{ lastPollAt: number; resume?: unknown }>('turn14_inventory_changed_state');
        expect(state?.lastPollAt).toBe(NOW);
        expect(state?.resume).toBeUndefined();
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

    it('does not refire unchanged items after a gap longer than the window', async () => {
        const store = memoryStore();
        await store.put('turn14_inventory_changed_state', { lastPollAt: NOW - 5 * MINUTE });
        const rows = [row({ id: '1', qty: 1 })];
        expect((await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW, readUpdates: reader({ pages: [rows] }) }))).outputs).toHaveLength(1);
        const gapOk = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 5 * MINUTE, readUpdates: reader({ pages: [[]] }) }));
        expect(gapOk.outputs).toHaveLength(0);
        const afterGap = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 125 * MINUTE, readUpdates: reader({ pages: [rows] }) }));
        expect(afterGap.outputs).toHaveLength(0);
        const nextDay = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 26 * 60 * MINUTE, readUpdates: reader({ pages: [rows] }) }));
        expect(nextDay.outputs).toHaveLength(1);
    });

    it('rewrites only the current hour of the seen set', async () => {
        const store = memoryStore();
        await store.put('turn14_inventory_changed_state', { lastPollAt: NOW - 5 * MINUTE });
        await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW, readUpdates: reader({ pages: [[row({ id: '1', qty: 1 })]] }) }));
        store.log.length = 0;
        await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 65 * MINUTE, readUpdates: reader({ pages: [[row({ id: '2', qty: 2 })]] }) }));
        const hour = Math.floor((NOW + 65 * MINUTE) / (60 * MINUTE));
        const chunkWrites = store.log.filter((entry) => entry.startsWith('put:turn14_inventory_seen_') && !entry.endsWith('_meta'));
        expect(chunkWrites).toEqual([`put:turn14_inventory_seen_${hour}_0`]);
    });

    it('keeps the cursor when the enable-time seed cannot read the whole window, and flags the rest', async () => {
        const store = memoryStore();
        const calls: { window: number; startPage: number }[] = [];
        const paged: ReadUpdates = async ({ window, startPage }) => {
            calls.push({ window, startPage });
            return startPage === 1 ? { rows: [row({ id: '1', qty: 1 })], nextPage: 2 } : { rows: [row({ id: '2', qty: 2 })], nextPage: null };
        };
        await turn14InventoryCheck.seedInventoryState(params({ store, now: NOW, readUpdates: paged }));
        const first = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 3 * MINUTE, readUpdates: paged }));
        expect(calls.map((call) => call.startPage)).toEqual([1, 2]);
        expect(first.outputs.map((output) => [output['item_id'], output['possibly_before_enable']])).toEqual([['2', true]]);
        const state = await store.get<{ lastPollAt: number; unsure?: boolean }>('turn14_inventory_changed_state');
        expect(state?.lastPollAt).toBe(NOW);
        expect(state?.unsure).toBeUndefined();
    });

    it('keeps flagging possibly_before_enable when the seed\'s scan is restarted, until a scan completes', async () => {
        const store = memoryStore();
        const twoPages: ReadUpdates = async ({ startPage }) => (startPage === 1 ? { rows: [row({ id: '1', qty: 1 })], nextPage: 2 } : { rows: [], nextPage: null });
        await turn14InventoryCheck.seedInventoryState(params({ store, now: NOW, readUpdates: twoPages }));
        // 40 minutes later the window grows past the seed's, so the scan restarts at page 1 and is cut short again.
        const restartedCutShort: ReadUpdates = async () => ({ rows: [row({ id: '2', qty: 2 })], nextPage: 2 });
        const restarted = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 40 * MINUTE, readUpdates: restartedCutShort }));
        expect(restarted.outputs.map((output) => output['possibly_before_enable'])).toEqual([true]);
        const finishing: ReadUpdates = async () => ({ rows: [row({ id: '3', qty: 3 })], nextPage: null });
        const finished = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 45 * MINUTE, readUpdates: finishing }));
        expect(finished.outputs.map((output) => output['possibly_before_enable'])).toEqual([true]);
        const after = await turn14InventoryCheck.runInventoryCheck(params({ store, now: NOW + 50 * MINUTE, readUpdates: async () => ({ rows: [row({ id: '4', qty: 4 })], nextPage: null }) }));
        expect(after.outputs.map((output) => output['possibly_before_enable'])).toEqual([false]);
    });
});
