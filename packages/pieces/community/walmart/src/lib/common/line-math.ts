import { walmartJson } from './json';

const { arrayAt, numberAt, stringAt, round } = walmartJson;

// A line's quantity is split across statuses (e.g. 2 Acknowledged, 1 Shipped); what an action
// may still touch is the quantity sitting in the statuses it applies to.
function eligibleLines({ order, statuses }: { order: unknown; statuses: string[] }): EligibleLine[] {
    return arrayAt({ value: order, path: ['orderLines', 'orderLine'] })
        .map((line) => ({
            lineNumber: stringAt({ value: line, path: ['lineNumber'] }) ?? '',
            quantity: arrayAt({ value: line, path: ['orderLineStatuses', 'orderLineStatus'] })
                .filter((status) => statuses.includes(stringAt({ value: status, path: ['status'] }) ?? ''))
                .reduce((sum, status) => sum + (numberAt({ value: status, path: ['statusQuantity', 'amount'] }) ?? 0), 0),
        }))
        .filter((line) => line.lineNumber !== '' && line.quantity > 0);
}

// Explicit rows are checked against what is still eligible, so a typo or a line that is
// already shipped/cancelled fails here rather than as a vague Walmart error.
function selectLines({ order, chosen, statuses, action }: SelectLinesParams): EligibleLine[] {
    const eligible = eligibleLines({ order, statuses });
    if (chosen.length === 0) {
        if (eligible.length === 0) {
            const current = lineStatusSummary({ order });
            throw new Error(`No lines of this order can be ${action}: it needs lines in status ${statuses.join(' or ')}, and the order has ${current || 'no lines'}.`);
        }
        return eligible;
    }
    // The same line listed twice is one request for the summed quantity.
    const combined = chosen.reduce<EligibleLine[]>((lines, line) => {
        const existing = lines.find((candidate) => candidate.lineNumber === line.lineNumber);
        return existing
            ? lines.map((candidate) => (candidate === existing ? { ...candidate, quantity: candidate.quantity + line.quantity } : candidate))
            : [...lines, line];
    }, []);
    return combined.map((line) => {
        const match = eligible.find((candidate) => candidate.lineNumber === line.lineNumber);
        if (!match) {
            throw new Error(`Line ${line.lineNumber} cannot be ${action}: it is not in the order or has no quantity in status ${statuses.join(' or ')}.`);
        }
        if (line.quantity > match.quantity) {
            throw new Error(`Line ${line.lineNumber}: asked to have ${line.quantity} ${action} in total, but only ${match.quantity} can be.`);
        }
        return line;
    });
}

