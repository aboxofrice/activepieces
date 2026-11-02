import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { InventoryUpdate, walmartInventory } from '../common/inventory';

export const bulkUpdateInventory = createAction({
    auth: walmartAuth,
    name: 'bulk_update_inventory',
    displayName: 'Bulk Update Inventory',
    description: 'Set quantities for many SKUs in one inventory feed. Walmart processes it in the background; use Get Feed Status with the returned feed ID.',
    props: {
        items: Property.Array({
            displayName: 'Items',
            description: 'One row per SKU. You can also map a list of { sku, quantity } objects from an earlier step.',
            required: true,
            properties: {
                sku: Property.ShortText({ displayName: 'SKU', required: true }),
                quantity: Property.Number({ displayName: 'Quantity', required: true }),
            },
        }),
    },
    async run(context) {
        const items = context.propsValue.items.map(parseItem);
        const invalid = items.filter((item) => item === null).length;
        const valid = items.filter((item): item is InventoryUpdate => item !== null);
        if (invalid > 0 || valid.length === 0) {
            throw new Error(`${invalid} item(s) are missing a SKU or have a quantity that is not a whole number of 0 or more.`);
        }
        return walmartInventory.submitInventoryFeed({ auth: walmartAuthProps(context.auth), items: valid });
    },
});

function parseItem(value: unknown): InventoryUpdate | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const sku = 'sku' in value && typeof value.sku === 'string' ? value.sku.trim() : '';
    const quantity = 'quantity' in value ? Number(value.quantity) : NaN;
    return sku && Number.isInteger(quantity) && quantity >= 0 ? { sku, quantity } : null;
}
