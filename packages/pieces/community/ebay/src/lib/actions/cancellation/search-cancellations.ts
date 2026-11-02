import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { EbayCancellation, postOrderCommon } from '../../common/post-order';

export const searchCancellations = createAction({
    auth: ebayAuth,
    name: 'cancellation_search_cancellations',
    displayName: 'Cancellation · List Cancellations',
    description: 'List order cancellation requests (from buyers or you), filtered by date or order.',
    props: {
        from: Property.DateTime({ displayName: 'Requested After', required: false }),
        to: Property.DateTime({ displayName: 'Requested Before', required: false }),
        orderId: Property.ShortText({ displayName: 'Order ID', required: false }),
        limit: Property.Number({
            displayName: 'Limit',
            description: 'Cancellations per page (1–200).',
            required: false,
            defaultValue: 50,
        }),
        page: Property.Number({
            displayName: 'Page',
            description: 'Page number, starting at 1.',
            required: false,
            defaultValue: 1,
        }),
    },
    async run(context) {
        const { from, to, orderId, limit, page } = context.propsValue;
        const response = await postOrderCommon.request<{ cancellations?: EbayCancellation[]; total?: number; paginationOutput?: { totalEntries?: number } }>({
            auth: context.auth.props,
            method: HttpMethod.GET,
            path: '/cancellation/search',
            queryParams: {
                creation_date_range_from: postOrderCommon.toPostOrderDate({ value: from }),
                creation_date_range_to: postOrderCommon.toPostOrderDate({ value: to }),
                legacy_order_id: orderId?.trim(),
                limit: Math.min(Math.max(limit ?? 50, 1), 200),
                offset: Math.max(page ?? 1, 1),
            },
        });
        const cancellations = (response.cancellations ?? []).map((cancellation) => postOrderCommon.flattenCancellation({ cancellation }));
        return { total: response.paginationOutput?.totalEntries ?? response.total ?? cancellations.length, returned: cancellations.length, cancellations };
    },
});
