import { createAction, Property } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Client } from '../common/client';
import { turn14Environment } from '../common/environment';
import { turn14Inventory } from '../common/inventory';
import { turn14OrderGuards } from '../common/order-guards';
import { turn14Orders } from '../common/orders';
import { turn14Quotes } from '../common/quotes';

export const placeOrderFromQuote = createAction({
    auth: turn14Auth,
    name: 'place_order_from_quote',
    displayName: 'Place Order From Quote',
    description: 'Turn a Turn14 quote into an order using the chosen shipping option. On a Production connection this buys the parts. Request shape is based on published Turn14 dealer integrations and has not been tested against a live account - try it on a Testing connection first. Never retried automatically; before sending it refuses a quote that was already ordered from this project and a PO number that already has an open order.',
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
        const environment = turn14Environment.resolveOrderEnvironment({ auth, requested: p.environment, confirmLiveOrder: p.confirmLiveOrder, requireLiveConfirmation: true });
        await turn14OrderGuards.assertSafeToOrder({
            store: context.store,
            auth,
            quoteId,
            poNumber,
            environment,
            refuseRepeatQuote: p.refuseRepeatQuote !== false,
            refuseOpenPo: p.refuseOpenPo !== false,
            listOpenOrders: async () => {
                const { rows, truncated } = await turn14Orders.listOrders({ auth, maxPages: MAX_OPEN_ORDER_PAGES });
                return { orders: rows, complete: !truncated };
            },
        });
        const at = new Date().toISOString();
        await turn14OrderGuards.recordAttempt({ store: context.store, auth, quoteId, attempt: { status: 'sending', at, poNumber, environment, orderId: null } });
        const { data: response, error } = await tryCatch(() => turn14Quotes.placeOrderFromQuote({
            auth,
            order: {
                environment,
                quoteId: /^\d+$/.test(quoteId) ? Number(quoteId) : quoteId,
                poNumber,
                acknowledgeProp65: p.acknowledgeProp65 === true,
                acknowledgeEpa: p.acknowledgeEpa === true,
                shippingIds,
            },
        }));
        if (error) {
            if (error instanceof turn14Client.Turn14OutcomeUnknownError) {
                await turn14OrderGuards.recordAttempt({ store: context.store, auth, quoteId, attempt: { status: 'unknown', at, poNumber, environment, orderId: null } });
                throw new Error(`${error.message} (PO "${poNumber}", quote ${quoteId})`);
            }
            // Turn14 answered and refused (or the request never left), so nothing was ordered.
            await turn14OrderGuards.clearAttempt({ store: context.store, auth, quoteId });
            throw error;
        }
        const orderId = orderIdOf({ response });
        await turn14OrderGuards.recordAttempt({ store: context.store, auth, quoteId, attempt: { status: 'placed', at, poNumber, environment, orderId } });
        turn14Environment.assertEchoedEnvironment({ response, expected: environment, what: `order for PO "${poNumber}"` });
        return {
            environment,
            order_id: orderId,
            po_number: poNumber,
            ...(response === null ? { note: `Turn14 accepted the request but sent no body. Check List Open Orders for PO "${poNumber}".` } : {}),
            raw: response,
        };
    },
});

function orderIdOf({ response }: { response: unknown }): string | null {
    const data = turn14Client.isRecord(response) ? response['data'] : null;
    const id = turn14Client.isRecord(data) ? data['id'] : null;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

const MAX_OPEN_ORDER_PAGES = 20;
