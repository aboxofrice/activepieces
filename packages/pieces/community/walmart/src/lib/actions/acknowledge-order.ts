import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartClient } from '../common/client';
import { walmartOrders } from '../common/orders';

export const acknowledgeOrder = createAction({
    auth: walmartAuth,
    name: 'acknowledge_order',
    displayName: 'Acknowledge Order',
    description: 'Acknowledge a Walmart order (all its lines), telling Walmart you will fulfil it. Required before shipping.',
    props: {
        purchaseOrderId: Property.ShortText({
            displayName: 'Purchase Order ID',
            required: true,
        }),
    },
    async run(context) {
        const auth = walmartAuthProps(context.auth);
        const purchaseOrderId = context.propsValue.purchaseOrderId.trim();
        const response = await walmartClient.request<unknown>({
            auth,
            method: HttpMethod.POST,
            path: `/v3/orders/${encodeURIComponent(purchaseOrderId)}/acknowledge`,
        });
        const order = walmartClient.isRecord(response) && walmartClient.isRecord(response['order']) ? response['order'] : null;
        return order ? walmartOrders.flattenOrder({ order }) : { purchase_order_id: purchaseOrderId, acknowledged: true };
    },
});
