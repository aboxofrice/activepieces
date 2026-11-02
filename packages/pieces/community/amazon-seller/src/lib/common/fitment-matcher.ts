// A text heuristic over a listing's compatibility text, title and bullets. It never confirms
// fitment: it reports whether the text names the vehicle's make, its model, and a model-year
// range next to that model, and how sure the reading is.

function assessFitment({ sources, fitType, brand, vehicle, currentYear = new Date().getFullYear() }: AssessParams): FitmentAssessment {
    if (fitType === 'universal_fit') {
        return {
            verdict: 'universal',
            confidence: 'medium',
            make_matches: null,
            model_matches: null,
            year_matches: null,
            years_mentioned: '',
            years_near_model: '',
            evidence: [],
            reasons: ['Amazon marks this part as universal fit (catalog attribute, not a text match).'],
        };
    }
    const parsed = sources.map((source) => parseSource({ source, currentYear }));
    const makeAliases = aliasesFor({ make: vehicle.make });
    const makeMatches = makeAliases.length === 0
        ? null
        : parsed.some((source) => makeAliases.some((alias) => source.tokens.some((_, position) => termAt({ tokens: source.tokens, position, term: alias })))) || makeAliases.includes(normalize({ text: brand ?? '' }));
    const terms = modelTerms({ model: vehicle.model, makeAliases });
    const mentions = terms.length === 0 ? [] : parsed.flatMap((source) => modelMentions({ source, terms }));
    const modelMatches = terms.length === 0 ? null : mentions.length > 0;
    const allRanges = parsed.flatMap((source) => source.ranges);
    const tiedRanges = mentions.flatMap((mention) => mention.ranges);
    const contains = (range: YearRange) => vehicle.year >= range.from && vehicle.year <= range.to;
    const yearTied = tiedRanges.length === 0 ? null : tiedRanges.some(contains);
    const yearAny = allRanges.length === 0 ? null : allRanges.some(contains);
    const otherMakes = makeMatches === false ? otherMakesMentioned({ parsed, makeAliases }) : [];
    const decision = decide({ makeMatches, modelMatches, yearTied, yearAny, otherMakes, vehicle });
    return {
        verdict: decision.verdict,
        confidence: decision.confidence,
        make_matches: makeMatches,
        model_matches: modelMatches,
        year_matches: yearTied ?? yearAny,
        years_mentioned: describeRanges({ ranges: allRanges }),
        years_near_model: describeRanges({ ranges: tiedRanges }),
        evidence: mentions.slice(0, MAX_EVIDENCE).map((mention) => mention.snippet),
        reasons: decision.reasons,
    };
}

function decide({ makeMatches, modelMatches, yearTied, yearAny, otherMakes, vehicle }: DecideParams): Decision {
    const label = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    if (makeMatches === null) {
        return { verdict: 'unknown', confidence: 'low', reasons: ['No vehicle make given; the text cannot be matched without it.'] };
    }
    if (!makeMatches) {
        return otherMakes.length > 0
            ? { verdict: 'text_mismatch', confidence: 'low', reasons: [`The listing text names ${otherMakes.join(', ')} but not ${vehicle.make}.`] }
            : { verdict: 'unknown', confidence: 'low', reasons: [`The listing text does not name ${vehicle.make} or any other make.`] };
    }
    if (modelMatches === null) {
        return { verdict: 'unknown', confidence: 'low', reasons: [`${vehicle.make} appears in the listing text, but no vehicle model was given.`] };
    }
    if (!modelMatches) {
        return { verdict: 'text_mismatch', confidence: 'low', reasons: [`${vehicle.make} appears in the listing text, but model "${vehicle.model}" does not.`] };
    }
    if (yearTied !== null) {
        return yearTied
            ? { verdict: 'text_match', confidence: 'medium', reasons: [`The listing text lists ${label} with a year range that includes ${vehicle.year}.`] }
            : { verdict: 'text_mismatch', confidence: 'medium', reasons: [`The listing text lists ${label}, but only for years that exclude ${vehicle.year}.`] };
    }
    if (yearAny !== null) {
        return yearAny
            ? { verdict: 'text_match', confidence: 'low', reasons: [`The listing text names ${label} and mentions ${vehicle.year} elsewhere, but not next to the model.`] }
            : { verdict: 'text_mismatch', confidence: 'low', reasons: [`The listing text names ${label}; the years it mentions (not next to the model) exclude ${vehicle.year}.`] };
    }
    return { verdict: 'unknown', confidence: 'low', reasons: [`The listing text names ${label} but no model years.`] };
}

