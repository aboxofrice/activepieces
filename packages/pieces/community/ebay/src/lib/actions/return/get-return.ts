import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { EbayReturnSummary, postOrderCommon } from '../../common/post-order';

export const getReturn = createAction({
    auth: ebayAuth,
    name: 'return_get_return',
    displayName: 'Return · Get Return',
    description: 'Get one return request by its return ID, with the full detail eBay holds (tracking, refund, history) under `detail`.',
    props: {
        returnId: Property.ShortText({
            displayName: 'Return ID',
            description: 'The return_id from List Returns.',
            required: true,
        }),
    },
    async run(context) {
        const response = await postOrderCommon.request<{ summary?: EbayReturnSummary; detail?: unknown }>({
            auth: context.auth.props,
            method: HttpMethod.GET,
            path: `/return/${encodeURIComponent(context.propsValue.returnId.trim())}`,
        });
        return {
            ...postOrderCommon.flattenReturn({ summary: response.summary ?? {} }),
            detail: response.detail ?? null,
        };
    },
});
