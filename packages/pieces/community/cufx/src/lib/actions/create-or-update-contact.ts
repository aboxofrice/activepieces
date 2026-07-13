import { createAction, Property } from '@activepieces/pieces-framework';
import { cufxAuth } from '../auth';
import { cufxClient } from '../common/client';

export const createOrUpdateContact = createAction({
    auth: cufxAuth,
    name: 'create_or_update_contact',
    displayName: 'Create or Update Contact',
    description: 'Create or update one or more contact points (address, phone, email). Include a contactId to update an existing contact.',
    props: {
        contacts: Property.Json({
            displayName: 'Contact Record(s)',
            description: 'A CUFX Contact object, or an array of them. Omit contactId to create; include it to update.',
            required: true,
            defaultValue: {
                contactType: 'Email',
                contactPoint: {
                    email: {
                        emailType: 'Home',
                        address: '',
                    },
                },
                partyIdList: {
                    partyId: [''],
                },
            },
        }),
    },
    async run(context) {
        const contacts = cufxClient.asArray({ value: context.propsValue.contacts });
        const body = await cufxClient.sendMessage({
            auth: context.auth,
            entity: 'Contact',
            operation: 'createOrUpdate',
            payload: { contactList: { contact: contacts } },
        });
        return {
            contacts: cufxClient.unwrapList({ body, entity: 'Contact' }),
            raw: body,
        };
    },
});
