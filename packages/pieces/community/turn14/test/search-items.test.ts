import { afterEach, describe, expect, it, vi } from 'vitest';
import { Turn14Item, turn14Items } from '../src/lib/common/items';
import { jsonResponse, requestUrl } from './helpers';

const auth = { clientId: 'search-client', clientSecret: 'secret', environment: 'production' };

function item({ id, partNumber, brandId = 1, active = true }: { id: string; partNumber: string; brandId?: number; active?: boolean }): Turn14Item {
    return { id, attributes: { part_number: partNumber, mfr_part_number: partNumber.replace(/^[a-z]+/, ''), brand_id: brandId, active } };
}

function stubCatalog({ pages }: { pages: Turn14Item[][] }): string[] {
    const requested: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
        const url = requestUrl({ input });
        if (url.endsWith('/v1/token')) {
            return jsonResponse({ body: { access_token: 'token', expires_in: 3600 } });
        }
        requested.push(url);
        const page = Number(new URL(url).searchParams.get('page'));
        return jsonResponse({ body: { data: pages[page - 1] ?? [], meta: { total_pages: pages.length } } });
    }));
    return requested;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('turn14Items.filterItems', () => {
    it('matches part numbers ignoring punctuation and drops inactive items', () => {
        const rows = [item({ id: '1', partNumber: 'rad20-0262' }), item({ id: '2', partNumber: 'rad20-0263' }), item({ id: '3', partNumber: 'rad20-0262', active: false })];
        const exact = turn14Items.filterItems({ rows, criteria: { activeOnly: true, wanted: turn14Items.normalizePartNumber({ value: '20.0262' }), matchMode: 'exact' } });
        expect(exact.map((row) => row.id)).toEqual(['1']);
        const contains = turn14Items.filterItems({ rows, criteria: { activeOnly: false, wanted: '2002', matchMode: 'contains' } });
        expect(contains.map((row) => row.id)).toEqual(['1', '2', '3']);
    });
});

describe('turn14Items.searchItems', () => {
    it('keeps only matches and stops reading pages once the limit is reached', async () => {
        const pages = [
            [item({ id: '1', partNumber: 'abc1' }), item({ id: '2', partNumber: 'zzz' })],
            [item({ id: '3', partNumber: 'abc2' }), item({ id: '4', partNumber: 'abc3' })],
            [item({ id: '5', partNumber: 'abc4' })],
            [item({ id: '6', partNumber: 'abc5' })],
        ];
        const requested = stubCatalog({ pages });
        const result = await turn14Items.searchItems({ auth, brandId: '1', partNumber: 'abc', matchMode: 'contains', activeOnly: true, maxPages: 50, limit: 3 });
        expect(result.items.map((row) => row['item_id'])).toEqual(['1', '3', '4']);
        expect(result.stopped_at_limit).toBe(true);
        expect(result.pages_scanned).toBe(2);
        expect(result.scanned_all_pages).toBe(false);
        expect(requested).toHaveLength(2);
    });

    it('reports a scan that ran out of pages without reaching the limit', async () => {
        stubCatalog({ pages: [[item({ id: '1', partNumber: 'abc1' })], [item({ id: '2', partNumber: 'xyz' })]] });
        const result = await turn14Items.searchItems({ auth, partNumber: 'abc1', matchMode: 'exact', activeOnly: true, maxPages: 50, limit: 10 });
        expect(result.match_count).toBe(1);
        expect(result.stopped_at_limit).toBe(false);
        expect(result.scanned_all_pages).toBe(true);
    });

    it('never reads more than 200 pages', async () => {
        const requested = stubCatalog({ pages: Array.from({ length: 205 }, (_, index) => [item({ id: String(index), partNumber: 'nomatch' })]) });
        // Requests are spaced ~220 ms apart; fake timers keep the test fast.
        vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
        const pending = turn14Items.searchItems({ auth, partNumber: 'abc', matchMode: 'exact', activeOnly: true, maxPages: 5000, limit: 10 });
        await vi.runAllTimersAsync();
        const result = await pending;
        vi.useRealTimers();
        expect(requested).toHaveLength(turn14Items.MAX_SEARCH_PAGES);
        expect(result.scanned_all_pages).toBe(false);
    });
});
