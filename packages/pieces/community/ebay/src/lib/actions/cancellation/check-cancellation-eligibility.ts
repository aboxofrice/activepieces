import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { postOrderCommon } from '../../common/post-order';

export const checkCancellationEligibility = createAction({
    auth: ebayAuth,
    name: 'cancellation_check_eligibility',
    displayName: 'Cancellation · Check Eligibility',
    description: 'Check whether you can still cancel an order (read-only — nothing is cancelled).',
    props: {
        orderId: Property.ShortText({
            displayName: 'Order ID',
            description: 'The eBay order number, e.g. 12-34567-89012.',
            required: true,
        }),
    },
    async run(context) {
        const orderId = context.propsValue.orderId.trim();
        const response = await postOrderCommon.request<{ eligible?: boolean; eligibilityStatus?: string; failureReason?: string[]; itemEligibility?: unknown }>({
            auth: context.auth.props,
            method: HttpMethod.POST,
            path: '/cancellation/check_eligibility',
            body: { legacyOrderId: orderId },
        });
        return {
            order_id: orderId,
            eligible: response.eligible ?? false,
            eligibility_status: response.eligibilityStatus ?? null,
            failure_reasons: (response.failureReason ?? []).join(', '),
        };
    },
});
