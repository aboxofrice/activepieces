import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { inventoryCommon } from '../../common/inventory';

export const getListingQuantity = createAction({
    auth: ebayAuth,
    name: 'inventory_get_listing_quantity',
    displayName: 'Inventory · Get Listing Quantity',
    description: 'Get a listing\'s listed, sold and available quantity (and each variation\'s) by Item ID and/or SKU.',
    props: {
        itemId: Property.ShortText({
            displayName: 'Item ID',
            description: 'The listing number (in the listing URL). Recommended — looking up by SKU alone only works for listings tracked by SKU.',
            required: false,
        }),
        sku: Property.ShortText({
            displayName: 'SKU',
            description: 'The listing\'s Custom Label (SKU), or a variation\'s SKU. With an Item ID, it picks out the matching variation.',
            required: false,
        }),
    },
    async run(context) {
        const itemId = context.propsValue.itemId?.trim() || undefined;
        const sku = context.propsValue.sku?.trim() || undefined;
        if (!itemId && !sku) {
            throw new Error('Enter an Item ID, a SKU, or both.');
        }
        return inventoryCommon.getListingQuantity({ auth: context.auth.props, itemId, sku });
    },
});
