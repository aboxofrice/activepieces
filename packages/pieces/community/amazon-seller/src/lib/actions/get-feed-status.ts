import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { spApiDocuments } from '../common/documents';

export const getFeedStatus = createAction({
    auth: amazonSellerAuth,
    name: 'get_feed_status',
    displayName: 'Get Feed Status',
    description: 'Check a submitted feed (e.g. from Cancel Order): IN_QUEUE, IN_PROGRESS, DONE, FATAL or CANCELLED, plus the processing report when done.',
    props: {
        feedId: Property.ShortText({ displayName: 'Feed ID', required: true }),
        includeResult: Property.Checkbox({
            displayName: 'Include Processing Report',
            description: 'Downloads the result document (shows per-message errors) once the feed is DONE.',
            required: false,
            defaultValue: true,
        }),
    },
    async run(context) {
        return spApiDocuments.getFeed({
            auth: amazonSellerAuthProps(context.auth),
            feedId: context.propsValue.feedId,
            includeResult: context.propsValue.includeResult ?? true,
        });
    },
});
