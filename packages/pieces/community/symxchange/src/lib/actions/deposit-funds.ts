import { createAction, Property } from '@activepieces/pieces-framework';
import { symxchangeAuth } from '../auth';
import { symxClient } from '../common/client';

export const depositFunds = createAction({
    auth: symxchangeAuth,
    name: 'deposit_funds',
    displayName: 'Deposit Funds',
    description: 'Deposit money into a share (Transactions service).',
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
        comment: Property.ShortText({
            displayName: 'Comment',
            description: 'Transaction description shown on the member record.',
            required: false,
        }),
        effectiveDate: Property.DateTime({
            displayName: 'Effective Date',
            description: 'Post the deposit as of this date. Leave empty for today.',
            required: false,
        }),
    },
    async run(context) {
        const { accountNumber, shareId, amount, comment, effectiveDate } = context.propsValue;
        const innerXml = symxClient.buildCredentialsXml({ auth: context.auth.props })
            + symxClient.buildDeviceXml({ auth: context.auth.props })
            + symxClient.tag({ name: 'AccountNumber', value: accountNumber })
            + symxClient.dtoTag({ name: 'ShareId', value: shareId })
            + `<DepositAmounts>${symxClient.dtoTag({ name: 'TotalAmount', value: amount })}</DepositAmounts>`
            + symxClient.dtoTag({ name: 'Comment', value: comment })
            + symxClient.dtoTag({ name: 'EffectiveDate', value: effectiveDate ? effectiveDate.slice(0, 10) : undefined });
        const response = await symxClient.call({
            auth: context.auth.props,
            service: 'transactions',
            operation: 'deposit',
            innerXml,
        });
        return {
            result: symxClient.unwrapResponse({ response }),
            raw: response,
        };
    },
});
