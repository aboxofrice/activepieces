import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartJson } from '../common/json';
import { RETURN_STATUSES, walmartReturns } from '../common/returns';

const MAX_RETURN_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export const listReturns = createAction({
    auth: walmartAuth,
    name: 'list_returns',
    displayName: 'List Returns',
    description: 'List Walmart customer returns, optionally filtered by date, status or order.',
    props: {
        returnCreationStartDate: Property.DateTime({
            displayName: 'Created After',
            required: false,
        }),
        returnCreationEndDate: Property.DateTime({
            displayName: 'Created Before',
            required: false,
        }),
        status: Property.StaticDropdown({
            displayName: 'Status',
            required: false,
            options: { disabled: false, options: RETURN_STATUSES.map((status) => ({ label: status, value: status })) },
        }),
        customerOrderId: Property.ShortText({
            displayName: 'Customer Order ID',
            required: false,
        }),
        maxReturns: Property.Number({
            displayName: 'Maximum Returns',
            required: false,
            defaultValue: 100,
        }),
    },
    async run(context) {
        const { returnCreationStartDate, returnCreationEndDate, status, customerOrderId, maxReturns } = context.propsValue;
        // Walmart rejects a date range with only one end, so an open end means "until now".
        const start = walmartJson.toIso({ value: returnCreationStartDate });
        const end = walmartJson.toIso({ value: returnCreationEndDate }) ?? (start ? new Date().toISOString() : undefined);
        return walmartReturns.listReturns({
            auth: walmartAuthProps(context.auth),
            filters: {
                returnCreationStartDate: start ?? (end ? new Date(Date.parse(end) - MAX_RETURN_AGE_MS).toISOString() : undefined),
                returnCreationEndDate: end,
                status: status ?? undefined,
                customerOrderId: customerOrderId?.trim() || undefined,
            },
            maxReturns: Math.max(1, maxReturns ?? 100),
        });
    },
});