// A row without a line number is an error, never "skip it": if every row were skipped the
// action would fall back to the whole order.
function parseLine({ value, index }: { value: unknown; index: number }): EligibleLine {
    const lineNumber = rowLineNumber({ value, index });
    if (typeof value !== 'object' || value === null) {
        throw new Error(`Order line row ${index + 1} is empty.`);
    }
    const rawQuantity = 'quantity' in value ? value.quantity : undefined;
    const quantity = Number(rawQuantity);
    if (rawQuantity === undefined || rawQuantity === null || rawQuantity === '' || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Order line row ${index + 1} (line ${lineNumber}) has quantity "${String(rawQuantity ?? '')}"; it must be a positive whole number.`);
    }
    return { lineNumber, quantity };
}

function parsePartialRefund({ value, index }: { value: unknown; index: number }): PartialRefund {
    const lineNumber = rowLineNumber({ value, index });
    const field = (key: string) => (typeof value === 'object' && value !== null && key in value ? Reflect.get(value, key) : undefined);
    const row = {
        lineNumber,
        itemAmount: nonNegative({ value: field('itemAmount'), label: 'Item Amount', index }),
        itemTax: nonNegative({ value: field('itemTax'), label: 'Item Tax', index }),
        shippingAmount: nonNegative({ value: field('shippingAmount'), label: 'Shipping Amount', index }),
    };
    if (row.itemAmount + row.itemTax + row.shippingAmount <= 0) {
        throw new Error(`Refund row ${index + 1} (line ${lineNumber}) has no amount to refund.`);
    }
    // Item tax is refunded on the item charge, so it cannot go out without an item amount.
    if (row.itemTax > 0 && row.itemAmount <= 0) {
        throw new Error(`Refund row ${index + 1} (line ${lineNumber}) refunds Item Tax without an Item Amount; Walmart refunds tax together with the item price, so set Item Amount too.`);
    }
    return row;
}

// Partial amounts (summed per line) may not exceed what is still refundable on the shipped
// part of the line, so a typo cannot refund more than the customer paid.
function checkPartialRefunds({ order, rows }: { order: unknown; rows: PartialRefund[] }): PartialRefund[] {
    const combined = rows.reduce<PartialRefund[]>((lines, row) => {
        const existing = lines.find((candidate) => candidate.lineNumber === row.lineNumber);
        return existing
            ? lines.map((candidate) => (candidate === existing
                ? { lineNumber: row.lineNumber, itemAmount: candidate.itemAmount + row.itemAmount, itemTax: candidate.itemTax + row.itemTax, shippingAmount: candidate.shippingAmount + row.shippingAmount }
                : candidate))
            : [...lines, row];
    }, []);
    const orderLines = arrayAt({ value: order, path: ['orderLines', 'orderLine'] });
    return combined.map((row) => {
        const line = orderLines.find((candidate) => stringAt({ value: candidate, path: ['lineNumber'] }) === row.lineNumber);
        if (!line) {
            throw new Error(`Line ${row.lineNumber} is not in this order.`);
        }
        const available = refundableCharges({ line });
        const sum = (type: string, key: 'amount' | 'taxAmount') => round({ value: available.filter((charge) => charge.chargeType === type).reduce((total, charge) => total + charge[key], 0) });
        const limits = [
            { label: 'Item Amount', asked: row.itemAmount, left: sum('PRODUCT', 'amount') },
            { label: 'Item Tax', asked: row.itemTax, left: sum('PRODUCT', 'taxAmount') },
            { label: 'Shipping Amount', asked: row.shippingAmount, left: sum('SHIPPING', 'amount') },
        ];
        const over = limits.find((limit) => round({ value: limit.asked }) > limit.left + AMOUNT_TOLERANCE);
        if (over) {
            throw new Error(`Line ${row.lineNumber}: ${over.label} ${round({ value: over.asked })} is more than the ${over.left} still refundable on its shipped quantity.`);
        }
        return row;
    });
}

// Each charge on a line is refunded at most once in total, and only for the shipped part:
// charges are scaled by shipped/ordered quantity (a partly cancelled line is not refunded in
// full), then earlier refunds (`refund` on the line) are subtracted per charge type.
function refundableCharges({ line }: { line: unknown }): RefundableCharge[] {
    const fraction = shippedFraction({ line });
    const refundedCharges = arrayAt({ value: line, path: ['refund'] })
        .concat(arrayAt({ value: line, path: ['refunds', 'refund'] }))
        .flatMap((refund) => arrayAt({ value: refund, path: ['refundCharges', 'refundCharge'] }))
        .map((entry) => walmartJson.valueAt({ value: entry, path: ['charge'] }));
    const pools = {
        amount: totalsByType({ charges: refundedCharges, path: ['chargeAmount', 'amount'] }),
        tax: totalsByType({ charges: refundedCharges, path: ['tax', 'taxAmount', 'amount'] }),
    };
    const charges = arrayAt({ value: line, path: ['charges', 'charge'] });
    const result = charges.reduce<{ charges: RefundableCharge[]; amountPool: Record<string, number>; taxPool: Record<string, number> }>((state, charge) => {
        const chargeType = stringAt({ value: charge, path: ['chargeType'] }) ?? 'PRODUCT';
        const amount = round({ value: Math.max(0, numberAt({ value: charge, path: ['chargeAmount', 'amount'] }) ?? 0) * fraction });
        const tax = round({ value: Math.max(0, numberAt({ value: charge, path: ['tax', 'taxAmount', 'amount'] }) ?? 0) * fraction });
        const amountUsed = Math.min(amount, state.amountPool[chargeType] ?? 0);
        const taxUsed = Math.min(tax, state.taxPool[chargeType] ?? 0);
        const remaining = {
            chargeType,
            chargeName: stringAt({ value: charge, path: ['chargeName'] }) ?? 'Item Price',
            currency: stringAt({ value: charge, path: ['chargeAmount', 'currency'] }) ?? 'USD',
            amount: round({ value: amount - amountUsed }),
            taxName: stringAt({ value: charge, path: ['tax', 'taxName'] }) ?? 'Tax',
            taxAmount: round({ value: tax - taxUsed }),
        };
        return {
            charges: [...state.charges, remaining],
            amountPool: { ...state.amountPool, [chargeType]: (state.amountPool[chargeType] ?? 0) - amountUsed },
            taxPool: { ...state.taxPool, [chargeType]: (state.taxPool[chargeType] ?? 0) - taxUsed },
        };
    }, { charges: [], amountPool: pools.amount, taxPool: pools.tax });
    return result.charges.filter((charge) => charge.amount > 0 || charge.taxAmount > 0);
}

function shippedFraction({ line }: { line: unknown }): number {
    const statuses = arrayAt({ value: line, path: ['orderLineStatuses', 'orderLineStatus'] });
    const quantityIn = ({ wanted }: { wanted: string[] | null }) => statuses
        .filter((status) => wanted === null || wanted.includes(stringAt({ value: status, path: ['status'] }) ?? ''))
        .reduce((sum, status) => sum + (numberAt({ value: status, path: ['statusQuantity', 'amount'] }) ?? 0), 0);
    const ordered = numberAt({ value: line, path: ['orderLineQuantity', 'amount'] }) ?? quantityIn({ wanted: null });
    const shipped = quantityIn({ wanted: REFUNDABLE_STATUSES });
    return ordered > 0 ? Math.min(1, shipped / ordered) : 0;
}

function rowLineNumber({ value, index }: { value: unknown; index: number }): string {
    const raw = typeof value === 'object' && value !== null && 'lineNumber' in value ? value.lineNumber : undefined;
    const lineNumber = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
    if (!lineNumber) {
        throw new Error(`Row ${index + 1} has no Line Number. Remove the row, or leave the list empty to use every eligible line.`);
    }
    return lineNumber;
}

function nonNegative({ value, label, index }: { value: unknown; label: string; index: number }): number {
    if (value === undefined || value === null || value === '') {
        return 0;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Refund row ${index + 1}: ${label} "${String(value)}" must be a positive number.`);
    }
    return parsed;
}

