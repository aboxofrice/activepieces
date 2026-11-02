import { describe, expect, it } from 'vitest';
import { listingPatches } from './listing-patches';

const US = 'ATVPDKIKX0DER';

describe('listingPatches.fulfillmentAvailability', () => {
    it('keeps the current handling time when none is given', () => {
        const result = listingPatches.fulfillmentAvailability({
            current: [{ fulfillment_channel_code: 'DEFAULT', quantity: 3, lead_time_to_ship_max_days: 4, marketplace_id: US }],
            marketplaceId: US,
            quantity: 10,
        });
        expect(result).toEqual([{ fulfillment_channel_code: 'DEFAULT', quantity: 10, lead_time_to_ship_max_days: 4, marketplace_id: US }]);
    });

    it('replaces the handling time when given and keeps other entries', () => {
        const result = listingPatches.fulfillmentAvailability({
            current: [{ fulfillment_channel_code: 'AMAZON_NA' }, { fulfillment_channel_code: 'DEFAULT', quantity: 3, lead_time_to_ship_max_days: 4, restock_date: '2026-12-01' }],
            marketplaceId: US,
            quantity: 0,
            handlingTime: 2,
        });
        expect(result).toEqual([
            { fulfillment_channel_code: 'AMAZON_NA' },
            { fulfillment_channel_code: 'DEFAULT', quantity: 0, lead_time_to_ship_max_days: 2, restock_date: '2026-12-01', marketplace_id: US },
        ]);
    });

    it('refuses to add a merchant entry to an FBA-only listing', () => {
        expect(() => listingPatches.fulfillmentAvailability({ current: [{ fulfillment_channel_code: 'AMAZON_NA' }], marketplaceId: US, quantity: 5 })).toThrow(/FBA listing.*managed by Amazon/);
    });

    it('treats an AMAZON_* channel in the listing fulfillmentAvailability as FBA', () => {
        expect(() => listingPatches.fulfillmentAvailability({ current: undefined, liveChannels: ['AMAZON_NA'], marketplaceId: US, quantity: 5 })).toThrow(/FBA listing \(AMAZON_NA\)/);
    });

    it('creates the merchant entry when the listing has none', () => {
        const result = listingPatches.fulfillmentAvailability({ current: undefined, marketplaceId: US, quantity: 5 });
        expect(result).toEqual([{ fulfillment_channel_code: 'DEFAULT', quantity: 5, marketplace_id: US }]);
    });
});

describe('listingPatches.purchasableOffer', () => {
    const current = [
        {
            marketplace_id: US,
            currency: 'USD',
            audience: 'ALL',
            our_price: [{ schedule: [{ value_with_tax: 40 }] }],
            minimum_seller_allowed_price: [{ schedule: [{ value_with_tax: 30 }] }],
            maximum_seller_allowed_price: [{ schedule: [{ value_with_tax: 60 }] }],
            discounted_price: [{ schedule: [{ start_at: '2026-11-01', end_at: '2026-11-30', value_with_tax: 35 }] }],
        },
        {
            marketplace_id: US,
            currency: 'USD',
            audience: 'B2B',
            our_price: [{ schedule: [{ value_with_tax: 38 }] }],
            quantity_discount_plan: [{ schedule: [{ discount_type: 'percent', levels: [{ lower_bound: 5, value: 5 }] }] }],
        },
    ];

    it('changes only the consumer price and keeps guard rails, sale price and B2B pricing', () => {
        const result = listingPatches.purchasableOffer({ current, marketplaceId: US, currency: 'USD', price: 42.5 });
        expect(result[0]).toEqual({ ...current[0], our_price: [{ schedule: [{ value_with_tax: 42.5 }] }] });
        expect(result[1]).toEqual(current[1]);
    });

    it('replaces min/max only when given', () => {
        const result = listingPatches.purchasableOffer({ current, marketplaceId: US, currency: 'USD', price: 42.5, minimumPrice: 25 });
        expect(result[0]['minimum_seller_allowed_price']).toEqual([{ schedule: [{ value_with_tax: 25 }] }]);
        expect(result[0]['maximum_seller_allowed_price']).toEqual(current[0].maximum_seller_allowed_price);
    });

    it('keeps extra price and schedule entries', () => {
        const multi = [{ marketplace_id: US, our_price: [
            { schedule: [{ value_with_tax: 40 }, { value_with_tax: 45, start_at: '2027-01-01' }] },
            { schedule: [{ value_with_tax: 50 }] },
        ] }];
        const result = listingPatches.purchasableOffer({ current: multi, marketplaceId: US, currency: 'USD', price: 41 });
        expect(result[0]['our_price']).toEqual([
            { schedule: [{ value_with_tax: 41 }, { value_with_tax: 45, start_at: '2027-01-01' }] },
            { schedule: [{ value_with_tax: 50 }] },
        ]);
    });

    it('creates a consumer entry when there is none', () => {
        const result = listingPatches.purchasableOffer({ current: [current[1]], marketplaceId: US, currency: 'USD', price: 10 });
        expect(result).toEqual([current[1], { marketplace_id: US, currency: 'USD', our_price: [{ schedule: [{ value_with_tax: 10 }] }] }]);
    });
});
