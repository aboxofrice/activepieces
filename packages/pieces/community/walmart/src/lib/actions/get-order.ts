import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartOrders } from '../common/orders';

export const getOrder = createAction({
    auth: walmartAuth,
    name: 'get_order',
    displayName: 'Get Order',
    description: 'Get one Walmart order by its purchase order ID.',
    props: {
        purchaseOrderId: Property.ShortText({
            displayName: 'Purchase Order ID',
            description: 'The Walmart purchase order number (the "PO #" in Seller Center), e.g. from the New Order trigger.',
            required: true,
        }),
    },
    async run(context) {
        const order = await walmartOrders.getOrder({
            auth: walmartAuthProps(context.auth),
            purchaseOrderId: context.propsValue.purchaseOrderId.trim(),
        });
        return walmartOrders.flattenOrder({ order });
    },
});
