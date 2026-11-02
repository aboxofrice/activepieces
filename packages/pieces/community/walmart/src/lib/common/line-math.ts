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
    return chosen.map((line) => {
        const match = eligible.find((candidate) => candidate.lineNumber === line.lineNumber);
        if (!match) {
            throw new Error(`Line ${line.lineNumber} cannot be ${action}: it is not in the order or has no quantity in status ${statuses.join(' or ')}.`);
        }
        if (line.quantity > match.quantity) {
            throw new Error(`Line ${line.lineNumber}: asked to have ${line.quantity} ${action}, but only ${match.quantity} can be.`);
        }
        return line;
    });
}

function parseLine({ value, index }: { value: unknown; index: number }): EligibleLine | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const lineNumber = 'lineNumber' in value ? String(value.lineNumber ?? '').trim() : '';
    if (!lineNumber) {
        return null;
    }
    const rawQuantity = 'quantity' in value ? value.quantity : undefined;
    const quantity = Number(rawQuantity);
    if (rawQuantity === undefined || rawQuantity === null || rawQuantity === '' || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Order line row ${index + 1} (line ${lineNumber}) has quantity "${String(rawQuantity ?? '')}"; it must be a positive whole number.`);
    }
    return { lineNumber, quantity };
}

// Each charge on a line is refunded at most once in total: earlier refunds (on the order as
// `refund`) are subtracted per charge type before mirroring what is left.
function refundableCharges({ line }: { line: unknown }): RefundableCharge[] {
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
        const amount = Math.max(0, numberAt({ value: charge, path: ['chargeAmount', 'amount'] }) ?? 0);
        const tax = Math.max(0, numberAt({ value: charge, path: ['tax', 'taxAmount', 'amount'] }) ?? 0);
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

export const walmartLineMath = { eligibleLines, selectLines, parseLine, refundableCharges, lineStatusSummary };

export type EligibleLine = { lineNumber: string; quantity: number };

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
