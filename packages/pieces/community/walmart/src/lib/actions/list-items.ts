import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartItems } from '../common/items';

export const listItems = createAction({
    auth: walmartAuth,
    name: 'list_items',
    displayName: 'List Items',
    description: 'List your Walmart listings with price, published status and the reasons any item is unpublished.',
    props: {
        publishedStatus: Property.StaticDropdown({
            displayName: 'Published Status',
            description: 'Choose Unpublished to find listings that need fixing.',
            required: false,
            options: {
                disabled: false,
                options: [
                    { label: 'Published', value: 'PUBLISHED' },
                    { label: 'Unpublished', value: 'UNPUBLISHED' },
                ],
            },
        }),
        lifecycleStatus: Property.StaticDropdown({
            displayName: 'Lifecycle Status',
            required: false,
            defaultValue: 'ACTIVE',
            options: {
                disabled: false,
                options: [
                    { label: 'Active', value: 'ACTIVE' },
                    { label: 'Archived', value: 'ARCHIVED' },
                    { label: 'Retired', value: 'RETIRED' },
                ],
            },
        }),
        maxItems: Property.Number({
            displayName: 'Maximum Items',
            required: false,
            defaultValue: 200,
        }),
    },
    async run(context) {
        const { publishedStatus, lifecycleStatus, maxItems } = context.propsValue;
        return walmartItems.listItems({
            auth: walmartAuthProps(context.auth),
            filters: { publishedStatus: publishedStatus ?? undefined, lifecycleStatus: lifecycleStatus ?? undefined },
            maxItems: Math.max(1, maxItems ?? 200),
        });
    },
});
