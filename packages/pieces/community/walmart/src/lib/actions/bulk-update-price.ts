import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { MAX_FEED_ITEMS, PriceUpdate, walmartPrices } from '../common/prices';

export const bulkUpdatePrice = createAction({
    auth: walmartAuth,
    name: 'bulk_update_price',
    displayName: 'Bulk Update Price',
    description: 'Set prices for many SKUs in one price feed. Walmart processes it in the background; use Get Feed Status with the returned feed ID.',
    props: {
        items: Property.Array({
            displayName: 'Items',
            description: 'One row per SKU. You can also map a list of { sku, price } objects from an earlier step.',
            required: true,
            properties: {
                sku: Property.ShortText({ displayName: 'SKU', required: true }),
                price: Property.Number({ displayName: 'Price', required: true }),
            },
        }),
        currency: Property.ShortText({
            displayName: 'Currency',
            required: false,
            defaultValue: 'USD',
        }),
    },
    async run(context) {
        const parsed = context.propsValue.items.map(parseItem);
        const valid = parsed.filter((item): item is PriceUpdate => item !== null);
        const invalid = parsed.length - valid.length;
        if (invalid > 0 || valid.length === 0) {
            throw new Error(`${invalid} item(s) are missing a SKU or have a price that is not greater than 0.`);
        }
        if (valid.length > MAX_FEED_ITEMS) {
            throw new Error(`Walmart accepts at most ${MAX_FEED_ITEMS} items per feed; split the list.`);
        }
        return walmartPrices.submitPriceFeed({
            auth: walmartAuthProps(context.auth),
            items: valid,
            currency: context.propsValue.currency?.trim() || 'USD',
        });
    },
});

function parseItem(value: unknown): PriceUpdate | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const sku = 'sku' in value && typeof value.sku === 'string' ? value.sku.trim() : '';
    const price = 'price' in value ? Number(value.price) : NaN;
    return sku && Number.isFinite(price) && price > 0 ? { sku, price: Math.round(price * 100) / 100 } : null;
}
