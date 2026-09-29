import { createAction } from '@activepieces/pieces-framework';
import { sellercloudAuth } from '../auth';
import { sellercloudClient } from '../common/client';

export const listWarehouses = createAction({
    auth: sellercloudAuth,
    name: 'list_warehouses',
    displayName: 'List Warehouses',
    description: 'List all warehouses with their IDs.',
    props: {},
    async run(context) {
        const warehouses = await sellercloudClient.listWarehouses({ auth: context.auth.props });
        return {
            total: warehouses.length,
            warehouses: warehouses.map((w) => ({
                id: w.ID,
                name: w.Name,
                is_default: w.IsDefault ?? false,
                warehouse_type: w.WarehouseType ?? null,
                is_sellable: w.IsSellAble ?? null,
            })),
        };
    },
});
