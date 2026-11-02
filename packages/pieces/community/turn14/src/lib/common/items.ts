import { Turn14AuthProps, turn14Client } from './client';

async function getItem({ auth, itemId }: { auth: Turn14AuthProps; itemId: string }): Promise<Turn14Item> {
    const response = await turn14Client.request({ auth, method: 'GET', path: `/v1/items/${encodeURIComponent(itemId)}`, validate: turn14Client.isSingleResponse<Turn14Item> });
    return response.data;
}

async function getItemData({ auth, itemId }: { auth: Turn14AuthProps; itemId: string }): Promise<Turn14ItemData | null> {
    const response = await turn14Client.request({ auth, method: 'GET', path: `/v1/items/data/${encodeURIComponent(itemId)}`, validate: isItemDataResponse });
    const data = response.data;
    if (Array.isArray(data)) {
        return data[0] ?? null;
    }
    return data ?? null;
}

async function getItemFitment({ auth, itemId }: { auth: Turn14AuthProps; itemId: string }): Promise<Turn14ItemFitment> {
    const response = await turn14Client.request({ auth, method: 'GET', path: `/v1/items/fitment/${encodeURIComponent(itemId)}`, validate: turn14Client.isSingleResponse<Turn14ItemFitment> });
    return response.data;
}

// Turn14 has no server-side part-number search, so searching means reading catalog pages
// (1000 items each) and filtering them here. Each page is filtered as it arrives and only matches
// are kept; the scan stops once `limit` matches are found. A brand narrows it to a handful of pages.
async function searchItems({ auth, brandId, partNumber, matchMode, updatedWithinDays, activeOnly, maxPages, limit }: SearchItemsParams): Promise<SearchItemsResult> {
    const path = updatedWithinDays ? '/v1/items/updates' : brandId ? `/v1/items/brand/${encodeURIComponent(brandId)}` : '/v1/items';
    const criteria: SearchCriteria = {
        brandId: updatedWithinDays ? brandId : undefined,
        activeOnly,
        wanted: partNumber ? normalizePartNumber({ value: partNumber }) : null,
        matchMode,
    };
    const result = await turn14Client.scanPages<Turn14Item, Turn14Item[]>({
        auth,
        path,
        queryParams: updatedWithinDays ? { days: updatedWithinDays } : {},
        maxPages: Math.min(maxPages, MAX_SEARCH_PAGES),
        initial: [],
        reduce: ({ acc, rows }) => {
            const matches = [...acc, ...filterItems({ rows, criteria })].slice(0, limit);
            return { acc: matches, done: matches.length >= limit };
        },
    });
    return {
        items: result.acc.map((item) => flattenItem({ item })),
        match_count: result.acc.length,
        stopped_at_limit: result.stoppedBy === 'reducer',
        pages_scanned: result.pagesRead,
        total_pages: result.totalPages ?? 0,
        scanned_all_pages: result.nextPage === null,
    };
}

function filterItems({ rows, criteria }: { rows: Turn14Item[]; criteria: SearchCriteria }): Turn14Item[] {
    const { brandId, activeOnly, wanted, matchMode } = criteria;
    return rows
        .filter((item) => !brandId || String(item.attributes?.brand_id ?? '') === brandId)
        .filter((item) => !activeOnly || item.attributes?.active !== false)
        .filter((item) => wanted === null || partNumberMatches({ item, wanted, matchMode }));
}

// A brand's item list feeds the trigger filters; an incomplete list would silently drop items, so
// a brand too large to read fails loudly instead.
async function listBrandItemIds({ auth, brandId, deadline }: { auth: Turn14AuthProps; brandId: string; deadline?: number }): Promise<string[]> {
    const { rows, truncated, pagesRead, totalPages } = await turn14Client.fetchPages<Turn14Item>({ auth, path: `/v1/items/brand/${encodeURIComponent(brandId)}`, maxPages: MAX_BRAND_PAGES, deadline });
    if (truncated) {
        throw new Error(`Turn14 brand ${brandId} could not be read in full (${pagesRead} of ${totalPages} pages of 1,000 items before the page/time limit), so the brand filter would miss items. Use "Only These Item IDs" instead, or no filter.`);
    }
    return rows.map((item) => String(item.id));
}

