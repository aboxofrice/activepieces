import { createAction } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Orders } from '../common/orders';

export const listOrders = createAction({
    auth: turn14Auth,
    name: 'list_orders',
    displayName: 'List Open Orders',
    description: 'List your open Turn14 orders. Turn14 only lists orders that are still open here; closed orders are reachable with Get Order (order IDs appear on invoices and tracking). truncated = true means more than 20 pages exist and the rest were not read.',
    props: {},
    async run(context) {
        const { rows, truncated } = await turn14Orders.listOrders({ auth: turn14AuthProps(context.auth), maxPages: MAX_PAGES });
        const orders = rows.map((order) => turn14Orders.flattenOrder({ order }));
        return { count: orders.length, truncated, orders };
    },
});

const MAX_PAGES = 20;
