import { createAction, Property } from '@activepieces/pieces-framework';
import { spreadIfDefined } from '@activepieces/shared';
import { cufxAuth } from '../auth';
import { cufxClient } from '../common/client';

export const searchAccounts = createAction({
    auth: cufxAuth,
    name: 'search_accounts',
    displayName: 'Search Accounts',
    description: 'Read accounts by account ID, member (party) ID, or account type.',
    props: {
        accountIds: Property.Array({
            displayName: 'Account IDs',
            description: 'Return only these account IDs. Leave empty to filter by the other fields.',
            required: false,
        }),
        partyIds: Property.Array({
            displayName: 'Party IDs',
            description: 'Return the accounts owned by these members (parties).',
            required: false,
        }),
        accountTypes: Property.StaticMultiSelectDropdown({
            displayName: 'Account Types',
            required: false,
            options: {
                options: [
                    { label: 'Checking', value: 'Checking' },
                    { label: 'Savings', value: 'Savings' },
                    { label: 'Loan', value: 'Loan' },
                    { label: 'Credit Card', value: 'CreditCard' },
                    { label: 'Line of Credit', value: 'LineOfCredit' },
                ],
            },
        }),
    },
    async run(context) {
        const { accountIds, partyIds, accountTypes } = context.propsValue;
        const accountFilter = {
            ...spreadIfDefined('accountIdList', cufxClient.valueList({ key: 'accountId', values: accountIds })),
            ...spreadIfDefined('partyIdList', cufxClient.valueList({ key: 'partyId', values: partyIds })),
            ...spreadIfDefined('accountTypeList', cufxClient.valueList({ key: 'accountType', values: accountTypes })),
        };
        const body = await cufxClient.sendMessage({
            auth: context.auth,
            entity: 'Account',
            operation: 'read',
            payload: { accountFilter },
        });
        return {
            accounts: cufxClient.unwrapList({ body, entity: 'Account' }),
            raw: body,
        };
    },
});
