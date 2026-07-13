import { createAction, Property } from '@activepieces/pieces-framework';
import { symxchangeAuth } from '../auth';
import { symxClient } from '../common/client';

function buildLookup({ lookupType, value, credentialsXml, deviceXml }: {
    lookupType: string,
    value: string,
    credentialsXml: string,
    deviceXml: string,
}): { operation: string, innerXml: string } {
    // Element order follows each request type's schema sequence — findByShortName
    // is the odd one out with credentials first
    switch (lookupType) {
        case 'ssn':
            return { operation: 'findBySSN', innerXml: symxClient.tag({ name: 'SSN', value }) + deviceXml + credentialsXml };
        case 'shortName':
            return { operation: 'findByShortName', innerXml: credentialsXml + deviceXml + symxClient.tag({ name: 'ShortName', value }) };
        case 'activeCard':
            return { operation: 'findByActiveCard', innerXml: symxClient.tag({ name: 'CardNumber', value }) + deviceXml + credentialsXml };
        case 'anyCard':
            return { operation: 'findByAnyCard', innerXml: symxClient.tag({ name: 'CardNumber', value }) + deviceXml + credentialsXml };
        case 'homeUser':
            return { operation: 'findByHomeUser', innerXml: symxClient.tag({ name: 'HomeBankingUserName', value }) + deviceXml + credentialsXml };
        default:
            throw new Error(`Unsupported lookup type: ${lookupType}`);
    }
}

export const findAccounts = createAction({
    auth: symxchangeAuth,
    name: 'find_accounts',
    displayName: 'Find Accounts',
    description: 'Look up member account numbers by SSN, short name, card number, or home banking username (FindBy service).',
    props: {
        lookupType: Property.StaticDropdown({
            displayName: 'Look Up By',
            required: true,
            defaultValue: 'ssn',
            options: {
                options: [
                    { label: 'SSN / Tax ID', value: 'ssn' },
                    { label: 'Short Name', value: 'shortName' },
                    { label: 'Active Card Number', value: 'activeCard' },
                    { label: 'Any Card Number', value: 'anyCard' },
                    { label: 'Home Banking Username', value: 'homeUser' },
                ],
            },
        }),
        value: Property.ShortText({
            displayName: 'Value',
            description: 'The SSN (9 digits), short name, card number, or username to look up.',
            required: true,
        }),
    },
    async run(context) {
        const { lookupType, value } = context.propsValue;
        const { operation, innerXml } = buildLookup({
            lookupType,
            value,
            credentialsXml: symxClient.buildCredentialsXml({ auth: context.auth.props }),
            deviceXml: symxClient.buildDeviceXml({ auth: context.auth.props }),
        });
        const response = await symxClient.call({
            auth: context.auth.props,
            service: 'findby',
            operation,
            innerXml,
        });
        const unwrapped = symxClient.unwrapResponse({ response });
        return {
            accountNumbers: symxClient.asArray({ value: unwrapped['AccountNumber'] }),
            raw: response,
        };
    },
});
