import { describe, expect, it } from 'vitest';
import { walmartLineMath } from './line-math';

describe('walmartLineMath.selectLines', () => {
    const order = orderWith({
        lines: [
            line({ lineNumber: '1', statuses: [['Acknowledged', '2'], ['Shipped', '1']] }),
            line({ lineNumber: '2', statuses: [['Cancelled', '1']] }),
            line({ lineNumber: '3', statuses: [['Created', '1']] }),
        ],
    });

    it('defaults to the remaining quantity of eligible lines only', () => {
        expect(walmartLineMath.selectLines({ order, chosen: [], statuses: ['Acknowledged'], action: 'shipped' })).toEqual([{ lineNumber: '1', quantity: 2 }]);
        expect(walmartLineMath.selectLines({ order, chosen: [], statuses: ['Created', 'Acknowledged'], action: 'cancelled' })).toEqual([
            { lineNumber: '1', quantity: 2 },
            { lineNumber: '3', quantity: 1 },
        ]);
    });

    it('fails clearly when nothing is eligible', () => {
        const shipped = orderWith({ lines: [line({ lineNumber: '1', statuses: [['Shipped', '1']] })] });
        expect(() => walmartLineMath.selectLines({ order: shipped, chosen: [], statuses: ['Acknowledged'], action: 'shipped' })).toThrow(/No lines of this order can be shipped.*1 Shipped/);
    });

    it('rejects explicit rows for ineligible lines or too much quantity', () => {
        expect(() => walmartLineMath.selectLines({ order, chosen: [{ lineNumber: '2', quantity: 1 }], statuses: ['Acknowledged'], action: 'shipped' })).toThrow(/Line 2 cannot be shipped/);
        expect(() => walmartLineMath.selectLines({ order, chosen: [{ lineNumber: '1', quantity: 3 }], statuses: ['Acknowledged'], action: 'shipped' })).toThrow(/only 2/);
        expect(walmartLineMath.selectLines({ order, chosen: [{ lineNumber: '1', quantity: 1 }], statuses: ['Acknowledged'], action: 'shipped' })).toEqual([{ lineNumber: '1', quantity: 1 }]);
    });

    it('sums duplicate rows for the same line before checking', () => {
        expect(() => walmartLineMath.selectLines({ order, chosen: [{ lineNumber: '1', quantity: 2 }, { lineNumber: '1', quantity: 1 }], statuses: ['Acknowledged'], action: 'shipped' })).toThrow(/3 shipped in total, but only 2/);
        expect(walmartLineMath.selectLines({ order, chosen: [{ lineNumber: '1', quantity: 1 }, { lineNumber: '1', quantity: 1 }], statuses: ['Acknowledged'], action: 'shipped' })).toEqual([{ lineNumber: '1', quantity: 2 }]);
    });
});

describe('walmartLineMath.parseLine', () => {
    it('throws on an unreadable quantity instead of assuming 1', () => {
        expect(() => walmartLineMath.parseLine({ value: { lineNumber: '1', quantity: 'abc' }, index: 0 })).toThrow(/positive whole number/);
        expect(() => walmartLineMath.parseLine({ value: { lineNumber: '1' }, index: 0 })).toThrow(/positive whole number/);
        expect(() => walmartLineMath.parseLine({ value: { lineNumber: '1', quantity: 1.5 }, index: 0 })).toThrow(/positive whole number/);
        expect(walmartLineMath.parseLine({ value: { lineNumber: ' 2 ', quantity: '3' }, index: 0 })).toEqual({ lineNumber: '2', quantity: 3 });
    });

    it('throws on a row without a line number instead of skipping it', () => {
        expect(() => walmartLineMath.parseLine({ value: { lineNumber: '', quantity: 1 }, index: 0 })).toThrow(/Row 1 has no Line Number/);
        expect(() => walmartLineMath.parseLine({ value: { quantity: 1 }, index: 1 })).toThrow(/Row 2 has no Line Number/);
        expect(() => walmartLineMath.parseLine({ value: null, index: 0 })).toThrow(/no Line Number/);
    });
});

