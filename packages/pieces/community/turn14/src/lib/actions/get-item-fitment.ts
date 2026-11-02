import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Inventory } from '../common/inventory';
import { turn14Items } from '../common/items';

export const getItemFitment = createAction({
    auth: turn14Auth,
    name: 'get_item_fitment',
    displayName: 'Get Item Fitment',
    description: 'Get the vehicle IDs a Turn14 item fits, exactly as Turn14 returns them. Turn14\'s API has no endpoint that translates these numeric vehicle IDs into year/make/model, and Turn14 does not document which vehicle table they come from; to decode them you need Turn14\'s vehicle reference data (ask apisupport@turn14.com).',
    props: {
        itemId: Property.ShortText({
            displayName: 'Turn14 Item ID',
            description: 'The numeric Turn14 item ID (e.g. 078595), shown as item_id by Search Items.',
            required: true,
        }),
    },
    async run(context) {
        const fitment = await turn14Items.getItemFitment({ auth: turn14AuthProps(context.auth), itemId: turn14Inventory.assertItemId({ value: context.propsValue.itemId }) });
        const vehicleIds = fitment.attributes?.vehicle_ids ?? [];
        return {
            item_id: fitment.id,
            vehicle_count: vehicleIds.length,
            vehicle_ids: vehicleIds,
            vehicle_ids_csv: vehicleIds.join(','),
            late_models_only: fitment.attributes?.late_models_only ?? null,
        };
    },
});
