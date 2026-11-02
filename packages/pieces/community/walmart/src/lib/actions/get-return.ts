import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartReturns } from '../common/returns';

export const getReturn = createAction({
    auth: walmartAuth,
    name: 'get_return',
    displayName: 'Get Return',
    description: 'Get one Walmart customer return by its return order ID (RMA).',
    props: {
        returnOrderId: Property.ShortText({
            displayName: 'Return Order ID',
            required: true,
        }),
    },
    async run(context) {
        const returnOrderId = context.propsValue.returnOrderId.trim();
        const [found] = await walmartReturns.listReturns({
            auth: walmartAuthProps(context.auth),
            filters: { returnOrderId },
            maxReturns: 1,
        });
        if (!found) {
            throw new Error(`Walmart has no return with ID ${returnOrderId}.`);
        }
        return found;
    },
});