describe('walmartLineMath partial refunds', () => {
    const order = orderWith({
        lines: [{
            ...line({ lineNumber: '1', statuses: [['Shipped', '2'], ['Cancelled', '1']] }),
            charges: { charge: [
                { chargeType: 'PRODUCT', chargeName: 'ItemPrice', chargeAmount: { currency: 'USD', amount: 30 }, tax: { taxName: 'Tax1', taxAmount: { currency: 'USD', amount: 3 } } },
                { chargeType: 'SHIPPING', chargeName: 'Shipping', chargeAmount: { currency: 'USD', amount: 6 } },
            ] },
        }],
    });

    it('throws on a row without a line number instead of falling back to a full refund', () => {
        expect(() => walmartLineMath.parsePartialRefund({ value: { lineNumber: '', itemAmount: 5 }, index: 0 })).toThrow(/Row 1 has no Line Number/);
        expect(() => walmartLineMath.parsePartialRefund({ value: { itemAmount: 5 }, index: 2 })).toThrow(/Row 3 has no Line Number/);
        expect(() => walmartLineMath.parsePartialRefund({ value: { lineNumber: '1', itemAmount: -5 }, index: 0 })).toThrow(/positive number/);
        expect(walmartLineMath.parsePartialRefund({ value: { lineNumber: '1', itemAmount: '5' }, index: 0 })).toEqual({ lineNumber: '1', itemAmount: 5, itemTax: 0, shippingAmount: 0 });
    });

    it('caps partial amounts (summed per line) at what is refundable on the shipped quantity', () => {
        expect(walmartLineMath.checkPartialRefunds({ order, rows: [{ lineNumber: '1', itemAmount: 20, itemTax: 2, shippingAmount: 4 }] })).toHaveLength(1);
        expect(() => walmartLineMath.checkPartialRefunds({ order, rows: [{ lineNumber: '1', itemAmount: 25, itemTax: 0, shippingAmount: 0 }] })).toThrow(/Item Amount 25 is more than the 20/);
        expect(() => walmartLineMath.checkPartialRefunds({ order, rows: [
            { lineNumber: '1', itemAmount: 15, itemTax: 0, shippingAmount: 0 },
            { lineNumber: '1', itemAmount: 10, itemTax: 0, shippingAmount: 0 },
        ] })).toThrow(/Item Amount 25/);
        expect(() => walmartLineMath.checkPartialRefunds({ order, rows: [{ lineNumber: '9', itemAmount: 1, itemTax: 0, shippingAmount: 0 }] })).toThrow(/not in this order/);
    });

    it('refuses a partial refund on a line with nothing shipped', () => {
        const unshipped = orderWith({ lines: [{ ...line({ lineNumber: '1', statuses: [['Acknowledged', '3']] }), charges: { charge: [{ chargeType: 'PRODUCT', chargeAmount: { amount: 30 } }] } }] });
        expect(() => walmartLineMath.checkPartialRefunds({ order: unshipped, rows: [{ lineNumber: '1', itemAmount: 1, itemTax: 0, shippingAmount: 0 }] })).toThrow(/more than the 0/);
    });
});

describe('walmartLineMath.refundableCharges', () => {
    it('scales charges by shipped over ordered quantity', () => {
        const partly = {
            ...line({ lineNumber: '1', statuses: [['Shipped', '2'], ['Cancelled', '1']] }),
            charges: { charge: [{ chargeType: 'PRODUCT', chargeName: 'ItemPrice', chargeAmount: { currency: 'USD', amount: 30 }, tax: { taxName: 'Tax1', taxAmount: { currency: 'USD', amount: 3 } } }] },
        };
        expect(walmartLineMath.refundableCharges({ line: partly })).toEqual([
            { chargeType: 'PRODUCT', chargeName: 'ItemPrice', currency: 'USD', amount: 20, taxName: 'Tax1', taxAmount: 2 },
        ]);
    });

    const shippedLine = line({ lineNumber: '1', statuses: [['Shipped', '3']] });
    const charges = [
        { chargeType: 'PRODUCT', chargeName: 'ItemPrice', chargeAmount: { currency: 'USD', amount: 20 }, tax: { taxName: 'Tax1', taxAmount: { currency: 'USD', amount: 1.6 } } },
        { chargeType: 'SHIPPING', chargeName: 'Shipping', chargeAmount: { currency: 'USD', amount: 5 } },
    ];

    it('returns every charge when nothing was refunded', () => {
        expect(walmartLineMath.refundableCharges({ line: { ...shippedLine, charges: { charge: charges } } })).toEqual([
            { chargeType: 'PRODUCT', chargeName: 'ItemPrice', currency: 'USD', amount: 20, taxName: 'Tax1', taxAmount: 1.6 },
            { chargeType: 'SHIPPING', chargeName: 'Shipping', currency: 'USD', amount: 5, taxName: 'Tax', taxAmount: 0 },
        ]);
    });

    it('subtracts earlier refunds per charge type', () => {
        const refunded = {
            ...shippedLine,
            charges: { charge: charges },
            refund: {
                refundCharges: {
                    refundCharge: [
                        { refundReason: 'DamagedItem', charge: { chargeType: 'PRODUCT', chargeName: 'Item Price', chargeAmount: { currency: 'USD', amount: -12.5 }, tax: { taxName: 'Tax1', taxAmount: { currency: 'USD', amount: -1 } } } },
                        { refundReason: 'DamagedItem', charge: { chargeType: 'SHIPPING', chargeName: 'Shipping', chargeAmount: { currency: 'USD', amount: -5 } } },
                    ],
                },
            },
        };
        expect(walmartLineMath.refundableCharges({ line: refunded })).toEqual([
            { chargeType: 'PRODUCT', chargeName: 'ItemPrice', currency: 'USD', amount: 7.5, taxName: 'Tax1', taxAmount: 0.6 },
        ]);
    });

    it('returns nothing for a fully refunded line', () => {
        const fully = {
            ...shippedLine,
            charges: { charge: charges },
            refunds: {
                refund: [
                    { refundCharges: { refundCharge: { charge: { chargeType: 'PRODUCT', chargeAmount: { amount: -20 }, tax: { taxAmount: { amount: -1.6 } } } } } },
                    { refundCharges: { refundCharge: { charge: { chargeType: 'SHIPPING', chargeAmount: { amount: -5 } } } } },
                ],
            },
        };
        expect(walmartLineMath.refundableCharges({ line: fully })).toEqual([]);
    });
});

function orderWith({ lines }: { lines: Record<string, unknown>[] }): Record<string, unknown> {
    return { orderLines: { orderLine: lines } };
}

function line({ lineNumber, statuses }: { lineNumber: string; statuses: [string, string][] }): Record<string, unknown> {
    return {
        lineNumber,
        orderLineQuantity: { amount: '3' },
        orderLineStatuses: { orderLineStatus: statuses.map(([status, amount]) => ({ status, statusQuantity: { unitOfMeasurement: 'EACH', amount } })) },
    };
}
