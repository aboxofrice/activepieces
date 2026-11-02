import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { OAuth2GrantType } from '@activepieces/shared';

export const cufxAuth = PieceAuth.OAuth2({
    description: `Connect to a CUFX 5.0 (Credit Union Financial eXchange) deployment using OAuth2 client credentials.

1. **API Base URL** — the root URL of your CUFX service. Message endpoints such as \`/AccountMessage\` are appended automatically.
2. **Token URL** — the OAuth2 token endpoint that issues client-credentials access tokens for the deployment.
3. **Client ID / Client Secret** — the credentials issued by your financial institution or vendor gateway.
4. The remaining fields are optional deployment identifiers. When provided they are stamped into the \`messageContext\` of every request.`,
    required: true,
    grantType: OAuth2GrantType.CLIENT_CREDENTIALS,
    authUrl: '',
    tokenUrl: '{tokenUrl}',
    scope: [],
    props: {
        baseUrl: Property.ShortText({
            displayName: 'API Base URL',
            description: 'Root URL of the CUFX service, without a trailing message segment, e.g. https://api.mycu.example.com/cufx/v5.',
            required: true,
        }),
        tokenUrl: Property.ShortText({
            displayName: 'Token URL',
            description: 'OAuth2 token endpoint for the client-credentials grant.',
            required: true,
        }),
        fiId: Property.ShortText({
            displayName: 'Financial Institution ID (fiId)',
            description: 'Identifies the financial institution in multi-tenant deployments. Leave empty if not required.',
            required: false,
        }),
        vendorId: Property.ShortText({
            displayName: 'Vendor ID',
            description: 'Vendor identifier assigned by the financial institution, if required.',
            required: false,
        }),
        appId: Property.ShortText({
            displayName: 'App ID',
            description: 'Application identifier, if required by the deployment.',
            required: false,
        }),
        dataSourceId: Property.ShortText({
            displayName: 'Data Source ID',
            description: 'Identifies a registered data source (e.g. core vs. card processor), if required.',
            required: false,
        }),
    },
});
