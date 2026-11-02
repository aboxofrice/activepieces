import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartInventory } from '../common/inventory';

export const getInventory = createAction({
    auth: walmartAuth,
    name: 'get_inventory',
    displayName: 'Get Inventory',
    description: 'Get the available quantity of one SKU on Walmart.',
    props: {
        sku: Property.ShortText({
            displayName: 'SKU',
            description: 'Your seller SKU as listed on Walmart.',
            required: true,
        }),
        shipNode: Property.ShortText({
            displayName: 'Ship Node',
            description: 'Fulfillment center ID. Leave empty for your default ship node.',
            required: false,
        }),
    },
    async run(context) {
        return walmartInventory.getInventory({
            auth: walmartAuthProps(context.auth),
            sku: context.propsValue.sku.trim(),
            shipNode: context.propsValue.shipNode?.trim() || undefined,
        });
    },
});
