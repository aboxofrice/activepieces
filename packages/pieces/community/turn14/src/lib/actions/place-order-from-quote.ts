import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Environment } from '../common/environment';
import { turn14Inventory } from '../common/inventory';
import { turn14PlaceOrder } from '../common/place-order';

export const placeOrderFromQuote = createAction({
    auth: turn14Auth,
    name: 'place_order_from_quote',
    displayName: 'Place Order From Quote',
    description: 'Turn a Turn14 quote into an order using the chosen shipping option. On a Production connection this buys the parts. Request shape is based on published Turn14 dealer integrations and has not been tested against a live account - try it on a Testing connection first. Never retried automatically; before sending it refuses a quote that was already ordered from this project and a PO number that already has an open order. Two runs started at the same moment for one quote are caught by a claim that is written first and re-checked after a short pause - this narrows that race but cannot fully eliminate it.',
    props: {
        environment: turn14Environment.orderEnvironmentProperty(),
        confirmLiveOrder: turn14Environment.confirmLiveOrderProperty(),
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
        refuseOpenPo: Property.Checkbox({
            displayName: 'Refuse if an Open Order Has This PO',
            description: 'Reads your open Turn14 orders first and refuses to order when one already carries this PO number. Turn14 only lists open orders, so an order that has already shipped and closed is not caught by this check.',
            required: false,
            defaultValue: true,
        }),
        refuseRepeatQuote: Property.Checkbox({
            displayName: 'Refuse a Second Order for This Quote',
            description: 'Each attempt is recorded (project-wide) before it is sent; a later attempt for the same quote is refused unless Turn14 clearly rejected the earlier one.',
            required: false,
            defaultValue: true,
        }),
        clearClaim: Property.ShortText({
            displayName: 'Stuck Claim Token to Clear',
            description: 'One-shot escape for an attempt whose outcome is unknown. First check the PO in Turn14 (List Open Orders / Get Order); if there is no order, paste the token shown in the error message. Only that exact claim is cleared, never one recorded as placed or one younger than 15 minutes, and only with "Refuse if an Open Order Has This PO" on.',
            required: false,
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
        const poNumber = p.poNumber.trim();
        if (quoteId.length === 0 || poNumber.length === 0) {
            throw new Error('Quote ID and PO Number are required.');
        }
        return turn14PlaceOrder.placeOrder({
            store: context.store,
            auth,
            input: {
                environment: p.environment,
                confirmLiveOrder: p.confirmLiveOrder === true,
                quoteId,
                poNumber,
                shippingIds,
                acknowledgeProp65: p.acknowledgeProp65 === true,
                acknowledgeEpa: p.acknowledgeEpa === true,
                refuseOpenPo: p.refuseOpenPo !== false,
                refuseRepeatQuote: p.refuseRepeatQuote !== false,
                clearClaim: p.clearClaim ?? undefined,
            },
        });
    },
});
