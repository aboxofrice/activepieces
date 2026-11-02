import { createAction } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Props } from '../common/props';

export const listShippingMethods = createAction({
    auth: turn14Auth,
    name: 'list_shipping_methods',
    displayName: 'List Shipping Methods',
    description: 'List the carrier/service codes Turn14 accepts as shipping_code in quotes.',
    props: {},
    async run(context) {
        const methods = await turn14Props.listShippingMethods({ auth: turn14AuthProps(context.auth) });
        return methods.map((method) => ({
            shipping_code: Number(method.id),
            carrier_name: method.attributes?.carrier_name ?? null,
            service_name: method.attributes?.transportation_name ?? null,
        }));
    },
});
