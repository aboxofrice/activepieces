import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Client } from '../common/client';
import { turn14Environment } from '../common/environment';
import { turn14Props } from '../common/props';
import { turn14Quotes } from '../common/quotes';

export const createQuote = createAction({
    auth: turn14Auth,
    name: 'create_quote',
    displayName: 'Create Shipping Quote',
    description: 'Ask Turn14 for a drop-ship quote (shipping options and cost) for items going to a recipient. Returns the quote ID and shipping_quote_ids that Place Order From Quote needs. Request shape is based on published Turn14 dealer integrations and has not been tested against a live account - try it with the Testing environment first.',
    props: {
        environment: turn14Environment.orderEnvironmentProperty(),
        poNumber: Property.ShortText({
            displayName: 'PO Number',
            description: 'Your order/PO reference (e.g. the SellerCloud or marketplace order number).',
            required: true,
        }),
        items: Property.Array({
            displayName: 'Items',
            required: true,
            properties: {
                itemId: Property.ShortText({ displayName: 'Turn14 Item ID', required: true }),
                quantity: Property.Number({ displayName: 'Quantity', required: true, defaultValue: 1 }),
            },
        }),
        location: Property.ShortText({
            displayName: 'Ship From',
            description: '"default" lets Turn14 choose the warehouse(s).',
            required: true,
            defaultValue: 'default',
        }),
        combineInOutStock: Property.Checkbox({
            displayName: 'Combine In-Stock and Backordered Items',
            description: 'Ship everything together instead of sending in-stock items first.',
            required: false,
            defaultValue: true,
        }),
        shippingCode: turn14Props.shippingDropdown(),
        saturdayDelivery: Property.Checkbox({ displayName: 'Saturday Delivery', required: false, defaultValue: false }),
        signatureRequired: Property.Checkbox({ displayName: 'Signature Required', required: false, defaultValue: false }),
        acknowledgeProp65: Property.Checkbox({
            displayName: 'Acknowledge Prop 65',
            description: 'Required by Turn14 for items carrying a California Prop 65 warning.',
            required: false,
            defaultValue: false,
        }),
        recipientName: Property.ShortText({ displayName: 'Recipient Name', required: true }),
        address: Property.ShortText({ displayName: 'Address Line 1', required: true }),
        address2: Property.ShortText({ displayName: 'Address Line 2', required: false }),
        city: Property.ShortText({ displayName: 'City', required: true }),
        state: Property.ShortText({ displayName: 'State', description: 'Two-letter code, e.g. PA.', required: true }),
        zip: Property.ShortText({ displayName: 'ZIP / Postal Code', required: true }),
        country: Property.ShortText({ displayName: 'Country', description: 'Two-letter code.', required: true, defaultValue: 'US' }),
        phone: Property.ShortText({ displayName: 'Phone', required: true }),
        isShopAddress: Property.Checkbox({
            displayName: 'Ship to My Shop',
            description: 'Check when the recipient is your own business address rather than a customer (drop-ship).',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const auth = turn14AuthProps(context.auth);
        const p = context.propsValue;
        const items = (p.items ?? []).map((entry) => {
            const row: Record<string, unknown> = turn14Client.isRecord(entry) ? entry : {};
            return { itemId: String(row['itemId'] ?? '').trim(), quantity: Number(row['quantity'] ?? 0) };
        });
        if (items.length === 0 || items.some((item) => item.itemId.length === 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
            throw new Error('Every item needs a Turn14 item ID and a whole-number quantity of at least 1.');
        }
        const environment = turn14Environment.resolveEnvironment({ auth, requested: p.environment });
        const response = await turn14Quotes.createQuote({
            auth,
            quote: {
                environment,
                poNumber: p.poNumber.trim(),
                location: p.location?.trim() || 'default',
                combineInOutStock: p.combineInOutStock !== false,
                items,
                shippingCode: Number(p.shippingCode),
                saturdayDelivery: p.saturdayDelivery === true,
                signatureRequired: p.signatureRequired === true,
                acknowledgeProp65: p.acknowledgeProp65 === true,
                recipient: {
                    name: p.recipientName.trim(),
                    address: p.address.trim(),
                    address2: p.address2?.trim(),
                    city: p.city.trim(),
                    state: p.state.trim(),
                    country: p.country.trim(),
                    zip: p.zip.trim(),
                    phone: p.phone.trim(),
                    isShopAddress: p.isShopAddress === true,
                },
            },
        });
        return { environment, ...turn14Quotes.summarizeQuote({ response }) };
    },
});
