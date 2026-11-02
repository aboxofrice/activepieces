import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { inventoryCommon } from '../../common/inventory';

export const updateListingPrice = createAction({
    auth: ebayAuth,
    name: 'listing_update_price',
    displayName: 'Listing · Update Price',
    description: 'Set a fixed-price listing\'s (or variation\'s) price, optionally with its available quantity, via ReviseInventoryStatus. Returns eBay\'s errors and warnings.',
    props: {
        itemId: Property.ShortText({
            displayName: 'Item ID',
            description: 'The listing number. Required for a variation SKU, and for listings not tracked by SKU.',
            required: false,
        }),
        sku: Property.ShortText({
            displayName: 'SKU',
            description: 'The listing\'s Custom Label (SKU), or the variation\'s SKU for a multi-variation listing.',
            required: false,
        }),
        price: Property.Number({
            displayName: 'Price',
            description: 'New price in the listing\'s currency, e.g. 89.99.',
            required: true,
        }),
        quantity: Property.Number({
            displayName: 'Available Quantity',
            description: 'Optional: also set the available quantity in the same call.',
            required: false,
        }),
        failOnError: Property.Checkbox({
            displayName: 'Fail Step on eBay Errors',
            description: 'Untick to return eBay\'s result (updated=false with the errors) instead of failing the step. Known listing problems (no photo, P&A return policy) never fail the step.',
            required: false,
            defaultValue: true,
        }),
    },
    async run(context) {
        const { price, quantity, failOnError } = context.propsValue;
        const itemId = context.propsValue.itemId?.trim() || undefined;
        const sku = context.propsValue.sku?.trim() || undefined;
        if (!itemId && !sku) {
            throw new Error('Enter an Item ID, a SKU, or both.');
        }
        if (!Number.isFinite(price) || price <= 0) {
            throw new Error('Price must be greater than 0.');
        }
        if (quantity !== undefined && quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
            throw new Error('Available Quantity must be a whole number of 0 or more.');
        }
        const result = await inventoryCommon.updateListingPrice({
            auth: context.auth.props,
            itemId,
            sku,
            price,
            quantity: quantity ?? undefined,
        });
        if (result.ack === 'Failure' && failOnError !== false && !inventoryCommon.hasOnlyKnownListingIssues({ errors: result.errors })) {
            throw new Error(`eBay ReviseInventoryStatus failed: ${result.errors.map((error) => `${error.code} ${error.message ?? ''}`.trim()).join(' | ') || 'unknown error'}`);
        }
        return result;
    },
});
