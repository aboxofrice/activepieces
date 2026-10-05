import { sellercloudAuthProps } from '../auth';
import { createAction, Property } from '@activepieces/pieces-framework';
import { sellercloudAuth } from '../auth';
import { sellercloudClient } from '../common/client';
import { csvMapping } from '../common/csv-mapping';
import { sellercloudProps } from '../common/props';
import { WriteMode, importRunner } from '../common/run-import';
import { warehouseSnapshot } from '../common/warehouse-snapshot';

export const importInventoryFromCsv = createAction({
    auth: sellercloudAuth,
    name: 'import_inventory_from_csv',
    displayName: 'Import Inventory from CSV',
    description: 'Map a supplier CSV (part number + quantity) onto SellerCloud products and import it as physical inventory for one warehouse.',
    props: {
        warehouse: sellercloudProps.warehouse,
        file: Property.File({
            displayName: 'CSV File',
            required: true,
        }),
        partNumberColumn: Property.ShortText({
            displayName: 'Part Number Column',
            required: true,
            defaultValue: 'PART NUMBER',
        }),
        quantityColumn: Property.ShortText({
            displayName: 'Quantity Column',
            required: true,
            defaultValue: 'INV QTY',
        }),
        skuSuffix: Property.ShortText({
            displayName: 'SKU Suffix',
            description: 'Added to each part number to find the SellerCloud product, e.g. "-awp" turns 68227305AA into 68227305AA-awp. Leave empty to match part numbers as-is.',
            required: false,
            defaultValue: '-awp',
        }),
        matchWithoutSuffix: Property.Checkbox({
            displayName: 'Also Match Without Suffix',
            description: 'If PART-suffix is not a SellerCloud product, try the bare part number.',
            required: false,
            defaultValue: true,
        }),
        stripLeadingZeros: Property.Checkbox({
            displayName: 'Also Match Without Leading Zeros',
            description: 'For all-digit part numbers, also try 4884899 when the file says 04884899.',
            required: false,
            defaultValue: true,
        }),
        onlyProductIds: Property.Array({
            displayName: 'Only These Products',
            description: 'For testing: import only these SellerCloud product IDs from the file. Requires Partial.',
            required: false,
        }),
        writeMode: sellercloudProps.writeMode,
        adjustmentReason: sellercloudProps.adjustmentReason,
        verifyAfterWrite: sellercloudProps.verifyAfterWrite,
        trustLastWritten: sellercloudProps.trustLastWritten,
        zeroMissing: sellercloudProps.zeroMissing,
        inventoryDate: sellercloudProps.inventoryDate,
        dryRun: Property.Checkbox({
            displayName: 'Dry Run',
            description: 'Match the file and return what would be imported, without sending anything to SellerCloud.',
            required: false,
            defaultValue: false,
        }),
        waitForCompletion: sellercloudProps.waitForCompletion,
        timeoutSeconds: sellercloudProps.timeoutSeconds,
    },
    async run(context) {
        const props = context.propsValue;
        const onlyProductIds = (props.onlyProductIds ?? []).map((id) => String(id).trim()).filter((id) => id !== '');
        const writeMode = writeModeOf({ value: props.writeMode });
        if (writeMode === 'REPLACE_WAREHOUSE' && onlyProductIds.length > 0) {
            throw new Error('"Only These Products" can\'t be combined with replacing the warehouse: every product outside the subset would be set to 0. Use "Set only these products" instead.');
        }
        const auth = sellercloudAuthProps(context.auth);
        const token = await sellercloudClient.getToken({ auth, store: context.store });
        const warehouse = await importRunner.findWarehouse({ auth, token, warehouseId: props.warehouse });
        // `/Catalog` lists a fraction of the tenant's products, so matching against it dropped
        // most of the parts that exist. The warehouse snapshot carries the real universe and
        // this warehouse's current quantities in a single request.
        const snapshot = await warehouseSnapshot.fetchWarehouseSnapshot({
            auth,
            token,
            warehouseName: warehouse.Name,
            shadowSuffix: (props.skuSuffix ?? '').trim() || undefined,
        });
        const catalogIds = snapshot.productIds;
        const mapping = csvMapping.mapToCatalog({
            text: props.file.data.toString('utf8'),
            partNumberColumn: props.partNumberColumn,
            quantityColumn: props.quantityColumn,
            catalogIds,
            match: {
                suffix: (props.skuSuffix ?? '').trim(),
                matchWithoutSuffix: props.matchWithoutSuffix ?? true,
                stripLeadingZeros: props.stripLeadingZeros ?? true,
            },
            onlyProductIds,
        });
        const summary = {
            fileName: props.file.filename,
            catalogProducts: catalogIds.length,
            fileRows: mapping.fileRows,
            matchedRows: mapping.matchedRows,
            unmatchedRows: mapping.unmatchedRows,
            unmatchedSample: mapping.unmatchedSample,
            productsToImport: mapping.rows.length,
            missingFromFile: mapping.missingFromFile,
            writeMode,
        };
        if (props.dryRun) {
            return { ...summary, dryRun: true, warehouse, preview: mapping.rows.slice(0, 50) };
        }
        const outcome = await importRunner.runImport({
            auth,
            token,
            store: context.store,
            warehouseId: props.warehouse,
            writeMode,
            adjustmentReason: props.adjustmentReason,
            verifyAfterWrite: props.verifyAfterWrite,
            trustLastWritten: props.trustLastWritten,
            zeroMissing: props.zeroMissing,
            rows: mapping.rows,
            inventoryDate: props.inventoryDate ? new Date(props.inventoryDate) : new Date(),
            waitForCompletion: props.waitForCompletion ?? true,
            timeoutSeconds: props.timeoutSeconds ?? 300,
            snapshot,
            shadowSuffix: (props.skuSuffix ?? '').trim() || undefined,
        });
        return { ...summary, dryRun: false, ...outcome };
    },
});

function writeModeOf({ value }: { value: string }): WriteMode {
    return value === 'ADD' || value === 'SET_LISTED' ? value : 'REPLACE_WAREHOUSE';
}
