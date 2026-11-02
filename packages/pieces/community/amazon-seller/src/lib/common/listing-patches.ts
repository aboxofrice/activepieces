// A Listings Items `replace` swaps the whole attribute, so the new value is built from the
// listing's current one: fields and entries the user did not set are carried forward.

function fulfillmentAvailability({ current, marketplaceId, quantity, handlingTime }: FulfillmentParams): Record<string, unknown>[] {
    const entries = recordsOf({ value: current });
    const index = entries.findIndex((entry) => entry['fulfillment_channel_code'] === MFN_CHANNEL_CODE);
    // Adding a DEFAULT entry to an FBA-only listing could switch it to merchant-fulfilled.
    const fbaChannels = entries.map((entry) => entry['fulfillment_channel_code']).filter((code): code is string => typeof code === 'string' && code.startsWith('AMAZON_'));
    if (index === -1 && fbaChannels.length > 0) {
        throw new Error(`This is an FBA listing (${fbaChannels.join(', ')}); its quantity is managed by Amazon and cannot be set here.`);
    }
    const existing = index === -1 ? {} : entries[index];
    const updated: Record<string, unknown> = {
        ...existing,
        fulfillment_channel_code: MFN_CHANNEL_CODE,
        quantity,
        marketplace_id: typeof existing['marketplace_id'] === 'string' ? existing['marketplace_id'] : marketplaceId,
        ...(handlingTime === undefined ? {} : { lead_time_to_ship_max_days: handlingTime }),
    };
    return index === -1 ? [...entries, updated] : entries.map((entry, position) => (position === index ? updated : entry));
}

// purchasable_offer holds one entry per audience (consumer "ALL", business "B2B", ...), each
// with its own price, min/max guard rails, sale price and quantity discounts. Only the
// consumer entry's our_price (and min/max when given) changes.
function purchasableOffer({ current, marketplaceId, currency, price, minimumPrice, maximumPrice }: OfferParams): Record<string, unknown>[] {
    const entries = recordsOf({ value: current });
    const index = entries.findIndex((entry) => isConsumerOffer({ entry, marketplaceId }));
    const existing = index === -1 ? {} : entries[index];
    const updated: Record<string, unknown> = {
        ...existing,
        marketplace_id: typeof existing['marketplace_id'] === 'string' ? existing['marketplace_id'] : marketplaceId,
        currency: typeof existing['currency'] === 'string' ? existing['currency'] : currency,
        our_price: withScheduleValue({ current: existing['our_price'], amount: price }),
        ...(minimumPrice === undefined ? {} : { minimum_seller_allowed_price: withScheduleValue({ current: existing['minimum_seller_allowed_price'], amount: minimumPrice }) }),
        ...(maximumPrice === undefined ? {} : { maximum_seller_allowed_price: withScheduleValue({ current: existing['maximum_seller_allowed_price'], amount: maximumPrice }) }),
    };
    return index === -1 ? [...entries, updated] : entries.map((entry, position) => (position === index ? updated : entry));
}

function isConsumerOffer({ entry, marketplaceId }: { entry: Record<string, unknown>; marketplaceId: string }): boolean {
    const audience = entry['audience'];
    const entryMarketplace = entry['marketplace_id'];
    return (audience === undefined || audience === 'ALL') && (entryMarketplace === undefined || entryMarketplace === marketplaceId);
}

// Price attributes are [{ schedule: [{ value_with_tax }, ...] }, ...]. Only the first schedule
// entry's value changes; every other key and entry Amazon returned is kept.
function withScheduleValue({ current, amount }: { current: unknown; amount: number }): Record<string, unknown>[] {
    const outers = recordsOf({ value: current });
    const [first = {}, ...otherOuters] = outers;
    const [schedule = {}, ...otherSchedules] = recordsOf({ value: first['schedule'] });
    return [{ ...first, schedule: [{ ...schedule, value_with_tax: amount }, ...otherSchedules] }, ...otherOuters];
}

function recordsOf({ value }: { value: unknown }): Record<string, unknown>[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const listingPatches = { fulfillmentAvailability, purchasableOffer };

// "DEFAULT" is Amazon's code for merchant-fulfilled stock; FBA channels (AMAZON_NA, ...) are
// owned by the fulfilment centres and can't be set through Listings Items.
export const MFN_CHANNEL_CODE = 'DEFAULT';

type FulfillmentParams = {
    current: unknown;
    marketplaceId: string;
    quantity: number;
    handlingTime?: number;
};

type OfferParams = {
    current: unknown;
    marketplaceId: string;
    currency: string;
    price: number;
    minimumPrice?: number;
    maximumPrice?: number;
};
