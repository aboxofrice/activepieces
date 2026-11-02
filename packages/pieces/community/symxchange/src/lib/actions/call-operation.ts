import { createAction, Property } from '@activepieces/pieces-framework';
import { symxchangeAuth } from '../auth';
import { SymxServiceName, symxClient } from '../common/client';

const CREDENTIALS_PLACEHOLDER = '<!--CREDENTIALS-->';

const SERVICE_OPTIONS: { label: string, value: SymxServiceName }[] = [
    { label: 'Account', value: 'account' },
    { label: 'Collateral', value: 'collateral' },
    { label: 'Dealer', value: 'dealer' },
    { label: 'FindBy', value: 'findby' },
    { label: 'General Ledger', value: 'generalledger' },
    { label: 'Information', value: 'information' },
    { label: 'Payee', value: 'payee' },
    { label: 'Transactions', value: 'transactions' },
    { label: 'User', value: 'user' },
];

export const callOperation = createAction({
    auth: symxchangeAuth,
    name: 'call_operation',
    displayName: 'Call SymXchange Operation',
    description: 'Call any operation on any SymXchange service — the escape hatch for the hundreds of operations without a dedicated action.',
    props: {
        service: Property.StaticDropdown({
            displayName: 'Service',
            description: 'The SymXchange service that owns the operation (matches the WSDL, e.g. Account for getShareSelectFields).',
            required: true,
            options: {
                options: SERVICE_OPTIONS,
            },
        }),
        operation: Property.ShortText({
            displayName: 'Operation',
            description: 'Exact operation name from the WSDL, e.g. getAccountSelectFields, findBySSN, payLoan.',
            required: true,
        }),
        requestXml: Property.LongText({
            displayName: 'Request Body XML',
            description: `The child elements of the <Request> element. The envelope, MessageId, Credentials, and DeviceInformation are added for you — Credentials + DeviceInformation are prepended, or placed exactly where you put \`${CREDENTIALS_PLACEHOLDER}\` when the operation's schema expects them mid-sequence. Prefixes available: \`cmn:\` (symxcommon), \`retrieve:\`/\`update:\` (CRUD service DTOs) or \`dto:\` (FindBy/Transactions/Information DTOs).`,
            required: false,
        }),
        includeCredentials: Property.Checkbox({
            displayName: 'Include Credentials',
            description: 'Disable to omit the automatic Credentials and DeviceInformation elements entirely.',
            required: false,
            defaultValue: true,
        }),
        endpointOverride: Property.ShortText({
            displayName: 'Endpoint Override',
            description: 'Full service URL to use instead of Base URL + service path.',
            required: false,
        }),
    },
    async run(context) {
        const { service, operation, requestXml, includeCredentials, endpointOverride } = context.propsValue;
        const bodyXml = requestXml ?? '';
        const credentialsBlock = includeCredentials === false
            ? ''
            : symxClient.buildCredentialsXml({ auth: context.auth.props }) + symxClient.buildDeviceXml({ auth: context.auth.props });
        const innerXml = bodyXml.includes(CREDENTIALS_PLACEHOLDER)
            ? bodyXml.replace(CREDENTIALS_PLACEHOLDER, credentialsBlock)
            : credentialsBlock + bodyXml;
        return symxClient.call({
            auth: context.auth.props,
            service,
            operation,
            innerXml,
            endpointOverride,
        });
    },
});
