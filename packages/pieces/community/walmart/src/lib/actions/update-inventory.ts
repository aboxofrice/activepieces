import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartInventory } from '../common/inventory';

export const updateInventory = createAction({
    auth: walmartAuth,
    name: 'update_inventory',
    displayName: 'Update Inventory',
    description: 'Set the available quantity of one SKU on Walmart (replaces the current quantity).',
    props: {
        sku: Property.ShortText({
            displayName: 'SKU',
            required: true,
        }),
        quantity: Property.Number({
            displayName: 'Quantity',
            description: 'The new available quantity (not a change). 0 takes the item out of stock.',
            required: true,
        }),
        shipNode: Property.ShortText({
            displayName: 'Ship Node',
            description: 'Fulfillment center ID. Leave empty for your default ship node.',
            required: false,
        }),
    },
    async run(context) {
        const { sku, quantity, shipNode } = context.propsValue;
        if (!Number.isInteger(quantity) || quantity < 0) {
            throw new Error('Quantity must be a whole number of 0 or more.');
        }
        return walmartInventory.updateInventory({
            auth: walmartAuthProps(context.auth),
            sku: sku.trim(),
            quantity,
            shipNode: shipNode?.trim() || undefined,
        });
    },
});