function parseSource({ source, currentYear }: { source: FitmentSource; currentYear: number }): ParsedSource {
    const tokens = tokenize({ text: source.text });
    return { source, tokens, ranges: yearRanges({ text: source.text, tokens, currentYear }) };
}

// "F-250" and "F250" both become f250; "F-250/350" becomes f250, f350 so a model listed
// after a slash keeps its letter prefix.
function tokenize({ text }: { text: string }): Token[] {
    return [...text.matchAll(TOKEN_PATTERN)].reduce<Token[]>((tokens, match) => {
        const start = match.index ?? 0;
        const raw = match[0];
        const plain = normalize({ text: raw });
        const previous = tokens[tokens.length - 1];
        const prefix = previous && /^\d+$/.test(plain) && text[start - 1] === '/' ? /^([a-z]+)(\d+)$/.exec(previous.norm) : null;
        const norm = prefix && prefix[2].length === plain.length ? `${prefix[1]}${plain}` : plain;
        return [...tokens, { norm, start, end: start + raw.length }];
    }, []);
}

// A year counts only when the tokens it touches consist of the year expression itself, so
// part numbers such as FC3Z-2015-A are not read as years.
function yearRanges({ text, tokens, currentYear }: { text: string; tokens: Token[]; currentYear: number }): YearRange[] {
    const latest = currentYear + 1;
    const candidates = [
        ...[...text.matchAll(OPEN_RANGE_PATTERN)].map((match) => ({ match, from: Number(match[1]), to: latest })),
        ...[...text.matchAll(RANGE_PATTERN)].map((match) => ({ match, from: Number(match[1]), to: rangeEnd({ from: Number(match[1]), raw: match[2] }) })),
        ...[...text.matchAll(SINGLE_YEAR_PATTERN)].map((match) => ({ match, from: Number(match[1]), to: Number(match[1]) })),
    ];
    return candidates.reduce<YearRange[]>((ranges, { match, from, to }) => {
        const start = match.index ?? 0;
        const end = start + match[0].trimEnd().length;
        if (ranges.some((range) => start < range.end && end > range.start)) {
            return ranges;
        }
        const touched = tokens.map((token, position) => ({ token, position })).filter(({ token }) => token.start < end && token.end > start);
        const clean = touched.length > 0 && touched.every(({ token }) => token.start >= start && token.end <= end);
        if (!clean || from < MIN_YEAR || from > latest || to < from || to > latest) {
            return ranges;
        }
        return [...ranges, { from, to, start, end, firstToken: touched[0].position, lastToken: touched[touched.length - 1].position }];
    }, []);
}

function rangeEnd({ from, raw }: { from: number; raw: string }): number {
    if (raw.length === 4) {
        return Number(raw);
    }
    const sameCentury = Math.floor(from / 100) * 100 + Number(raw);
    return sameCentury < from ? sameCentury + 100 : sameCentury;
}

function modelTerms({ model, makeAliases }: { model: string; makeAliases: string[] }): string[] {
    const words = model.split(/[\s/]+/).map((word) => normalize({ text: word })).filter((word) => word.length > 0);
    const distinctive = words.filter((word) => word.length >= 2 && !MODEL_STOP_WORDS.includes(word) && !makeAliases.includes(word));
    if (distinctive.length > 0) {
        return distinctive;
    }
    const whole = words.join('');
    return whole ? [whole] : [];
}

