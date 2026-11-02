import { createHash } from 'crypto';
import { Store } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { turn14Client, Turn14AuthProps } from './client';
import { turn14Items } from './items';

async function readState<T>({ store, key, isValid }: { store: Store; key: string; isValid: (value: unknown) => value is T }): Promise<T | null> {
    const { data } = await tryCatch(() => store.get<unknown>(key));
    return isValid(data) ? data : null;
}

// A store value is capped at 512 KB, and a busy day of Turn14 price changes lists 20,000+ item
// IDs, so large ID sets are written across several keys.
async function writeIdSet({ store, prefix, ids }: { store: Store; prefix: string; ids: string[] }): Promise<void> {
    const previous = await readState({ store, key: `${prefix}_meta`, isValid: isChunkMeta });
    const chunks = Array.from({ length: Math.ceil(ids.length / ID_CHUNK_SIZE) }, (_, index) => ids.slice(index * ID_CHUNK_SIZE, (index + 1) * ID_CHUNK_SIZE));
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
// "everything". A brand's item list is cached for half a day; it is re-read from up to 60 pages.
async function resolveItemFilter({ auth, store, itemIds, brandId }: { auth: Turn14AuthProps; store: Store; itemIds: string[]; brandId?: string }): Promise<Set<string> | null> {
    if (itemIds.length === 0 && !brandId) {
        return null;
    }
    const brandIds = brandId ? await brandItemIds({ auth, store, brandId }) : [];
    return new Set([...itemIds, ...brandIds]);
}

async function brandItemIds({ auth, store, brandId }: { auth: Turn14AuthProps; store: Store; brandId: string }): Promise<string[]> {
    const cached = await readState({ store, key: BRAND_CACHE_KEY, isValid: isBrandCache });
    if (cached && cached.brandId === brandId && cached.expiresAt > Date.now()) {
        return [...await readIdSet({ store, prefix: BRAND_IDS_PREFIX })];
    }
    const ids = await turn14Items.listBrandItemIds({ auth, brandId });
    await writeIdSet({ store, prefix: BRAND_IDS_PREFIX, ids });
    await store.put(BRAND_CACHE_KEY, { brandId, expiresAt: Date.now() + BRAND_CACHE_TTL_MS });
    return ids;
}

async function clearBrandCache({ store }: { store: Store }): Promise<void> {
    await deleteIdSet({ store, prefix: BRAND_IDS_PREFIX });
    await store.delete(BRAND_CACHE_KEY);
}

function fingerprint({ value }: { value: unknown }): string {
    return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

function isChunkMeta(value: unknown): value is { chunks: number } {
    return turn14Client.isRecord(value) && typeof value['chunks'] === 'number';
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

export const turn14Polling = { readState, writeIdSet, readIdSet, deleteIdSet, resolveItemFilter, clearBrandCache, fingerprint };
