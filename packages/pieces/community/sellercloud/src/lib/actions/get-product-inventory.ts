import { sellercloudAuthProps } from '../auth';
import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { sellercloudAuth } from '../auth';
import { sellercloudClient } from '../common/client';

export const getProductInventory = createAction({
    auth: sellercloudAuth,
    name: 'get_product_inventory',
    displayName: 'Get Product Inventory',
    description: 'Get physical and available quantity for a product in each warehouse.',
    props: {
        productId: Property.ShortText({
            displayName: 'Product ID (SKU)',
            required: true,
        }),
        onlyNonZero: Property.Checkbox({
            displayName: 'Only Warehouses With Stock',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const { productId, onlyNonZero } = context.propsValue;
        const auth = sellercloudAuthProps(context.auth);
        const token = await sellercloudClient.getToken({ auth, store: context.store });
        const [rows, warehouses] = await Promise.all([
            sellercloudClient.request<WarehouseInventory[]>({
                auth,
                token,
                method: HttpMethod.GET,
                path: '/Inventory/Warehouses',
                queryParams: { productID: productId },
            }),
            sellercloudClient.listWarehouses({ auth, token }),
        ]);
        const names = new Map(warehouses.map((w) => [w.ID, w.Name]));
        const inventory = rows
            .filter((row) => !onlyNonZero || row.PhysicalQty !== 0 || row.AvailableQty !== 0)
            .map((row) => ({
                warehouse_id: row.WarehouseID,
                warehouse_name: names.get(row.WarehouseID) ?? null,
                physical_qty: row.PhysicalQty,
                available_qty: row.AvailableQty,
            }));
        return { product_id: productId, inventory };
    },
});

type WarehouseInventory = {
    ProductID: string;
    WarehouseID: number;
    PhysicalQty: number;
    AvailableQty: number;
};
