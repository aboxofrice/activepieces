function parseCsv({ text }: { text: string }): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"';
                i += 2;
                continue;
            }
            if (ch === '"') {
                inQuotes = false;
            }
            else {
                cell += ch;
            }
            i += 1;
            continue;
        }
        // Dealer exports write text cells as ="VALUE" so Excel keeps leading zeros; treat that as a quoted cell.
        if (ch === '=' && cell === '' && text[i + 1] === '"') {
            inQuotes = true;
            i += 2;
            continue;
        }
        if (ch === '"' && cell === '') {
            inQuotes = true;
        }
        else if (ch === ',') {
            row.push(cell);
            cell = '';
        }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') {
                i += 1;
            }
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        }
        else {
            cell += ch;
        }
        i += 1;
    }
    if (cell !== '' || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function mapToCatalog({ text, partNumberColumn, quantityColumn, catalogIds, match, onlyProductIds }: MapToCatalogParams): CatalogMapping {
    const [header, ...records] = parseCsv({ text });
    if (!header) {
        throw new Error('The CSV file is empty.');
    }
    const columns = header.map((name) => name.trim().toUpperCase());
    const partIndex = columns.indexOf(partNumberColumn.trim().toUpperCase());
    const qtyIndex = columns.indexOf(quantityColumn.trim().toUpperCase());
    if (partIndex === -1 || qtyIndex === -1) {
        throw new Error(`Column not found. Looked for "${partNumberColumn}" and "${quantityColumn}" in: ${header.join(', ')}`);
    }

    const catalog = new Map(catalogIds.map((id) => [id.toUpperCase(), id]));
    const only = onlyProductIds.length > 0 ? new Set(onlyProductIds.map((id) => id.toUpperCase())) : null;

    const resolved = records.map((record) => {
        const partNumber = cleanPartNumber({ raw: record[partIndex] ?? '' });
        const quantity = Math.max(0, parseInt(record[qtyIndex] ?? '', 10) || 0);
        const productId = candidates({ partNumber, match }).map((c) => catalog.get(c.toUpperCase())).find((id) => id !== undefined) ?? null;
        return { partNumber, quantity, productId };
    }).filter((r) => r.partNumber !== '');

    const matched = resolved.filter((r): r is ResolvedRow & { productId: string } => r.productId !== null);
    const unmatched = resolved.filter((r) => r.productId === null);
    // Several part numbers can land on one SellerCloud product (e.g. with and without leading zeros), so quantities add up.
    const totals = matched
        .filter((r) => only === null || only.has(r.productId.toUpperCase()))
        .reduce((acc, r) => acc.set(r.productId, (acc.get(r.productId) ?? 0) + r.quantity), new Map<string, number>());

    return {
        fileRows: records.length,
        matchedRows: matched.length,
        unmatchedRows: unmatched.length,
        unmatchedSample: unmatched.slice(0, 20).map((r) => r.partNumber),
        rows: [...totals.entries()].map(([productId, quantity]) => ({ productId, quantity })),
        missingFromFile: only === null ? [] : [...only].filter((id) => ![...totals.keys()].some((k) => k.toUpperCase() === id)),
    };
}

function cleanPartNumber({ raw }: { raw: string }): string {
    return raw.replace(/["'=]/g, '').trim();
}

function candidates({ partNumber, match }: { partNumber: string; match: MatchOptions }): string[] {
    const bases = match.stripLeadingZeros && /^0+\d+$/.test(partNumber)
        ? [partNumber, partNumber.replace(/^0+/, '')]
        : [partNumber];
    return bases.flatMap((base) => [
        ...(match.suffix ? [`${base}${match.suffix}`] : []),
        ...(match.matchWithoutSuffix || !match.suffix ? [base] : []),
    ]);
}

export const csvMapping = {
    parseCsv,
    mapToCatalog,
};

export type MatchOptions = {
    suffix: string;
    matchWithoutSuffix: boolean;
    stripLeadingZeros: boolean;
};

export type CatalogMapping = {
    fileRows: number;
    matchedRows: number;
    unmatchedRows: number;
    unmatchedSample: string[];
    rows: { productId: string; quantity: number }[];
    missingFromFile: string[];
};

type ResolvedRow = {
    partNumber: string;
    quantity: number;
    productId: string | null;
};

type MapToCatalogParams = {
    text: string;
    partNumberColumn: string;
    quantityColumn: string;
    catalogIds: string[];
    match: MatchOptions;
    onlyProductIds: string[];
};
