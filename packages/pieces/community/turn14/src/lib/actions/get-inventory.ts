import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Inventory } from '../common/inventory';
import { turn14Props } from '../common/props';

export const getInventory = createAction({
    auth: turn14Auth,
    name: 'get_inventory',
    displayName: 'Get Inventory',
    description: 'Get stock by Turn14 warehouse for one or more items, plus quantity on order, estimated availability (ETA) and manufacturer stock. Returns one row per item.',
    props: {
        itemIds: turn14Props.itemIdsProperty({ required: true }),
        locationIds: Property.Array({
            displayName: 'Only These Warehouses',
            description: 'Optional warehouse location IDs (e.g. 01, 02, 59 - see List Warehouses). Totals then only count these warehouses.',
            required: false,
        }),
    },
    async run(context) {
        const requested = turn14Inventory.parseIdList({ values: context.propsValue.itemIds });
        const itemIds = requested.filter((value) => turn14Inventory.isItemId({ value }));
        if (itemIds.length === 0) {
            throw new Error('Enter at least one Turn14 item ID. Item IDs are numeric (e.g. 078595); use Search Items to find the ID for a part number.');
        }
        const locationIds = turn14Inventory.parseIdList({ values: context.propsValue.locationIds });
        const rows = await turn14Inventory.getInventory({ auth: turn14AuthProps(context.auth), itemIds });
        const found = new Set(rows.map((row) => row.id));
        return {
            items: turn14Inventory.flattenInventory({ rows, locationIds }),
            not_found_item_ids: itemIds.filter((id) => !found.has(id)),
            invalid_item_ids: requested.filter((value) => !turn14Inventory.isItemId({ value })),
        };
    },
});
