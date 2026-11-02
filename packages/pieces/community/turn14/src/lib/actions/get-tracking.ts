import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Orders } from '../common/orders';

export const getTracking = createAction({
    auth: turn14Auth,
    name: 'get_tracking',
    displayName: 'Get Tracking',
    description: 'List shipments (tracking number, carrier service, Turn14 order/invoice and your PO number) shipped in a date range. Leave dates empty for the last 3 days.',
    props: {
        startDate: Property.ShortText({
            displayName: 'Start Date',
            description: 'YYYY-MM-DD. Defaults to 3 days ago.',
            required: false,
        }),
        endDate: Property.ShortText({
            displayName: 'End Date',
            description: 'YYYY-MM-DD. Defaults to today. Ranges longer than 3 days are read in 3-day slices (max 31 days).',
            required: false,
        }),
        purchaseOrderNumber: Property.ShortText({
            displayName: 'PO Number',
            description: 'Optional: only shipments for this purchase order number.',
            required: false,
        }),
    },
    async run(context) {
        const now = Date.now();
        const endDate = context.propsValue.endDate?.trim() || turn14Orders.isoDate({ epochMs: now });
        const startDate = context.propsValue.startDate?.trim() || turn14Orders.isoDate({ epochMs: Date.parse(`${endDate}T00:00:00Z`) - 3 * turn14Orders.DAY_MS });
        const po = context.propsValue.purchaseOrderNumber?.trim();
        const tracking = await turn14Orders.getTracking({ auth: turn14AuthProps(context.auth), startDate, endDate });
        return tracking
            .map((entry) => turn14Orders.flattenTracking({ tracking: entry }))
            .filter((entry) => !po || entry['purchase_order_number'] === po);
    },
});
