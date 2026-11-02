import { createAction, Property } from '@activepieces/pieces-framework';
import { symxchangeAuth } from '../auth';
import { symxClient } from '../common/client';

export const withdrawFunds = createAction({
    auth: symxchangeAuth,
    name: 'withdraw_funds',
    displayName: 'Withdraw Funds',
    description: 'Withdraw money from a share (Transactions service).',
    props: {
        accountNumber: Property.ShortText({
            displayName: 'Account Number',
            required: true,
        }),
        shareId: Property.ShortText({
            displayName: 'Share ID',
            description: 'The share ID within the account, e.g. 0000.',
            required: true,
        }),
        amount: Property.Number({
            displayName: 'Amount',
            required: true,
        }),
        checkNumber: Property.ShortText({
            displayName: 'Check Number',
            description: 'Set when the withdrawal is disbursed by check.',
            required: false,
        }),
        comment: Property.ShortText({
            displayName: 'Comment',
            description: 'Transaction description shown on the member record.',
            required: false,
        }),
    },
    async run(context) {
        const { accountNumber, shareId, amount, checkNumber, comment } = context.propsValue;
        const innerXml = symxClient.buildCredentialsXml({ auth: context.auth.props })
            + symxClient.buildDeviceXml({ auth: context.auth.props })
            + symxClient.tag({ name: 'AccountNumber', value: accountNumber })
            + symxClient.dtoTag({ name: 'ShareId', value: shareId })
            + `<WithdrawalAmounts>${symxClient.dtoTag({ name: 'TotalAmount', value: amount })}</WithdrawalAmounts>`
            + symxClient.dtoTag({ name: 'CheckNumber', value: checkNumber })
            + symxClient.dtoTag({ name: 'Comment', value: comment });
        const response = await symxClient.call({
            auth: context.auth.props,
            service: 'transactions',
            operation: 'withdraw',
            innerXml,
        });
        return {
            result: symxClient.unwrapResponse({ response }),
            raw: response,
        };
    },
});
