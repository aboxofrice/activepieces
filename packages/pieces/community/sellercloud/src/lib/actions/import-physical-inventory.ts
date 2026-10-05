import { sellercloudAuthProps } from '../auth';
import { createAction, Property } from '@activepieces/pieces-framework';
import { sellercloudAuth } from '../auth';
import { sellercloudClient } from '../common/client';
import { InventoryRow } from '../common/inventory';
import { sellercloudProps } from '../common/props';
import { WriteMode, importRunner } from '../common/run-import';

export const importPhysicalInventory = createAction({
    auth: sellercloudAuth,
    name: 'import_physical_inventory',
    displayName: 'Import Physical Inventory',
    description: 'Set physical inventory for a list of products in one warehouse, as one SellerCloud import job.',
    props: {
        warehouse: sellercloudProps.warehouse,
        items: Property.Json({
            displayName: 'Items',
            description: 'An array of { "productId": "...", "quantity": 0 } objects.',
            required: true,
            defaultValue: [{ productId: 'SKU-1', quantity: 0 }],
        }),
        writeMode: sellercloudProps.writeMode,
        adjustmentReason: sellercloudProps.adjustmentReason,
        verifyAfterWrite: sellercloudProps.verifyAfterWrite,
        trustLastWritten: sellercloudProps.trustLastWritten,
        zeroMissing: sellercloudProps.zeroMissing,
        inventoryDate: sellercloudProps.inventoryDate,
        waitForCompletion: sellercloudProps.waitForCompletion,
        timeoutSeconds: sellercloudProps.timeoutSeconds,
    },
    async run(context) {
        const props = context.propsValue;
        const rows = parseItems({ items: props.items });
        const auth = sellercloudAuthProps(context.auth);
        const token = await sellercloudClient.getToken({ auth, store: context.store });
        return importRunner.runImport({
            auth,
            token,
            store: context.store,
            warehouseId: props.warehouse,
            writeMode: writeModeOf({ value: props.writeMode }),
            adjustmentReason: props.adjustmentReason,
            verifyAfterWrite: props.verifyAfterWrite,
            trustLastWritten: props.trustLastWritten,
            zeroMissing: props.zeroMissing,
            rows,
            inventoryDate: props.inventoryDate ? new Date(props.inventoryDate) : new Date(),
            waitForCompletion: props.waitForCompletion ?? true,
            timeoutSeconds: props.timeoutSeconds ?? 300,
        });
    },
});

function parseItems({ items }: { items: unknown }): InventoryRow[] {
    if (!Array.isArray(items)) {
        throw new Error('Items must be a JSON array of { productId, quantity } objects.');
    }
    return items.map((item, index) => {
        const productId = isRecord(item) ? String(item['productId'] ?? '').trim() : '';
        const quantity = isRecord(item) ? Number(item['quantity']) : NaN;
        if (productId === '' || !Number.isInteger(quantity) || quantity < 0) {
            throw new Error(`Item ${index} needs a productId and a whole, non-negative quantity: ${JSON.stringify(item)}`);
        }
        return { productId, quantity };
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function writeModeOf({ value }: { value: string }): WriteMode {
    return value === 'ADD' || value === 'SET_LISTED' ? value : 'REPLACE_WAREHOUSE';
}
