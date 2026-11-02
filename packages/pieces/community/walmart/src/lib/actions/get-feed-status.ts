import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartFeeds } from '../common/feeds';

export const getFeedStatus = createAction({
    auth: walmartAuth,
    name: 'get_feed_status',
    displayName: 'Get Feed Status',
    description: 'Check the processing status of a Walmart feed (for example a Bulk Update Inventory feed), with per-SKU results.',
    props: {
        feedId: Property.ShortText({
            displayName: 'Feed ID',
            description: 'The feed_id returned by Bulk Update Inventory.',
            required: true,
        }),
        includeDetails: Property.Checkbox({
            displayName: 'Include Per-SKU Results',
            required: false,
            defaultValue: true,
        }),
    },
    async run(context) {
        return walmartFeeds.getFeedStatus({
            auth: walmartAuthProps(context.auth),
            feedId: context.propsValue.feedId.trim(),
            includeDetails: context.propsValue.includeDetails ?? true,
        });
    },
});
