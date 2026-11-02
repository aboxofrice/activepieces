import { walmartClient } from './client';

function valueAt({ value, path }: { value: unknown; path: string[] }): unknown {
    return path.reduce<unknown>((current, key) => (walmartClient.isRecord(current) ? current[key] : undefined), value);
}

function stringAt({ value, path }: { value: unknown; path: string[] }): string | undefined {
    const found = valueAt({ value, path });
    if (typeof found === 'string') {
        return found;
    }
    return typeof found === 'number' || typeof found === 'boolean' ? String(found) : undefined;
}

function numberAt({ value, path }: { value: unknown; path: string[] }): number | undefined {
    const found = valueAt({ value, path });
    const parsed = typeof found === 'number' ? found : typeof found === 'string' && found.trim() !== '' ? Number(found) : NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
}

// Walmart's XML heritage shows in its JSON: a single element is sometimes an object
// rather than a one-item array.
function arrayAt({ value, path }: { value: unknown; path: string[] }): Record<string, unknown>[] {
    const found = valueAt({ value, path });
    const list = Array.isArray(found) ? found : found === undefined || found === null ? [] : [found];
    return list.filter(walmartClient.isRecord);
}

function isoFromEpoch({ epoch }: { epoch: number | undefined }): string | null {
    return epoch !== undefined ? new Date(epoch).toISOString() : null;
}

function round({ value }: { value: number }): number {
    return Math.round(value * 100) / 100;
}

function toIso({ value }: { value: string | undefined | null }): string | undefined {
    return value ? new Date(value).toISOString() : undefined;
}

// Walmart hands back the next page as a ready-made query string ("?limit=..&offset=..")
// that already carries the original filters; send exactly that, nothing else.
function cursorRequest({ basePath, cursor }: { basePath: string; cursor: string }): { path: string; queryParams?: Record<string, string> } {
    return cursor.startsWith('?')
        ? { path: `${basePath}${cursor}` }
        : { path: basePath, queryParams: { nextCursor: cursor } };
}

export const walmartJson = {
    valueAt,
    stringAt,
    numberAt,
    arrayAt,
    isoFromEpoch,
    round,
    toIso,
    cursorRequest,
};
