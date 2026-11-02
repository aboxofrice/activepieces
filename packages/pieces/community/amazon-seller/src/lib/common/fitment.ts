import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { fitmentMatcher } from './fitment-matcher';
import { REQUEST_TIMEOUT_MS } from './retry';

// SP-API has no read of Amazon's structured (ACES) fitment for US ASINs: the Vehicles API is
// EU-only and Catalog Items returns only free-text compatibility attributes. VIN decoding uses
// NHTSA's public vPIC service, which needs no key.
async function decodeVin({ vin }: { vin: string }): Promise<DecodedVehicle> {
    const cleaned = vin.trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
        throw new Error(`"${vin}" is not a valid 17-character VIN.`);
    }
    const response = await httpClient.sendRequest<{ Results?: VpicResult[] }>({
        method: HttpMethod.GET,
        url: `${VPIC_BASE_URL}/DecodeVinValues/${cleaned}`,
        queryParams: { format: 'json' },
        timeout: REQUEST_TIMEOUT_MS,
    });
    const result = response.body.Results?.[0];
    const year = Number(result?.ModelYear);
    if (!result || !result.Make || Number.isNaN(year) || year === 0) {
        throw new Error(`NHTSA could not decode VIN ${cleaned}: ${result?.ErrorText ?? 'no result'}`);
    }
    return {
        vin: cleaned,
        year,
        make: result.Make,
        model: result.Model ?? '',
        trim: result.Trim || null,
        engine: [result.DisplacementL ? `${Number(result.DisplacementL).toFixed(1)}L` : null, result.EngineCylinders ? `${result.EngineCylinders} cyl` : null, result.FuelTypePrimary || null].filter(Boolean).join(' ') || null,
        body_class: result.BodyClass || null,
    };
}

const VPIC_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

export const fitment = { decodeVin, assessFitment: fitmentMatcher.assessFitment };

export type DecodedVehicle = {
    vin: string | null;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    engine: string | null;
    body_class: string | null;
};

type VpicResult = {
    ModelYear?: string;
    Make?: string;
    Model?: string;
    Trim?: string;
    DisplacementL?: string;
    EngineCylinders?: string;
    FuelTypePrimary?: string;
    BodyClass?: string;
    ErrorText?: string;
};