function isItemDataResponse(value: unknown): value is { data?: Turn14ItemData[] | Turn14ItemData | null } {
    if (!turn14Client.isRecord(value)) {
        return false;
    }
    const data = value['data'];
    return data === undefined || data === null || turn14Client.isRecord(data) || Array.isArray(data);
}

function partNumberMatches({ item, wanted, matchMode }: { item: Turn14Item; wanted: string; matchMode: PartNumberMatchMode }): boolean {
    const candidates = [item.attributes?.part_number, item.attributes?.mfr_part_number, item.id]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((value) => normalizePartNumber({ value }));
    return matchMode === 'contains' ? candidates.some((candidate) => candidate.includes(wanted)) : candidates.includes(wanted);
}

// Sellers write part numbers with and without dashes, dots and spaces (20-0262 vs 200262).
function normalizePartNumber({ value }: { value: string }): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function flattenItem({ item }: { item: Turn14Item }): FlatItem {
    const a = item.attributes ?? {};
    const boxes = a.dimensions ?? [];
    const firstBox = boxes[0];
    return {
        item_id: item.id,
        product_name: a.product_name ?? null,
        part_number: a.part_number ?? null,
        mfr_part_number: a.mfr_part_number ?? null,
        part_description: a.part_description ?? null,
        brand_id: a.brand_id ?? null,
        brand: a.brand ?? null,
        category: a.category ?? null,
        subcategory: a.subcategory ?? null,
        price_group_id: a.price_group_id ?? null,
        price_group: a.price_group ?? null,
        active: a.active ?? null,
        regular_stock: a.regular_stock ?? null,
        clearance_item: a.clearance_item ?? null,
        born_on_date: a.born_on_date ?? null,
        units_per_sku: a.units_per_sku ?? null,
        barcode: a.barcode ?? null,
        thumbnail: a.thumbnail ?? null,
        box_count: boxes.length,
        total_weight_lb: boxes.length > 0 ? round({ value: boxes.reduce((sum, box) => sum + (box.weight ?? 0), 0) }) : null,
        box1_length_in: firstBox?.length ?? null,
        box1_width_in: firstBox?.width ?? null,
        box1_height_in: firstBox?.height ?? null,
        orderable_location_ids: (a.warehouse_availability ?? []).filter((entry) => entry.can_place_order).map((entry) => entry.location_id).join(','),
        prop_65: a.prop_65 ?? null,
        epa: a.epa ?? null,
        not_carb_approved: a.not_carb_approved ?? null,
        carb_acknowledgement_required: a.carb_acknowledgement_required ?? null,
        ltl_freight_required: a.ltl_freight_required ?? null,
        air_freight_prohibited: a.air_freight_prohibited ?? null,
        powersports_indicator: a.powersports_indicator ?? null,
        dropship_controller_id: a.dropship_controller_id ?? null,
    };
}

function flattenItemData({ data }: { data: Turn14ItemData | null }): FlatItemData {
    const descriptions = data?.descriptions ?? [];
    const files = data?.files ?? [];
    const descriptionOf = (type: string): string | null => descriptions.find((entry) => entry.type === type)?.description ?? null;
    const images = files.filter((file) => file.type === 'Image');
    const primary = images.find((file) => file.media_content === 'Photo - Primary' && !file.generic) ?? images.find((file) => file.media_content === 'Photo - Primary') ?? images[0];
    return {
        description_short: descriptionOf('Product Description - Short'),
        description_long: descriptionOf('Product Description - Long'),
        description_extended: descriptionOf('Product Description - Extended'),
        market_description: descriptions.filter((entry) => entry.type === 'Market Description').map((entry) => entry.description).join('\n') || null,
        aaia_part_type: descriptionOf('AAIA Part Type Description'),
        primary_image_url: largestLink({ file: primary }),
        image_urls: images.map((file) => largestLink({ file })).filter((url): url is string => url !== null),
        document_urls: files.filter((file) => file.type !== 'Image').map((file) => largestLink({ file })).filter((url): url is string => url !== null),
        descriptions: descriptions.map((entry) => ({ type: entry.type, description: entry.description })),
        files: files.map((file) => ({
            type: file.type ?? null,
            media_content: file.media_content ?? null,
            file_extension: file.file_extension ?? null,
            generic: file.generic ?? null,
            url: largestLink({ file }),
        })),
    };
}