function totalsByType({ charges, path }: { charges: unknown[]; path: string[] }): Record<string, number> {
    return charges.reduce<Record<string, number>>((totals, charge) => {
        const chargeType = stringAt({ value: charge, path: ['chargeType'] }) ?? 'PRODUCT';
        const amount = Math.abs(numberAt({ value: charge, path }) ?? 0);
        return { ...totals, [chargeType]: (totals[chargeType] ?? 0) + amount };
    }, {});
}

function lineStatusSummary({ order }: { order: unknown }): string {
    return arrayAt({ value: order, path: ['orderLines', 'orderLine'] })
        .map((line) => {
            const statuses = arrayAt({ value: line, path: ['orderLineStatuses', 'orderLineStatus'] })
                .map((status) => `${numberAt({ value: status, path: ['statusQuantity', 'amount'] }) ?? '?'} ${stringAt({ value: status, path: ['status'] }) ?? 'unknown'}`);
            return `line ${stringAt({ value: line, path: ['lineNumber'] }) ?? '?'}: ${statuses.join(', ') || 'no status'}`;
        })
        .join('; ');
}

const AMOUNT_TOLERANCE = 0.005;

export const REFUNDABLE_STATUSES = ['Shipped', 'Delivered'];

export const walmartLineMath = { eligibleLines, selectLines, parseLine, parsePartialRefund, checkPartialRefunds, refundableCharges, lineStatusSummary };

export type EligibleLine = { lineNumber: string; quantity: number };

export type PartialRefund = { lineNumber: string; itemAmount: number; itemTax: number; shippingAmount: number };

export type RefundableCharge = {
    chargeType: string;
    chargeName: string;
    currency: string;
    amount: number;
    taxName: string;
    taxAmount: number;
};

type SelectLinesParams = {
    order: unknown;
    chosen: EligibleLine[];
    statuses: string[];
    action: string;
};