// A mention is the first distinctive model word with every other one close by; the years tied
// to it are the run of years right before it ("2015-2016 Ford F-250"), or if there is none,
// right after it ("F-250 2011 2012") up to the next make.
function modelMentions({ source, terms }: { source: ParsedSource; terms: string[] }): ModelMention[] {
    const { tokens } = source;
    return tokens
        .map((_, position) => position)
        .filter((position) => termAt({ tokens, position, term: terms[0] }))
        .filter((position) => terms.slice(1).every((term) => tokens.some((__, other) => Math.abs(other - position) <= TERM_WINDOW && termAt({ tokens, position: other, term }))))
        .map((position) => {
            const ranges = yearsBefore({ source, position });
            const tied = ranges.length > 0 ? ranges : yearsAfter({ source, position });
            return { ranges: tied, snippet: snippet({ source, position, ranges: tied }) };
        });
}

function yearsBefore({ source, position }: { source: ParsedSource; position: number }): YearRange[] {
    const collected = scanForYears({ source, positions: rangeOf({ from: position - 1, to: Math.max(0, position - YEAR_WINDOW), step: -1 }), stopAtMake: false });
    return [...collected].reverse();
}

function yearsAfter({ source, position }: { source: ParsedSource; position: number }): YearRange[] {
    return scanForYears({ source, positions: rangeOf({ from: position + 1, to: Math.min(source.tokens.length - 1, position + YEAR_WINDOW), step: 1 }), stopAtMake: true });
}

// Skips words until the first year, then collects consecutive years (allowing "and"/"or"),
// stopping at the first other word.
function scanForYears({ source, positions, stopAtMake }: { source: ParsedSource; positions: number[]; stopAtMake: boolean }): YearRange[] {
    const result = positions.reduce<{ ranges: YearRange[]; done: boolean }>((state, position) => {
        if (state.done) {
            return state;
        }
        const range = source.ranges.find((candidate) => position >= candidate.firstToken && position <= candidate.lastToken);
        if (range) {
            return state.ranges.includes(range) ? state : { ranges: [...state.ranges, range], done: false };
        }
        const norm = source.tokens[position].norm;
        if (state.ranges.length > 0) {
            return YEAR_CONNECTORS.includes(norm) ? state : { ranges: state.ranges, done: true };
        }
        return { ranges: state.ranges, done: stopAtMake && KNOWN_MAKES.includes(norm) };
    }, { ranges: [], done: false });
    return result.ranges;
}

function termAt({ tokens, position, term }: { tokens: Token[]; position: number; term: string }): boolean {
    const here = tokens[position]?.norm;
    if (here === undefined) {
        return false;
    }
    const next = tokens[position + 1]?.norm;
    return here === term || (next !== undefined && term.startsWith(here) && `${here}${next}` === term);
}

function aliasesFor({ make }: { make: string }): string[] {
    const key = normalize({ text: make });
    if (!key) {
        return [];
    }
    return MAKE_ALIASES.find((group) => group.includes(key)) ?? [key];
}

function otherMakesMentioned({ parsed, makeAliases }: { parsed: ParsedSource[]; makeAliases: string[] }): string[] {
    const found = parsed.flatMap((source) => source.tokens.map((token) => token.norm)).filter((norm) => KNOWN_MAKES.includes(norm) && !makeAliases.includes(norm));
    return [...new Set(found)];
}

function snippet({ source, position, ranges }: { source: ParsedSource; position: number; ranges: YearRange[] }): string {
    const token = source.tokens[position];
    const start = Math.max(0, Math.min(token.start, ...ranges.map((range) => range.start)) - SNIPPET_PADDING);
    const end = Math.min(source.source.text.length, Math.max(token.end, ...ranges.map((range) => range.end)) + SNIPPET_PADDING);
    return `${source.source.label}: "${source.source.text.slice(start, end).replace(/\s+/g, ' ').trim()}"`;
}

function rangeOf({ from, to, step }: { from: number; to: number; step: 1 | -1 }): number[] {
    const length = step === 1 ? to - from + 1 : from - to + 1;
    return length > 0 ? Array.from({ length }, (_, index) => from + index * step) : [];
}

function describeRanges({ ranges }: { ranges: { from: number; to: number }[] }): string {
    return [...new Set(ranges.map((range) => (range.from === range.to ? `${range.from}` : `${range.from}-${range.to}`)))].join(', ');
}

