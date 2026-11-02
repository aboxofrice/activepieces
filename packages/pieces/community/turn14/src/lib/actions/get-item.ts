import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Inventory } from '../common/inventory';
import { turn14Items } from '../common/items';

export const getItem = createAction({
    auth: turn14Auth,
    name: 'get_item',
    displayName: 'Get Item',
    description: 'Get one Turn14 item by its Turn14 item ID, optionally with images, documents and marketing descriptions.',
    props: {
        itemId: Property.ShortText({
            displayName: 'Turn14 Item ID',
            description: 'The numeric Turn14 item ID (e.g. 078595), shown as item_id by Search Items. Not the part number.',
            required: true,
        }),
        includeMedia: Property.Checkbox({
            displayName: 'Include Media & Descriptions',
            description: 'Also fetch image/document URLs and the long/short/marketing descriptions (one extra request).',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const auth = turn14AuthProps(context.auth);
        const itemId = turn14Inventory.assertItemId({ value: context.propsValue.itemId });
        const item = turn14Items.flattenItem({ item: await turn14Items.getItem({ auth, itemId }) });
        if (!context.propsValue.includeMedia) {
            return item;
        }
        const data = await turn14Items.getItemData({ auth, itemId });
        return { ...item, ...turn14Items.flattenItemData({ data }) };
    },
});
