import { HttpMethod, httpClient } from '@activepieces/pieces-common';

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

function assessFitment({ texts, fitType, brand, vehicle }: AssessParams): FitmentAssessment {
    const corpus = texts.join(' \n ');
    const normalizedCorpus = normalize({ text: corpus });
    if (fitType === 'universal_fit') {
        return { verdict: 'universal', year_matches: null, model_matches: null, make_matches: null, years_mentioned: '', reasons: ['Amazon marks this part as universal fit.'] };
    }
    const ranges = yearRanges({ text: corpus });
    const yearMatches = ranges.length === 0 ? null : ranges.some((range) => vehicle.year >= range.from && vehicle.year <= range.to);
    const modelMatches = vehicle.model ? modelMentioned({ model: vehicle.model, normalizedCorpus }) : null;
    const makeMatches = vehicle.make
        ? normalizedCorpus.includes(normalize({ text: vehicle.make })) || normalize({ text: brand ?? '' }) === normalize({ text: vehicle.make })
        : null;
    const reasons = [
        ranges.length === 0 ? 'No model years found in the listing text.' : `Listing mentions years ${describeRanges({ ranges })}; vehicle is ${vehicle.year}.`,
        modelMatches === null ? 'No vehicle model given.' : modelMatches ? `Model "${vehicle.model}" appears in the listing text.` : `Model "${vehicle.model}" does not appear in the listing text.`,
    ];
    return {
        verdict: verdictFor({ yearMatches, modelMatches }),
        year_matches: yearMatches,
        model_matches: modelMatches,
        make_matches: makeMatches,
        years_mentioned: describeRanges({ ranges }),
        reasons,
    };
}

function verdictFor({ yearMatches, modelMatches }: { yearMatches: boolean | null; modelMatches: boolean | null }): FitmentVerdict {
    if (yearMatches === false || (yearMatches === true && modelMatches === false)) {
        return 'likely_does_not_fit';
    }
    if (yearMatches === true && modelMatches === true) {
        return 'likely_fits';
    }
    return 'unknown';
}

// Matches "2015-2018", "2015 - 2018", "2015 to 2018", "2015-18" and lone years like "2016".
function yearRanges({ text }: { text: string }): YearRange[] {
    const spans = [...text.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|to|thru|through)\s*((?:19|20)?\d{2})\b/gi)].map((match) => {
        const from = Number(match[1]);
        const toRaw = match[2];
        const to = toRaw.length === 2 ? Math.floor(from / 100) * 100 + Number(toRaw) : Number(toRaw);
        return { from, to: Math.max(from, to), index: match.index ?? 0, length: match[0].length };
    });
    const covered = (index: number) => spans.some((span) => index >= span.index && index < span.index + span.length);
    const singles = [...text.matchAll(/\b((?:19|20)\d{2})\b/g)]
        .filter((match) => !covered(match.index ?? 0))
        .map((match) => ({ from: Number(match[1]), to: Number(match[1]) }));
    const currentYear = new Date().getFullYear();
    return [...spans.map(({ from, to }) => ({ from, to })), ...singles].filter((range) => range.from >= 1950 && range.to <= currentYear + 2);
}

function modelMentioned({ model, normalizedCorpus }: { model: string; normalizedCorpus: string }): boolean {
    const whole = normalize({ text: model });
    if (whole && normalizedCorpus.includes(whole)) {
        return true;
    }
    const words = model.split(/[\s/]+/).map((word) => normalize({ text: word })).filter((word) => word.length >= 3 && !GENERIC_MODEL_WORDS.includes(word));
    return words.length > 0 && words.some((word) => normalizedCorpus.includes(word));
}

function describeRanges({ ranges }: { ranges: YearRange[] }): string {
    return [...new Set(ranges.map((range) => (range.from === range.to ? `${range.from}` : `${range.from}-${range.to}`)))].join(', ');
}

function normalize({ text }: { text: string }): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const VPIC_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const GENERIC_MODEL_WORDS = ['pickup', 'truck', 'van', 'wagon', 'sedan', 'coupe', 'hatchback', 'series', 'base', 'sport', 'limited'];

export const fitment = { decodeVin, assessFitment };

export type DecodedVehicle = {
    vin: string | null;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    engine: string | null;
    body_class: string | null;
};

export type FitmentVerdict = 'likely_fits' | 'likely_does_not_fit' | 'universal' | 'unknown';

export type FitmentAssessment = {
    verdict: FitmentVerdict;
    year_matches: boolean | null;
    model_matches: boolean | null;
    make_matches: boolean | null;
    years_mentioned: string;
    reasons: string[];
};

type YearRange = { from: number; to: number };

type AssessParams = {
    texts: string[];
    fitType: string | null;
    brand: string | null;
    vehicle: DecodedVehicle;
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
