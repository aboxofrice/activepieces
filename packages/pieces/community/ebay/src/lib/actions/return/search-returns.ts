import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { EbayReturnSummary, postOrderCommon } from '../../common/post-order';

export const searchReturns = createAction({
    auth: ebayAuth,
    name: 'return_search_returns',
    displayName: 'Return · List Returns',
    description: 'List return requests (one row per return), filtered by date, state, order or listing.',
    props: {
        from: Property.DateTime({ displayName: 'Created After', required: false }),
        to: Property.DateTime({ displayName: 'Created Before', required: false }),
        returnState: Property.StaticDropdown({
            displayName: 'State',
            description: 'Leave empty for all returns.',
            required: false,
            options: {
                options: [
                    { label: 'Open (all open returns)', value: 'ALL_OPEN' },
                    { label: 'Needs my action', value: 'RETURN_STARTED' },
                    { label: 'Waiting for buyer', value: 'WAITING_FOR_RETURN_LABEL' },
                    { label: 'Item shipped back', value: 'ITEM_SHIPPED' },
                    { label: 'Item delivered back', value: 'ITEM_DELIVERED' },
                    { label: 'Escalated', value: 'ESCALATED' },
                    { label: 'Closed', value: 'CLOSED' },
                ],
            },
        }),
        orderId: Property.ShortText({ displayName: 'Order ID', required: false }),
        itemId: Property.ShortText({ displayName: 'Item ID', required: false }),
        limit: Property.Number({
            displayName: 'Limit',
            description: 'Returns per page (1–200).',
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
        const { from, to, returnState, orderId, itemId, limit, page } = context.propsValue;
        const response = await postOrderCommon.request<{ members?: EbayReturnSummary[]; total?: number }>({
            auth: context.auth.props,
            method: HttpMethod.GET,
            path: '/return/search',
            queryParams: {
                creation_date_range_from: postOrderCommon.toPostOrderDate({ value: from }),
                creation_date_range_to: postOrderCommon.toPostOrderDate({ value: to }),
                return_state: returnState,
                order_id: orderId?.trim(),
                item_id: itemId?.trim(),
                limit: Math.min(Math.max(limit ?? 50, 1), 200),
                offset: Math.max(page ?? 1, 1),
            },
        });
        const returns = (response.members ?? []).map((summary) => postOrderCommon.flattenReturn({ summary }));
        return { total: response.total ?? returns.length, returned: returns.length, returns };
    },
});
