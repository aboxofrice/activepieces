import { createAction, Property } from '@activepieces/pieces-framework';
import { jxchangeAuth } from '../auth';
import { jxClient } from '../common/client';
import { jxProps } from '../common/props';

export const internalTransfer = createAction({
    auth: jxchangeAuth,
    name: 'internal_transfer',
    displayName: 'Add Internal Transfer',
    description: 'Move funds between two accounts on the core (XferAdd). This posts a real transaction.',
    props: {
        fromAcctId: Property.ShortText({
            displayName: 'From Account Number',
            required: true,
        }),
        fromAcctType: jxProps.acctTypeText({ displayName: 'From Account Type' }),
        toAcctId: Property.ShortText({
            displayName: 'To Account Number',
            required: true,
        }),
        toAcctType: jxProps.acctTypeText({ displayName: 'To Account Type' }),
        amount: Property.Number({
            displayName: 'Amount',
            description: 'Transfer amount in dollars, e.g. 125.50.',
            required: true,
        }),
        transferType: Property.ShortText({
            displayName: 'Transfer Type',
            description: 'Optional core transfer type code (XferType). Leave empty for the core default.',
            required: false,
        }),
    },
    async run(context) {
        const { fromAcctId, fromAcctType, toAcctId, toAcctType, amount, transferType } = context.propsValue;

        const innerXml = jxClient.buildMsgRqHdr({ auth: context.auth.props })
            + jxClient.buildAccountId({ name: 'AcctIdFrom', acctId: fromAcctId, acctType: fromAcctType })
            + jxClient.buildAccountId({ name: 'AcctIdTo', acctId: toAcctId, acctType: toAcctType })
            + `<XferRec>${jxClient.tag({ name: 'Amt', value: amount })}</XferRec>`
            + (transferType ? `<Ver_1/>${jxClient.tag({ name: 'XferType', value: transferType })}` : '');

        const response = await jxClient.call({
            auth: context.auth.props,
            service: 'Transaction',
            operation: 'XferAdd',
            innerXml,
        });

        return {
            transferKey: response['XferKey'] ?? null,
            status: response['RsStat'] ?? null,
            raw: response,
        };
    },
});
