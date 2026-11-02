import { createHash } from 'crypto';
import { Store } from '@activepieces/pieces-framework';
import { turn14Client, Turn14AuthProps } from './client';
import { turn14Items } from './items';

// store.get returns null when nothing is stored; a failing store is a real error and propagates,
// so a run never mistakes it for "no state" and refires or forgets work.
async function readState<T>({ store, key, isValid }: { store: Store; key: string; isValid: (value: unknown) => value is T }): Promise<T | null> {
    const data = await store.get<unknown>(key);
    return isValid(data) ? data : null;
}

// A store value is capped at 512 KB, and a busy day of Turn14 price changes lists 20,000+ item
// IDs, so large ID sets are written across several keys. Entries must not contain commas.
async function writeIdSet({ store, prefix, ids, chunkSize = ID_CHUNK_SIZE }: { store: Store; prefix: string; ids: string[]; chunkSize?: number }): Promise<void> {
    const previous = await readState({ store, key: `${prefix}_meta`, isValid: isChunkMeta });
    const chunks = Array.from({ length: Math.ceil(ids.length / chunkSize) }, (_, index) => ids.slice(index * chunkSize, (index + 1) * chunkSize));
    await Promise.all(chunks.map((chunk, index) => store.put(`${prefix}_${index}`, chunk.join(','))));
    const stale = Array.from({ length: Math.max(0, (previous?.chunks ?? 0) - chunks.length) }, (_, offset) => chunks.length + offset);
    await Promise.all(stale.map((index) => store.delete(`${prefix}_${index}`)));
    await store.put(`${prefix}_meta`, { chunks: chunks.length });
}

async function readIdSet({ store, prefix }: { store: Store; prefix: string }): Promise<Set<string>> {
    const meta = await readState({ store, key: `${prefix}_meta`, isValid: isChunkMeta });
    const chunks = await Promise.all(Array.from({ length: meta?.chunks ?? 0 }, (_, index) => readState({ store, key: `${prefix}_${index}`, isValid: isString })));
    return new Set(chunks.flatMap((chunk) => (chunk ? chunk.split(',') : [])).filter((id) => id.length > 0));
}

async function deleteIdSet({ store, prefix }: { store: Store; prefix: string }): Promise<void> {
    const meta = await readState({ store, key: `${prefix}_meta`, isValid: isChunkMeta });
    await Promise.all(Array.from({ length: meta?.chunks ?? 0 }, (_, index) => store.delete(`${prefix}_${index}`)));
    await store.delete(`${prefix}_meta`);
}

// Resolves the "only these items / this brand" trigger filter to a set of item IDs, or null for
// "everything". A brand's item list is cached for half a day; it is re-read from up to 60 pages,
// and a brand that cannot be read in full fails the run rather than silently filtering out items.
async function resolveItemFilter({ auth, store, itemIds, brandId, deadline }: { auth: Turn14AuthProps; store: Store; itemIds: string[]; brandId?: string; deadline?: number }): Promise<Set<string> | null> {
    if (itemIds.length === 0 && !brandId) {
        return null;
    }
    const brandIds = brandId ? await brandItemIds({ auth, store, brandId, deadline }) : [];
    return new Set([...itemIds, ...brandIds]);
}

async function brandItemIds({ auth, store, brandId, deadline }: { auth: Turn14AuthProps; store: Store; brandId: string; deadline?: number }): Promise<string[]> {
    const cached = await readState({ store, key: BRAND_CACHE_KEY, isValid: isBrandCache });
    if (cached && cached.brandId === brandId && cached.expiresAt > Date.now()) {
        return [...await readIdSet({ store, prefix: BRAND_IDS_PREFIX })];
    }
    const ids = await turn14Items.listBrandItemIds({ auth, brandId, deadline });
    await writeIdSet({ store, prefix: BRAND_IDS_PREFIX, ids });
    await store.put(BRAND_CACHE_KEY, { brandId, expiresAt: Date.now() + BRAND_CACHE_TTL_MS });
    return ids;
}

async function clearBrandCache({ store }: { store: Store }): Promise<void> {
    await deleteIdSet({ store, prefix: BRAND_IDS_PREFIX });
    await store.delete(BRAND_CACHE_KEY);
}

// Publishing a new flow version disables the old trigger and enables the new one. State is kept
// through that so changes made during a republish are not lost; after a longer pause the trigger
// starts fresh, as a newly enabled polling trigger should.
async function markDisabled({ store, now }: { store: Store; now: number }): Promise<void> {
    await store.put(DISABLED_AT_KEY, now);
}

async function resumeAfterRepublish({ store, now }: { store: Store; now: number }): Promise<boolean> {
    const disabledAt = await readState({ store, key: DISABLED_AT_KEY, isValid: isNumber });
    await store.delete(DISABLED_AT_KEY);
    return disabledAt !== null && now - disabledAt >= 0 && now - disabledAt <= RESUME_GRACE_MS;
}

function fingerprint({ value }: { value: unknown }): string {
    return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

function isChunkMeta(value: unknown): value is { chunks: number } {
    return turn14Client.isRecord(value) && typeof value['chunks'] === 'number';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isBrandCache(value: unknown): value is { brandId: string; expiresAt: number } {
    return turn14Client.isRecord(value) && typeof value['brandId'] === 'string' && typeof value['expiresAt'] === 'number';
}

const ID_CHUNK_SIZE = 15000;
const BRAND_CACHE_KEY = 'turn14_brand_cache';
const BRAND_IDS_PREFIX = 'turn14_brand_ids';
const BRAND_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DISABLED_AT_KEY = 'turn14_trigger_disabled_at';
const RESUME_GRACE_MS = 15 * 60 * 1000;
const POLL_BUDGET_MS = 40_000;

export const turn14Polling = { readState, writeIdSet, readIdSet, deleteIdSet, resolveItemFilter, clearBrandCache, markDisabled, resumeAfterRepublish, fingerprint, isNumber, POLL_BUDGET_MS };
