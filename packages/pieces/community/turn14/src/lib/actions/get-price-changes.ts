import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Pricing } from '../common/pricing';

export const getPriceChanges = createAction({
    auth: turn14Auth,
    name: 'get_price_changes',
    displayName: 'Get Price Changes',
    description: 'List the Turn14 item IDs whose pricing changed in a date range (Turn14 returns IDs only; use Get Pricing for the new prices). Busy days can have 10,000+ changes.',
    props: {
        startDate: Property.ShortText({
            displayName: 'Start Date',
            description: 'YYYY-MM-DD.',
            required: true,
        }),
        endDate: Property.ShortText({
            displayName: 'End Date',
            description: 'YYYY-MM-DD. Leave empty for "through today".',
            required: false,
        }),
        maxPages: Property.Number({
            displayName: 'Max Pages',
            description: 'Each page is up to 1,000 item IDs.',
            required: true,
            defaultValue: 20,
        }),
    },
    async run(context) {
        const { startDate, endDate, maxPages } = context.propsValue;
        const dates = [startDate, endDate].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        if (dates.some((date) => !DATE_PATTERN.test(date.trim()))) {
            throw new Error('Dates must be in YYYY-MM-DD format.');
        }
        const result = await turn14Pricing.getPriceChanges({
            auth: turn14AuthProps(context.auth),
            startDate: startDate.trim(),
            endDate: endDate?.trim() || undefined,
            maxPages: Math.max(1, Math.floor(maxPages ?? 20)),
        });
        return {
            changed_count: result.itemIds.length,
            item_ids: result.itemIds,
            pages_read: result.pagesRead,
            total_pages: result.totalPages,
            complete: result.pagesRead >= result.totalPages,
        };
    },
});

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
