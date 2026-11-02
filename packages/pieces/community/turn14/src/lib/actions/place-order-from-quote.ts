import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Environment } from '../common/environment';
import { turn14Inventory } from '../common/inventory';
import { turn14Quotes } from '../common/quotes';

export const placeOrderFromQuote = createAction({
    auth: turn14Auth,
    name: 'place_order_from_quote',
    displayName: 'Place Order From Quote',
    description: 'Turn a Turn14 quote into an order using the chosen shipping option. In Production this buys the parts. Request shape is based on published Turn14 dealer integrations and has not been tested against a live account - try it with the Testing environment first. Not retried on errors: check Get Order / List Open Orders before re-running after a timeout.',
    props: {
        environment: turn14Environment.orderEnvironmentProperty(),
        quoteId: Property.ShortText({
            displayName: 'Quote ID',
            description: 'quote_id from Create Shipping Quote.',
            required: true,
        }),
        shippingIds: Property.Array({
            displayName: 'Shipping Quote IDs',
            description: 'One shipping_quote_id per shipment, from Create Shipping Quote (pick the option you want for each shipment).',
            required: true,
        }),
        poNumber: Property.ShortText({
            displayName: 'PO Number',
            description: 'Your order/PO reference - use the same one as the quote.',
            required: true,
        }),
        acknowledgeProp65: Property.Checkbox({ displayName: 'Acknowledge Prop 65', required: false, defaultValue: false }),
        acknowledgeEpa: Property.Checkbox({
            displayName: 'Acknowledge EPA',
            description: 'Required by Turn14 for emissions-related items.',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const auth = turn14AuthProps(context.auth);
        const p = context.propsValue;
        const shippingIds = turn14Inventory.parseIdList({ values: p.shippingIds }).map((id) => (/^\d+$/.test(id) ? Number(id) : id));
        if (shippingIds.length === 0) {
            throw new Error('Enter at least one shipping quote ID.');
        }
        const quoteId = p.quoteId.trim();
        const environment = turn14Environment.resolveEnvironment({ auth, requested: p.environment });
        const response = await turn14Quotes.placeOrderFromQuote({
            auth,
            order: {
                environment,
                quoteId: /^\d+$/.test(quoteId) ? Number(quoteId) : quoteId,
                poNumber: p.poNumber.trim(),
                acknowledgeProp65: p.acknowledgeProp65 === true,
                acknowledgeEpa: p.acknowledgeEpa === true,
                shippingIds,
            },
        });
        const data = response !== null && typeof response === 'object' && 'data' in response ? response.data : null;
        const orderId = data !== null && typeof data === 'object' && 'id' in data ? data.id : null;
        return { environment, order_id: orderId, raw: response };
    },
});
