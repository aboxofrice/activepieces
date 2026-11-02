import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { sellercloudAuth, sellercloudAuthProps } from '../auth';
import { sellercloudClient } from '../common/client';
import { sellercloudDropdowns } from '../common/dropdowns';
import { sellercloudListing } from '../common/listing';
import { SellercloudCatalogProduct, sellercloudRecords } from '../common/records';

export const getProductWithInventory = createAction({
    auth: sellercloudAuth,
    name: 'get_product_with_inventory',
    displayName: 'Get Product with Inventory by Warehouse',
    description: 'Get a product\'s details plus its physical and available quantity in each warehouse.',
    props: {
        sku: Property.ShortText({
            displayName: 'SKU',
            description: 'The SellerCloud product ID (SKU).',
            required: true,
        }),
        warehouses: sellercloudDropdowns.warehouses({ required: false, description: 'Only report these warehouses. Leave empty for all.' }),
        onlyWithStock: Property.Checkbox({
            displayName: 'Only Warehouses With Stock',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const { sku, warehouses, onlyWithStock } = context.propsValue;
        const productId = sku.trim();
        const auth = sellercloudAuthProps(context.auth);
        const token = await sellercloudClient.getToken({ auth, store: context.store });
        const { items } = await sellercloudListing.listPages<SellercloudCatalogProduct>({
            auth,
            token,
            path: '/Catalog',
            query: { 'model.sKU': productId },
            maxPages: 1,
        });
        const product = items.find((item) => item.ID.toLowerCase() === productId.toLowerCase());
        // /Inventory/Warehouses answers 500 (not 404) for an unknown product, so check first.
        if (!product) {
            throw new Error(`SellerCloud: no product with SKU "${productId}".`);
        }
        const rows = await sellercloudClient.request<WarehouseInventory[]>({
            auth,
            token,
            method: HttpMethod.GET,
            path: '/Inventory/Warehouses',
            queryParams: { productID: product.ID },
        });
        const allWarehouses = await sellercloudClient.listWarehouses({ auth, token });
        const names = new Map(allWarehouses.map((w) => [w.ID, w.Name]));
        const wanted = new Set((warehouses ?? []).map(Number));
        const inventory = rows
            .filter((row) => wanted.size === 0 || wanted.has(row.WarehouseID))
            .filter((row) => !onlyWithStock || row.PhysicalQty !== 0 || row.AvailableQty !== 0)
            .map((row) => ({
                warehouse_id: row.WarehouseID,
                warehouse_name: names.get(row.WarehouseID) ?? null,
                physical_qty: row.PhysicalQty,
                available_qty: row.AvailableQty,
            }))
            .sort((a, b) => b.physical_qty - a.physical_qty);
        return {
            ...sellercloudRecords.flattenProduct({ product }),
            total_physical_qty_listed: inventory.reduce((sum, row) => sum + row.physical_qty, 0),
            total_available_qty_listed: inventory.reduce((sum, row) => sum + row.available_qty, 0),
            warehouses_with_stock: inventory.filter((row) => row.physical_qty > 0).length,
            inventory,
        };
    },
});

type WarehouseInventory = {
    ProductID: string;
    WarehouseID: number;
    PhysicalQty: number;
    AvailableQty: number;
};
