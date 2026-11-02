import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Orders } from '../common/orders';

export const listInvoices = createAction({
    auth: turn14Auth,
    name: 'list_invoices',
    displayName: 'List Invoices',
    description: 'List your Turn14 invoices (newest first), with totals, amount due, tracking numbers and the Turn14 order each belongs to.',
    props: {
        sinceDate: Property.ShortText({
            displayName: 'Invoiced On or After',
            description: 'Optional YYYY-MM-DD filter.',
            required: false,
        }),
        unpaidOnly: Property.Checkbox({
            displayName: 'Unpaid Only',
            description: 'Only invoices with an amount due.',
            required: false,
            defaultValue: false,
        }),
        includeLines: Property.Checkbox({
            displayName: 'Include Line Items',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const since = context.propsValue.sinceDate?.trim();
        const { rows } = await turn14Orders.listInvoices({ auth: turn14AuthProps(context.auth), maxPages: MAX_PAGES });
        return rows
            .map((invoice) => turn14Orders.flattenInvoice({ invoice }))
            .filter((invoice) => !since || String(invoice['date'] ?? '') >= since)
            .filter((invoice) => !context.propsValue.unpaidOnly || Number(invoice['amount_due'] ?? 0) > 0)
            .sort((left, right) => String(right['date'] ?? '').localeCompare(String(left['date'] ?? '')))
            .map((invoice) => (context.propsValue.includeLines ? invoice : withoutLines({ record: invoice })));
    },
});

function withoutLines({ record }: { record: Record<string, unknown> }): Record<string, unknown> {
    return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'lines'));
}

const MAX_PAGES = 50;