function largestLink({ file }: { file: Turn14File | undefined }): string | null {
    const links = file?.links ?? [];
    const sorted = [...links].sort((left, right) => Number(right.width ?? 0) - Number(left.width ?? 0));
    return sorted[0]?.url ?? null;
}

function round({ value }: { value: number }): number {
    return Math.round(value * 1000) / 1000;
}

const MAX_BRAND_PAGES = 60;
const MAX_SEARCH_PAGES = 200;

export const turn14Items = { getItem, getItemData, getItemFitment, searchItems, filterItems, listBrandItemIds, flattenItem, flattenItemData, normalizePartNumber, MAX_SEARCH_PAGES };

export type PartNumberMatchMode = 'exact' | 'contains';

export type Turn14Item = {
    id: string;
    type?: string;
    attributes?: {
        product_name?: string;
        part_number?: string;
        mfr_part_number?: string;
        part_description?: string;
        category?: string;
        subcategory?: string;
        dimensions?: { box_number?: number; length?: number; width?: number; height?: number; weight?: number }[];
        brand_id?: number;
        brand?: string;
        price_group_id?: number;
        price_group?: string;
        active?: boolean;
        born_on_date?: string;
        regular_stock?: boolean;
        powersports_indicator?: boolean;
        dropship_controller_id?: number;
        air_freight_prohibited?: boolean;
        not_carb_approved?: boolean;
        carb_acknowledgement_required?: boolean;
        ltl_freight_required?: boolean;
        prop_65?: string;
        epa?: string;
        units_per_sku?: number;
        warehouse_availability?: { location_id: string; can_place_order: boolean }[];
        clearance_item?: boolean;
        thumbnail?: string;
        barcode?: string;
    };
};

export type Turn14ItemFitment = {
    id: string;
    type?: string;
    attributes?: { vehicle_ids?: string[]; late_models_only?: boolean };
};

export type FlatItem = Record<string, string | number | boolean | null>;

export type SearchCriteria = {
    brandId?: string;
    activeOnly: boolean;
    wanted: string | null;
    matchMode: PartNumberMatchMode;
};

type Turn14File = {
    id?: string;
    type?: string;
    file_extension?: string;
    media_content?: string;
    generic?: boolean;
    links?: { url?: string; height?: string; width?: string; size?: string }[];
};

type Turn14ItemData = {
    id: string;
    type?: string;
    files?: Turn14File[];
    descriptions?: { type: string; description: string }[];
};

type FlatItemData = {
    description_short: string | null;
    description_long: string | null;
    description_extended: string | null;
    market_description: string | null;
    aaia_part_type: string | null;
    primary_image_url: string | null;
    image_urls: string[];
    document_urls: string[];
    descriptions: { type: string; description: string }[];
    files: { type: string | null; media_content: string | null; file_extension: string | null; generic: boolean | null; url: string | null }[];
};

type SearchItemsParams = {
    auth: Turn14AuthProps;
    brandId?: string;
    partNumber?: string;
    matchMode: PartNumberMatchMode;
    updatedWithinDays?: number;
    activeOnly: boolean;
    maxPages: number;
    limit: number;
};

type SearchItemsResult = {
    items: FlatItem[];
    match_count: number;
    stopped_at_limit: boolean;
    pages_scanned: number;
    total_pages: number;
    scanned_all_pages: boolean;
};
