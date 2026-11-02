import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartReports } from '../common/reports';

export const requestReport = createAction({
    auth: walmartAuth,
    name: 'request_report',
    displayName: 'Request Report',
    description: 'Ask Walmart to generate an on-demand report (e.g. items missing ACES fitment coverage). Use Get Report Status to get the download link once ready.',
    props: {
        reportType: Property.StaticDropdown({
            displayName: 'Report',
            required: true,
            defaultValue: 'FITMENT_ACES_COVERAGE',
            options: {
                disabled: false,
                options: [
                    { label: 'Fitment: items missing ACES coverage', value: 'FITMENT_ACES_COVERAGE' },
                    { label: 'Fitment: items missing fitment attributes', value: 'FITMENT_MISSING_ATTR' },
                    { label: 'Item report (all listings)', value: 'ITEM' },
                    { label: 'Inventory', value: 'INVENTORY' },
                    { label: 'Listing quality', value: 'LISTING_QUALITY' },
                    { label: 'Buy box', value: 'BUYBOX' },
                    { label: 'Cancellations', value: 'CANCELLATION' },
                    { label: 'Return overrides', value: 'RETURN_OVERRIDES' },
                ],
            },
        }),
        reportVersion: Property.ShortText({
            displayName: 'Report Version',
            description: 'v1 for most reports. The Item report supports up to v6.',
            required: false,
            defaultValue: 'v1',
        }),
    },
    async run(context) {
        return walmartReports.requestReport({
            auth: walmartAuthProps(context.auth),
            reportType: context.propsValue.reportType,
            reportVersion: context.propsValue.reportVersion?.trim() || 'v1',
        });
    },
});
