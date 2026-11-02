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
});

describe('walmartLineMath.parseLine', () => {
    it('throws on an unreadable quantity instead of assuming 1', () => {
        expect(() => walmartLineMath.parseLine({ value: { lineNumber: '1', quantity: 'abc' }, index: 0 })).toThrow(/positive whole number/);
        expect(() => walmartLineMath.parseLine({ value: { lineNumber: '1' }, index: 0 })).toThrow(/positive whole number/);
        expect(() => walmartLineMath.parseLine({ value: { lineNumber: '1', quantity: 1.5 }, index: 0 })).toThrow(/positive whole number/);
        expect(walmartLineMath.parseLine({ value: { lineNumber: ' 2 ', quantity: '3' }, index: 0 })).toEqual({ lineNumber: '2', quantity: 3 });
        expect(walmartLineMath.parseLine({ value: { lineNumber: '' }, index: 0 })).toBeNull();
    });
});

describe('walmartLineMath.refundableCharges', () => {
    const charges = [
        { chargeType: 'PRODUCT', chargeName: 'ItemPrice', chargeAmount: { currency: 'USD', amount: 20 }, tax: { taxName: 'Tax1', taxAmount: { currency: 'USD', amount: 1.6 } } },
        { chargeType: 'SHIPPING', chargeName: 'Shipping', chargeAmount: { currency: 'USD', amount: 5 } },
    ];

    it('returns every charge when nothing was refunded', () => {
        expect(walmartLineMath.refundableCharges({ line: { charges: { charge: charges } } })).toEqual([
            { chargeType: 'PRODUCT', chargeName: 'ItemPrice', currency: 'USD', amount: 20, taxName: 'Tax1', taxAmount: 1.6 },
            { chargeType: 'SHIPPING', chargeName: 'Shipping', currency: 'USD', amount: 5, taxName: 'Tax', taxAmount: 0 },
        ]);
    });

    it('subtracts earlier refunds per charge type', () => {
        const refunded = {
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
