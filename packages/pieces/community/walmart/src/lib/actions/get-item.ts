import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartItems } from '../common/items';

export const getItem = createAction({
    auth: walmartAuth,
    name: 'get_item',
    displayName: 'Get Item',
    description: 'Get one of your Walmart listings by SKU (or GTIN/UPC/Item ID): price, published status and unpublished reasons.',
    props: {
        id: Property.ShortText({
            displayName: 'SKU or ID',
            required: true,
        }),
        productIdType: Property.StaticDropdown({
            displayName: 'ID Type',
            required: true,
            defaultValue: 'SKU',
            options: {
                disabled: false,
                options: ['SKU', 'ITEM_ID', 'GTIN', 'UPC', 'EAN', 'ISBN'].map((type) => ({ label: type, value: type })),
            },
        }),
    },
    async run(context) {
        return walmartItems.getItem({
            auth: walmartAuthProps(context.auth),
            id: context.propsValue.id.trim(),
            productIdType: context.propsValue.productIdType,
        });
    },
});
