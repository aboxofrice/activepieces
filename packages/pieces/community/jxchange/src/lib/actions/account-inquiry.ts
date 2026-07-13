import { createAction, Property } from '@activepieces/pieces-framework';
import { jxchangeAuth } from '../auth';
import { jxClient } from '../common/client';
import { jxProps } from '../common/props';

export const accountInquiry = createAction({
    auth: jxchangeAuth,
    name: 'account_inquiry',
    displayName: 'Get Account',
    description: 'Fetch account details and balances (AcctInq).',
    props: {
        acctId: Property.ShortText({
            displayName: 'Account Number',
            required: true,
        }),
        acctType: jxProps.acctTypeText({ displayName: 'Account Type' }),
    },
    async run(context) {
        const innerXml = jxClient.buildMsgRqHdr({ auth: context.auth.props })
            + jxClient.buildAccountId({
                name: 'InAcctId',
                acctId: context.propsValue.acctId,
                acctType: context.propsValue.acctType,
            });

        const response = await jxClient.call({
            auth: context.auth.props,
            service: 'Inquiry',
            operation: 'AcctInq',
            innerXml,
        });
        return response;
    },
});