function normalize({ text }: { text: string }): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const TOKEN_PATTERN = /[A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)*/g;
const OPEN_RANGE_PATTERN = /\b((?:19|20)\d{2})(?:\s*\+|\s*-?\s*(?:and\s+)?(?:up|newer|later|present|current)\b)/gi;
const RANGE_PATTERN = /\b((?:19|20)\d{2})\s*(?:-|–|—|to|thru|through)\s*((?:19|20)?\d{2})\b/gi;
const SINGLE_YEAR_PATTERN = /\b((?:19|20)\d{2})\b(?!\s*(?:lbs?|psi|rpm|watts?|w|mm|cc|ft|nm|amps?|volts?|v|gpm|cfm|mah)\b)/gi;
const MIN_YEAR = 1950;
const TERM_WINDOW = 4;
const YEAR_WINDOW = 8;
const SNIPPET_PADDING = 25;
const MAX_EVIDENCE = 5;
const YEAR_CONNECTORS = ['and', 'or', 'thru', 'through', 'to'];
const MODEL_STOP_WORDS = [
    'duty', 'super', 'heavy', 'cab', 'crew', 'regular', 'extended', 'quad', 'double', 'mega', 'king', 'access', 'chassis', 'cutaway',
    'series', 'base', 'sport', 'limited', 'classic', 'custom', 'standard', 'hd', 'pickup', 'truck', 'van', 'wagon', 'sedan', 'coupe',
    'hatchback', 'convertible', 'utility', 'hybrid', 'plugin', '2wd', '4wd', 'awd', 'fwd', 'rwd', '4x4', '4x2', 'new',
];
const MAKE_ALIASES = [
    ['chevrolet', 'chevy'],
    ['ram', 'dodge'],
    ['volkswagen', 'vw'],
    ['mercedesbenz', 'mercedes', 'benz'],
    ['landrover', 'rangerover'],
];
const KNOWN_MAKES = [
    'ford', 'chevrolet', 'chevy', 'gmc', 'dodge', 'ram', 'jeep', 'chrysler', 'toyota', 'honda', 'nissan', 'hyundai', 'kia', 'subaru',
    'mazda', 'mitsubishi', 'volkswagen', 'vw', 'audi', 'bmw', 'mercedes', 'lexus', 'acura', 'infiniti', 'cadillac', 'buick', 'lincoln',
    'volvo', 'porsche', 'tesla', 'pontiac', 'saturn', 'mercury', 'isuzu', 'suzuki', 'scion', 'hummer', 'landrover',
];

export const fitmentMatcher = { assessFitment };

export type FitmentVerdict = 'text_match' | 'text_mismatch' | 'universal' | 'unknown';

export type FitmentConfidence = 'medium' | 'low';

export type FitmentSource = { label: string; text: string };

export type FitmentVehicle = { year: number; make: string; model: string };

export type FitmentAssessment = {
    verdict: FitmentVerdict;
    confidence: FitmentConfidence;
    make_matches: boolean | null;
    model_matches: boolean | null;
    year_matches: boolean | null;
    years_mentioned: string;
    years_near_model: string;
    evidence: string[];
    reasons: string[];
};

type AssessParams = {
    sources: FitmentSource[];
    fitType: string | null;
    brand: string | null;
    vehicle: FitmentVehicle;
    currentYear?: number;
};

type Token = { norm: string; start: number; end: number };

type YearRange = { from: number; to: number; start: number; end: number; firstToken: number; lastToken: number };

type ParsedSource = { source: FitmentSource; tokens: Token[]; ranges: YearRange[] };

type ModelMention = { ranges: YearRange[]; snippet: string };

type Decision = { verdict: FitmentVerdict; confidence: FitmentConfidence; reasons: string[] };

type DecideParams = {
    makeMatches: boolean | null;
    modelMatches: boolean | null;
    yearTied: boolean | null;
    yearAny: boolean | null;
    otherMakes: string[];
    vehicle: FitmentVehicle;
};
