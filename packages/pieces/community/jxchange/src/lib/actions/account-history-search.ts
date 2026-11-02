import { createAction, Property } from '@activepieces/pieces-framework';
import { jxchangeAuth } from '../auth';
import { jxClient } from '../common/client';
import { jxProps } from '../common/props';

export const accountHistorySearch = createAction({
    auth: jxchangeAuth,
    name: 'account_history_search',
    displayName: 'Search Account History',
    description: 'List transactions posted to an account, filterable by date and amount (AcctHistSrch).',
    props: {
        acctId: Property.ShortText({
            displayName: 'Account Number',
            required: true,
        }),
        acctType: jxProps.acctTypeText({ displayName: 'Account Type' }),
        startDate: Property.ShortText({
            displayName: 'Start Date',
            description: 'Earliest posting date to include, format YYYY-MM-DD.',
            required: false,
        }),
        endDate: Property.ShortText({
            displayName: 'End Date',
            description: 'Latest posting date to include, format YYYY-MM-DD.',
            required: false,
        }),
        lowAmount: Property.Number({
            displayName: 'Minimum Amount',
            required: false,
        }),
        highAmount: Property.Number({
            displayName: 'Maximum Amount',
            required: false,
        }),
        maxRecords: Property.Number({
            displayName: 'Max Records',
            required: false,
            defaultValue: 100,
        }),
    },
    async run(context) {
        const { acctId, acctType, startDate, endDate, lowAmount, highAmount, maxRecords } = context.propsValue;

        const innerXml = jxClient.buildSrchMsgRqHdr({ auth: context.auth.props, maxRec: maxRecords ?? 100 })
            + jxClient.buildAccountId({ name: 'InAcctId', acctId, acctType })
            + jxClient.tag({ name: 'StartDt', value: startDate })
            + jxClient.tag({ name: 'EndDt', value: endDate })
            + jxClient.tag({ name: 'LowAmt', value: lowAmount })
            + jxClient.tag({ name: 'HighAmt', value: highAmount });

        const response = await jxClient.call({
            auth: context.auth.props,
            service: 'Inquiry',
            operation: 'AcctHistSrch',
            innerXml,
        });

        const recArray = response['AcctHistSrchRecArray'] as Record<string, unknown> | undefined;
        return {
            transactions: jxClient.asArray({ value: recArray?.['AcctHistSrchRec'] }),
            raw: response,
        };
    },
});
