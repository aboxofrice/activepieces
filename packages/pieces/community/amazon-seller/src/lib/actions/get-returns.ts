import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { spApiDocuments } from '../common/documents';
import { amazonProps } from '../common/props';

// Declared before createAction, which reads it while the module is still evaluating.
const RETURN_REPORTS = [
    { label: 'Merchant-fulfilled returns (by return date)', value: 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE' },
    { label: 'FBA customer returns', value: 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA' },
];

export const getReturns = createAction({
    auth: amazonSellerAuth,
    name: 'get_returns',
    displayName: 'Get Returns',
    description: 'Request an Amazon returns report for a date range, wait for it, and return one row per return (order ID, SKU, quantity, reason, status...). Reports take from seconds to a few minutes.',
    props: {
        reportType: Property.StaticDropdown({
            displayName: 'Returns',
            required: true,
            defaultValue: 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE',
            options: { options: RETURN_REPORTS },
        }),
        startDate: Property.DateTime({
            displayName: 'From',
            description: 'Defaults to 30 days ago.',
            required: false,
        }),
        endDate: Property.DateTime({
            displayName: 'To',
            description: 'Defaults to now.',
            required: false,
        }),
        reportId: Property.ShortText({
            displayName: 'Existing Report ID',
            description: 'Optional. Download a report requested earlier (e.g. one that timed out) instead of requesting a new one.',
            required: false,
        }),
        waitSeconds: Property.Number({
            displayName: 'Wait Up To (seconds)',
            required: false,
            defaultValue: 300,
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const { reportType, startDate, endDate, waitSeconds } = context.propsValue;
        const reportId = context.propsValue.reportId?.trim() || await spApiDocuments.createReport({
            auth,
            reportType,
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
            dataStartTime: new Date(startDate ?? Date.now() - DEFAULT_RANGE_MS).toISOString(),
            dataEndTime: endDate ? new Date(endDate).toISOString() : undefined,
        });
        const report = await spApiDocuments.waitForReport({ auth, reportId, timeoutMs: (waitSeconds ?? 300) * 1000 });
        if (report.processingStatus === 'CANCELLED') {
            // Amazon cancels a report that would be empty rather than producing an empty file.
            return { report_id: reportId, status: report.processingStatus, count: 0, returns: [] };
        }
        if (report.processingStatus !== 'DONE' || !report.reportDocumentId) {
            throw new Error(`Report ${reportId} ended with status ${report.processingStatus}.`);
        }
        const rows = spApiDocuments.parseTsv({ text: await spApiDocuments.downloadReport({ auth, reportDocumentId: report.reportDocumentId }) });
        return { report_id: reportId, status: report.processingStatus, count: rows.length, returns: rows };
    },
});

const DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;
