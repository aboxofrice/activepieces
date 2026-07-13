import { createAction, Property } from '@activepieces/pieces-framework';
import { cufxAuth } from '../auth';
import { cufxClient } from '../common/client';

export const createOrUpdateParty = createAction({
    auth: cufxAuth,
    name: 'create_or_update_party',
    displayName: 'Create or Update Party',
    description: 'Create or update one or more members/organizations (parties). Include a partyId to update an existing party.',
    props: {
        parties: Property.Json({
            displayName: 'Party Record(s)',
            description: 'A CUFX Party object, or an array of them. Omit partyId to create; include it to update.',
            required: true,
            defaultValue: {
                type: 'Individual',
                characteristics: {
                    individual: {
                        firstName: '',
                        lastName: '',
                    },
                },
            },
        }),
    },
    async run(context) {
        const parties = cufxClient.asArray({ value: context.propsValue.parties });
        const body = await cufxClient.sendMessage({
            auth: context.auth,
            entity: 'Party',
            operation: 'createOrUpdate',
            payload: { partyList: { party: parties } },
        });
        return {
            parties: cufxClient.unwrapList({ body, entity: 'Party' }),
            raw: body,
        };
    },
});
