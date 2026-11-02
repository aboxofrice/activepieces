import { tryCatch } from '@activepieces/shared';
import { Turn14AuthProps, turn14Client } from './client';

// /v1/inventory/{id,id,...} takes a comma-separated list; batches keep the URL short.
async function getInventory({ auth, itemIds }: { auth: Turn14AuthProps; itemIds: string[] }): Promise<Turn14Inventory[]> {
    const batches = chunkIds({ ids: itemIds, size: INVENTORY_BATCH_SIZE });
    const results = await batches.reduce<Promise<Turn14Inventory[]>>(async (previous, batch) => {
        const collected = await previous;
        const { data, error } = await tryCatch(() => turn14Client.request({
            auth,
            method: 'GET',
            path: `/v1/inventory/${batch.map((id) => encodeURIComponent(id)).join(',')}`,
            validate: turn14Client.isListResponse<Turn14Inventory>,
        }));
        // Turn14 answers 404 only when no ID in the batch exists; unknown IDs are otherwise just left out.
        if (error) {
            if (error instanceof turn14Client.Turn14Error && error.status === 404) {
                return collected;
            }
            throw error;
        }
        return [...collected, ...(data.data ?? [])];
    }, Promise.resolve([]));
    return results;
}

// Location ids are keys ("01", "02", "59"), so every row gets the same set of columns:
// the union across the result, with 0 where an item has no stock record at a location.
function flattenInventory({ rows, locationIds }: { rows: Turn14Inventory[]; locationIds?: string[] }): FlatInventory[] {
    const allLocations = unique({ values: rows.flatMap((row) => Object.keys(row.attributes?.inventory ?? {})) }).sort();
    const locations = locationIds && locationIds.length > 0 ? locationIds : allLocations;
    return rows.map((row) => {
        const inventory = row.attributes?.inventory ?? {};
        const onOrder = row.attributes?.eta?.qty_on_order ?? {};
        const eta = row.attributes?.eta?.estimated_availability ?? {};
        const perLocation = locations.reduce<Record<string, number | string | null>>((columns, location) => ({
            ...columns,
            [`qty_location_${location}`]: inventory[location] ?? 0,
            [`on_order_location_${location}`]: onOrder[location] ?? 0,
            [`eta_location_${location}`]: eta[location] ?? null,
        }), {});
        const etaDates = locations.map((location) => eta[location]).filter((date): date is string => typeof date === 'string' && date.length > 0).sort();
        return {
            item_id: row.id,
            total_quantity: locations.reduce((sum, location) => sum + (inventory[location] ?? 0), 0),
            total_on_order: locations.reduce((sum, location) => sum + (onOrder[location] ?? 0), 0),
            earliest_eta: etaDates[0] ?? null,
            manufacturer_stock: row.attributes?.manufacturer?.stock ?? null,
            manufacturer_esd: row.attributes?.manufacturer?.esd ?? null,
            ...perLocation,
        };
    });
}

function parseIdList({ values }: { values: unknown[] | undefined }): string[] {
    const ids = (values ?? [])
        .flatMap((value) => String(value ?? '').split(/[\s,;]+/))
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    return unique({ values: ids });
}

// Turn14 item IDs are digits (often with a leading zero); anything else is routed by Turn14 as an
// unknown endpoint, which reads like an outage rather than a typo.
function isItemId({ value }: { value: string }): boolean {
    return /^\d+$/.test(value);
}

function assertItemId({ value }: { value: string }): string {
    const trimmed = value.trim();
    if (!isItemId({ value: trimmed })) {
        throw new Error(`"${trimmed}" is not a Turn14 item ID. Item IDs are numeric (e.g. 078595); use Search Items to find the ID for a part number.`);
    }
    return trimmed;
}

function chunkIds({ ids, size }: { ids: string[]; size: number }): string[][] {
    return Array.from({ length: Math.ceil(ids.length / size) }, (_, index) => ids.slice(index * size, (index + 1) * size));
}

function unique({ values }: { values: string[] }): string[] {
    return [...new Set(values)];
}

const INVENTORY_BATCH_SIZE = 100;

export const turn14Inventory = { getInventory, flattenInventory, parseIdList, chunkIds, isItemId, assertItemId };

export type Turn14Inventory = {
    id: string;
    type?: string;
    attributes?: {
        inventory?: Record<string, number>;
        manufacturer?: { stock?: number; esd?: string };
        eta?: {
            qty_on_order?: Record<string, number>;
            estimated_availability?: Record<string, string>;
        };
    };
};

export type FlatInventory = Record<string, string | number | null>;
