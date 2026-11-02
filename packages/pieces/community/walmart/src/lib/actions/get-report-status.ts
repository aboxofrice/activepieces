import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartReports } from '../common/reports';

export const getReportStatus = createAction({
    auth: walmartAuth,
    name: 'get_report_status',
    displayName: 'Get Report Status',
    description: 'Check a requested Walmart report; when READY, returns a temporary download URL for the CSV.',
    props: {
        requestId: Property.ShortText({
            displayName: 'Request ID',
            description: 'The request_id returned by Request Report.',
            required: true,
        }),
    },
    async run(context) {
        return walmartReports.getReportStatus({
            auth: walmartAuthProps(context.auth),
            requestId: context.propsValue.requestId.trim(),
        });
    },
});
