import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Orders } from '../common/orders';

export const getInvoice = createAction({
    auth: turn14Auth,
    name: 'get_invoice',
    displayName: 'Get Invoice',
    description: 'Get one Turn14 invoice with its line items and tracking numbers.',
    props: {
        invoiceId: Property.ShortText({
            displayName: 'Invoice ID',
            description: 'The Turn14 invoice ID (invoice_id from List Invoices or New Invoice). The printed invoice number is not accepted by Turn14.',
            required: true,
        }),
    },
    async run(context) {
        const invoice = await turn14Orders.getInvoice({ auth: turn14AuthProps(context.auth), invoiceId: context.propsValue.invoiceId.trim() });
        return turn14Orders.flattenInvoice({ invoice });
    },
});
