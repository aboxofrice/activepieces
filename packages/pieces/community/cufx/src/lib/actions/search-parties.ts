import { createAction, Property } from '@activepieces/pieces-framework';
import { spreadIfDefined } from '@activepieces/shared';
import { cufxAuth } from '../auth';
import { cufxClient } from '../common/client';

export const searchParties = createAction({
    auth: cufxAuth,
    name: 'search_parties',
    displayName: 'Search Parties',
    description: 'Read members and organizations (parties) by ID, tax ID, account, or party type.',
    props: {
        partyIds: Property.Array({
            displayName: 'Party IDs',
            description: 'Return only these party IDs. Leave empty to filter by the other fields.',
            required: false,
        }),
        taxIds: Property.Array({
            displayName: 'Tax IDs',
            description: 'SSN, TIN, or EIN values to match, digits only.',
            required: false,
        }),
        accountIds: Property.Array({
            displayName: 'Account IDs',
            description: 'Return the parties associated with these accounts.',
            required: false,
        }),
        partyTypes: Property.StaticMultiSelectDropdown({
            displayName: 'Party Types',
            required: false,
            options: {
                options: ['Individual', 'Organization', 'Trust', 'Estate'].map((value) => ({ label: value, value })),
            },
        }),
    },
    async run(context) {
        const { partyIds, taxIds, accountIds, partyTypes } = context.propsValue;
        const partyFilter = {
            ...spreadIfDefined('partyIdList', cufxClient.valueList({ key: 'partyId', values: partyIds })),
            ...spreadIfDefined('taxIdList', cufxClient.valueList({ key: 'taxId', values: taxIds })),
            ...spreadIfDefined('accountIdList', cufxClient.valueList({ key: 'accountId', values: accountIds })),
            ...spreadIfDefined('partyTypeList', cufxClient.valueList({ key: 'partyType', values: partyTypes })),
        };
        const body = await cufxClient.sendMessage({
            auth: context.auth,
            entity: 'Party',
            operation: 'read',
            payload: { partyFilter },
        });
        return {
            parties: cufxClient.unwrapList({ body, entity: 'Party' }),
            raw: body,
        };
    },
});
