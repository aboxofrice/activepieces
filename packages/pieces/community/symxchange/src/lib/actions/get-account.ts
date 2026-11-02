import { createAction, Property } from '@activepieces/pieces-framework';
import { symxchangeAuth } from '../auth';
import { symxClient } from '../common/client';

export const getAccount = createAction({
    auth: symxchangeAuth,
    name: 'get_account',
    displayName: 'Get Account',
    description: 'Retrieve an account record with all fields (getAccountSelectFields).',
    props: {
        accountNumber: Property.ShortText({
            displayName: 'Account Number',
            description: 'The member account number, zero-padded as stored in Symitar, e.g. 0000012345.',
            required: true,
        }),
    },
    async run(context) {
        const { accountNumber } = context.propsValue;
        const innerXml = symxClient.tag({ name: 'AccountNumber', value: accountNumber })
            + symxClient.buildCredentialsXml({ auth: context.auth.props })
            + symxClient.buildDeviceXml({ auth: context.auth.props })
            + '<SelectableFields><IncludeAllAccountFields>true</IncludeAllAccountFields></SelectableFields>';
        const response = await symxClient.call({
            auth: context.auth.props,
            service: 'account',
            operation: 'getAccountSelectFields',
            innerXml,
        });
        const unwrapped = symxClient.unwrapResponse({ response });
        return {
            account: unwrapped['Account'] ?? null,
            raw: response,
        };
    },
});
