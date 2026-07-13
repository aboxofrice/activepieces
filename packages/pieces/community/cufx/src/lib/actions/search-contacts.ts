import { createAction, Property } from '@activepieces/pieces-framework';
import { spreadIfDefined } from '@activepieces/shared';
import { cufxAuth } from '../auth';
import { cufxClient } from '../common/client';

export const searchContacts = createAction({
    auth: cufxAuth,
    name: 'search_contacts',
    displayName: 'Search Contacts',
    description: 'Read contact points (addresses, phones, emails) by contact, party, account, or contact type.',
    props: {
        contactIds: Property.Array({
            displayName: 'Contact IDs',
            description: 'Return only these contact IDs. Leave empty to filter by the other fields.',
            required: false,
        }),
        partyIds: Property.Array({
            displayName: 'Party IDs',
            description: 'Return the contacts belonging to these members (parties).',
            required: false,
        }),
        accountIds: Property.Array({
            displayName: 'Account IDs',
            description: 'Return the contacts associated with these accounts.',
            required: false,
        }),
        contactTypes: Property.StaticMultiSelectDropdown({
            displayName: 'Contact Types',
            required: false,
            options: {
                options: [
                    { label: 'Address', value: 'Address' },
                    { label: 'Phone', value: 'Phone' },
                    { label: 'Email', value: 'Email' },
                    { label: 'SMS', value: 'SMS' },
                    { label: 'Instant Messaging', value: 'InstantMessaging' },
                    { label: 'Social', value: 'Social' },
                    { label: 'Website', value: 'Website' },
                    { label: 'Other', value: 'Other' },
                ],
            },
        }),
    },
    async run(context) {
        const { contactIds, partyIds, accountIds, contactTypes } = context.propsValue;
        const contactFilter = {
            ...spreadIfDefined('contactIdList', cufxClient.valueList({ key: 'contactId', values: contactIds })),
            ...spreadIfDefined('partyIdList', cufxClient.valueList({ key: 'partyId', values: partyIds })),
            ...spreadIfDefined('accountIdList', cufxClient.valueList({ key: 'accountId', values: accountIds })),
            ...spreadIfDefined('contactTypeList', cufxClient.valueList({ key: 'contactType', values: contactTypes })),
        };
        const body = await cufxClient.sendMessage({
            auth: context.auth,
            entity: 'Contact',
            operation: 'read',
            payload: { contactFilter },
        });
        return {
            contacts: cufxClient.unwrapList({ body, entity: 'Contact' }),
            raw: body,
        };
    },
});
