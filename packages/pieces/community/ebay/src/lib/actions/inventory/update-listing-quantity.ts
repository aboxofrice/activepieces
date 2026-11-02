import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { inventoryCommon } from '../../common/inventory';

export const updateListingQuantity = createAction({
    auth: ebayAuth,
    name: 'inventory_update_listing_quantity',
    displayName: 'Inventory · Update Listing Quantity',
    description: 'Set a listing\'s (or variation\'s) available quantity. Returns eBay\'s errors and warnings — known listing problems (no photo, P&A return policy, multi-variation quantity ignored) come back as updated=false instead of failing the step.',
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
        quantity: Property.Number({
            displayName: 'Available Quantity',
            description: 'The new quantity available to buy (eBay adds the already-sold count itself). 0 ends the listing unless "Out-of-stock control" is on for the account.',
            required: true,
        }),
        method: Property.StaticDropdown({
            displayName: 'eBay Call',
            description: 'ReviseInventoryStatus is lighter and handles variation SKUs directly. ReviseItem matches the legacy inventory sync.',
            required: true,
            defaultValue: 'ReviseInventoryStatus',
            options: {
                options: [
                    { label: 'ReviseInventoryStatus (recommended)', value: 'ReviseInventoryStatus' },
                    { label: 'ReviseItem', value: 'ReviseItem' },
                ],
            },
        }),
        isVariation: Property.Checkbox({
            displayName: 'SKU Is a Variation (ReviseItem only)',
            description: 'Tick when the SKU belongs to one variation of a multi-variation listing. ReviseInventoryStatus works this out itself.',
            required: false,
            defaultValue: false,
        }),
        failOnError: Property.Checkbox({
            displayName: 'Fail Step on Other eBay Errors',
            description: 'When eBay rejects the update for a reason other than the known listing problems, fail the step. Untick to always return the result.',
            required: false,
            defaultValue: true,
        }),
    },
    async run(context) {
        const { quantity, method, isVariation, failOnError } = context.propsValue;
        const itemId = context.propsValue.itemId?.trim() || undefined;
        const sku = context.propsValue.sku?.trim() || undefined;
        if (!itemId && !sku) {
            throw new Error('Enter an Item ID, a SKU, or both.');
        }
        if (!Number.isInteger(quantity) || quantity < 0) {
            throw new Error('Available Quantity must be a whole number of 0 or more.');
        }
        if (method === 'ReviseItem' && isVariation && (!itemId || !sku)) {
            throw new Error('Updating a variation with ReviseItem needs both the Item ID and the variation SKU.');
        }
        const result = await inventoryCommon.updateListingQuantity({
            auth: context.auth.props,
            itemId,
            sku,
            quantity,
            method: method === 'ReviseItem' ? 'ReviseItem' : 'ReviseInventoryStatus',
            isVariation: isVariation === true,
        });
        if (!inventoryCommon.isSuccess({ ack: result.ack }) && failOnError !== false && !inventoryCommon.hasOnlyKnownListingIssues({ errors: result.errors })) {
            throw new Error(`eBay ${result.call} failed: ${result.errors.map((error) => `${error.code} ${error.message ?? ''}`.trim()).join(' | ') || 'unknown error'}`);
        }
        return result;
    },
});
