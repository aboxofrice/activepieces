import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartPrices } from '../common/prices';

export const updatePrice = createAction({
    auth: walmartAuth,
    name: 'update_price',
    displayName: 'Update Price',
    description: 'Set the selling price of one SKU on Walmart. Takes up to 5 minutes to show on Walmart.com.',
    props: {
        sku: Property.ShortText({
            displayName: 'SKU',
            required: true,
        }),
        price: Property.Number({
            displayName: 'Price',
            description: 'The new selling price, e.g. 49.99.',
            required: true,
        }),
        currency: Property.ShortText({
            displayName: 'Currency',
            required: false,
            defaultValue: 'USD',
        }),
    },
    async run(context) {
        const { sku, price, currency } = context.propsValue;
        if (!Number.isFinite(price) || price <= 0) {
            throw new Error('Price must be greater than 0.');
        }
        return walmartPrices.updatePrice({
            auth: walmartAuthProps(context.auth),
            sku: sku.trim(),
            price: Math.round(price * 100) / 100,
            currency: currency?.trim() || 'USD',
        });
    },
});
