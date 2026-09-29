import { HttpMethod } from '@activepieces/pieces-common';
import { tryCatch } from '@activepieces/shared';
import { EbayAuthProps, ebayClient } from './client';

async function getListingFitment({ auth, itemId }: { auth: EbayAuthProps; itemId: string }): Promise<ListingFitment> {
    const xml = await ebayClient.tradingCall({
        auth,
        callName: 'GetItem',
        innerXml: `<ItemID>${escapeXml({ text: itemId })}</ItemID><IncludeItemCompatibilityList>true</IncludeItemCompatibilityList>`,
    });
    const ack = firstTag({ xml, tag: 'Ack' });
    if (ack !== 'Success' && ack !== 'Warning') {
        return { found: false, title: null, listingStatus: null, error: firstTag({ xml, tag: 'LongMessage' }), rows: [] };
    }
    const rows = [...xml.matchAll(/<Compatibility>([\s\S]*?)<\/Compatibility>/g)].map((match) => Object.fromEntries(
        [...match[1].matchAll(/<Name>([\s\S]*?)<\/Name>\s*<Value>([\s\S]*?)<\/Value>/g)]
            .map((pair) => [unescapeXml({ text: pair[1] }), unescapeXml({ text: pair[2] })]),
    ));
    return {
        found: true,
        title: firstTag({ xml, tag: 'Title' }),
        listingStatus: firstTag({ xml, tag: 'ListingStatus' }),
        error: null,
        rows,
    };
}

// eBay names differ from vPIC's ("Hybrid SE Hatchback 4-Door" vs "SE", "2.0L 1999CC ... l4" vs 2.0 / 4), so match loosely here
// and then let eBay confirm the one exact chart row; only that confirmation can produce COMPATIBLE.
function matchVehicle({ rows, vehicle }: { rows: FitmentRow[]; vehicle: FitmentVehicle }): FitmentMatch {
    if (rows.length === 0) {
        return { status: 'NO_FITMENT_DATA', reason: 'The listing has no fitment chart.', yearMakeModelRows: 0, candidates: [] };
    }
    const modelOptions = [vehicle.model, `${vehicle.model ?? ''} ${vehicle.series ?? ''}`].map((value) => normalize({ value }));
    const yearMakeModel = rows.filter((row) => row['Year'] === String(vehicle.year)
        && normalize({ value: row['Make'] }) === normalize({ value: vehicle.make })
        && modelOptions.includes(normalize({ value: row['Model'] })));
    if (yearMakeModel.length === 0) {
        return { status: 'NOT_COMPATIBLE', reason: `The fitment chart does not list a ${vehicle.year} ${vehicle.make} ${vehicle.model}.`, yearMakeModelRows: 0, candidates: [] };
    }
    const trimOptions = (vehicle.trim ?? '').split('/').map((value) => words({ value })).filter((value) => value !== '');
    // Whole words, not substrings: "SE" must match "Hybrid SE Hatchback" but not "SEL".
    const byTrim = trimOptions.length === 0
        ? []
        : yearMakeModel.filter((row) => trimOptions.some((trim) => ` ${words({ value: row['Trim'] })} `.includes(` ${trim} `)));
    const byEngine = byTrim.filter((row) => engineMatches({ engine: row['Engine'], vehicle }));
    if (trimOptions.length === 0 || byTrim.length === 0) {
        return { status: 'UNDETERMINED', reason: 'The chart lists this model, but the trim could not be matched.', yearMakeModelRows: yearMakeModel.length, candidates: yearMakeModel.slice(0, MAX_CANDIDATES) };
    }
    if (isNilOrEmpty({ value: vehicle.displacementL }) || byEngine.length === 0) {
        return { status: 'UNDETERMINED', reason: 'The chart lists this trim, but the engine could not be matched.', yearMakeModelRows: yearMakeModel.length, candidates: byTrim.slice(0, MAX_CANDIDATES) };
    }
    return { status: 'CANDIDATE', reason: 'Matched a fitment chart row.', yearMakeModelRows: yearMakeModel.length, candidates: byEngine.slice(0, MAX_CANDIDATES) };
}

async function confirmWithEbay({ auth, itemId, row }: { auth: EbayAuthProps; itemId: string; row: FitmentRow }): Promise<string> {
    const { data, error } = await tryCatch(() => ebayClient.request<{ compatibilityStatus?: string }>({
        auth,
        tokenType: 'application',
        method: HttpMethod.POST,
        path: `/buy/browse/v1/item/${encodeURIComponent(`v1|${itemId}|0`)}/check_compatibility`,
        body: { compatibilityProperties: Object.entries(row).map(([name, value]) => ({ name, value })) },
    }));
    if (error) {
        return 'ERROR';
    }
    return data.compatibilityStatus ?? 'UNDETERMINED';
}

function engineMatches({ engine, vehicle }: { engine: string | undefined; vehicle: FitmentVehicle }): boolean {
    const displacement = Number(vehicle.displacementL);
    const rowDisplacement = Number((engine ?? '').match(/^(\d+(?:\.\d+)?)L\b/)?.[1]);
    if (!Number.isFinite(displacement) || !Number.isFinite(rowDisplacement) || Math.abs(displacement - rowDisplacement) > 0.051) {
        return false;
    }
    const rowCylinders = (engine ?? '').match(/\b[VLIHW](\d{1,2})\b/i)?.[1];
    return isNilOrEmpty({ value: vehicle.cylinders }) || isNilOrEmpty({ value: rowCylinders }) || Number(rowCylinders) === Number(vehicle.cylinders);
}

function normalize({ value }: { value: string | null | undefined }): string {
    return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function words({ value }: { value: string | null | undefined }): string {
    return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isNilOrEmpty({ value }: { value: string | number | null | undefined }): boolean {
    return value === null || value === undefined || String(value).trim() === '';
}

function firstTag({ xml, tag }: { xml: string; tag: string }): string | null {
    const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return match ? unescapeXml({ text: match[1] }) : null;
}

function unescapeXml({ text }: { text: string }): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, '\'')
        .replace(/&amp;/g, '&');
}

function escapeXml({ text }: { text: string }): string {
    return text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

const MAX_CANDIDATES = 5;

export const fitmentCommon = {
    getListingFitment,
    matchVehicle,
    confirmWithEbay,
};

export type FitmentRow = Record<string, string>;

export type FitmentVehicle = {
    year: string | number;
    make: string;
    model: string;
    series?: string | null;
    trim?: string | null;
    displacementL?: string | number | null;
    cylinders?: string | number | null;
};

export type ListingFitment = {
    found: boolean;
    title: string | null;
    listingStatus: string | null;
    error: string | null;
    rows: FitmentRow[];
};

export type FitmentMatch = {
    status: 'NO_FITMENT_DATA' | 'NOT_COMPATIBLE' | 'UNDETERMINED' | 'CANDIDATE';
    reason: string;
    yearMakeModelRows: number;
    candidates: FitmentRow[];
};
