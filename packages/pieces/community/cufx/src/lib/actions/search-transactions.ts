import { createAction, Property } from '@activepieces/pieces-framework';
import { isNil, spreadIfDefined } from '@activepieces/shared';
import { cufxAuth } from '../auth';
import { cufxClient } from '../common/client';

export const searchTransactions = createAction({
    auth: cufxAuth,
    name: 'search_transactions',
    displayName: 'Search Transactions',
    description: 'Read transactions by account, posted date range, amount range, type, or description.',
    props: {
        accountIds: Property.Array({
            displayName: 'Account IDs',
            description: 'Return transactions for these accounts.',
            required: false,
        }),
        transactionType: Property.StaticDropdown({
            displayName: 'Transaction Type',
            required: false,
            options: {
                options: [
                    { label: 'Debit', value: 'Debit' },
                    { label: 'Credit', value: 'Credit' },
                ],
            },
        }),
        startDateTime: Property.DateTime({
            displayName: 'Posted After',
            description: 'Return transactions posted on or after this date/time (UTC).',
            required: false,
        }),
        endDateTime: Property.DateTime({
            displayName: 'Posted Before',
            description: 'Return transactions posted on or before this date/time (UTC).',
            required: false,
        }),
        minAmount: Property.Number({
            displayName: 'Minimum Amount',
            required: false,
        }),
        maxAmount: Property.Number({
            displayName: 'Maximum Amount',
            required: false,
        }),
        descriptionContains: Property.ShortText({
            displayName: 'Description Contains',
            description: 'Return transactions whose description contains this text.',
            required: false,
        }),
    },
    async run(context) {
        const { accountIds, transactionType, startDateTime, endDateTime, minAmount, maxAmount, descriptionContains } = context.propsValue;
        const dateRange = {
            ...spreadIfDefined('startDateTime', startDateTime),
            ...spreadIfDefined('endDateTime', endDateTime),
        };
        const transactionFilter = {
            ...spreadIfDefined('accountIdList', cufxClient.valueList({ key: 'accountId', values: accountIds })),
            ...spreadIfDefined('transactionType', transactionType),
            ...(Object.keys(dateRange).length > 0 ? { transactionPostedDateRange: dateRange } : {}),
            ...spreadIfDefined('transactionMinAmount', isNil(minAmount) ? undefined : { value: minAmount }),
            ...spreadIfDefined('transactionMaxAmount', isNil(maxAmount) ? undefined : { value: maxAmount }),
            ...spreadIfDefined('descriptionContains', descriptionContains),
        };
        const body = await cufxClient.sendMessage({
            auth: context.auth,
            entity: 'Transaction',
            operation: 'read',
            payload: { transactionFilter },
        });
        return {
            transactions: cufxClient.unwrapList({ body, entity: 'Transaction' }),
            raw: body,
        };
    },
});
