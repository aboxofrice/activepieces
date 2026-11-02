import { createAction, Property } from '@activepieces/pieces-framework';
import { jxchangeAuth } from '../auth';
import { jxClient } from '../common/client';

export const customerInquiry = createAction({
    auth: jxchangeAuth,
    name: 'customer_inquiry',
    displayName: 'Get Customer',
    description: 'Fetch the full core record for one customer (CustInq).',
    props: {
        custId: Property.ShortText({
            displayName: 'Customer ID',
            description: 'The core customer ID — use Search Customers to find it by name.',
            required: true,
        }),
    },
    async run(context) {
        const innerXml = jxClient.buildMsgRqHdr({ auth: context.auth.props })
            + jxClient.tag({ name: 'CustId', value: context.propsValue.custId });

        const response = await jxClient.call({
            auth: context.auth.props,
            service: 'Customer',
            operation: 'CustInq',
            innerXml,
        });

        return {
            customer: response['CustRec'] ?? null,
            raw: response,
        };
    },
});
