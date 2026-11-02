import { createAction } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Inventory } from '../common/inventory';
import { turn14Pricing } from '../common/pricing';
import { turn14Props } from '../common/props';

export const getPricing = createAction({
    auth: turn14Auth,
    name: 'get_pricing',
    displayName: 'Get Pricing',
    description: 'Get your dealer cost (purchase_cost), MAP and retail/jobber price lists, and whether you can purchase each item. Turn14 prices one item per request (about 5 items/second).',
    props: {
        itemIds: turn14Props.itemIdsProperty({ required: true }),
    },
    async run(context) {
        const itemIds = turn14Inventory.parseIdList({ values: context.propsValue.itemIds });
        if (itemIds.length === 0) {
            throw new Error('Enter at least one Turn14 item ID.');
        }
        if (itemIds.length > MAX_ITEMS) {
            throw new Error(`Get Pricing takes at most ${MAX_ITEMS} items per run (Turn14 allows about 5 requests per second).`);
        }
        const results = await turn14Pricing.getPricing({ auth: turn14AuthProps(context.auth), itemIds });
        return { items: turn14Pricing.flattenPricing({ results }) };
    },
});

const MAX_ITEMS = 500;
