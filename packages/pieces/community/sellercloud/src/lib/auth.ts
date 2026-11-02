import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { SellercloudAuthProps } from './common/client';
import { sellercloudClient } from './common/client';

export const sellercloudAuth = PieceAuth.CustomAuth({
    description: `Connect a SellerCloud account with a username and password (SellerCloud's REST API has no OAuth or API keys).

1. **REST API URL**: open \`https://api.sellercloud.com/api/server-by-team/?team=<your team>\` and copy \`RestApiEndpoint\`, e.g. \`https://allwholesale.api.sellercloud.us/rest\`.
2. **Username / Password**: use a dedicated API user with only the permissions your flows need.
3. **PIN**: only needed when the company setting "Require PIN to change inventory quantity" is on.`,
    required: true,
    props: {
        serverUrl: Property.ShortText({
            displayName: 'REST API URL',
            description: 'The RestApiEndpoint for your team, ending in /rest.',
            required: true,
        }),
        username: Property.ShortText({
            displayName: 'Username',
            required: true,
        }),
        password: PieceAuth.SecretText({
            displayName: 'Password',
            required: true,
        }),
        pinCode: PieceAuth.SecretText({
            displayName: 'Inventory PIN',
            description: 'Only if SellerCloud requires a PIN to change inventory quantities.',
            required: false,
        }),
    },
    validate: async ({ auth }) => {
        const { error } = await sellercloudClient.tryGetToken({ auth });
        if (error) {
            return { valid: false, error: `SellerCloud rejected the credentials: ${error}` };
        }
        return { valid: true };
    },
});

// Engines below context V1 unwrap a CustomAuth connection to its props before handing it to
// the action, so `context.auth` is the props object and `context.auth.props` is undefined;
// from V1 the whole connection value is passed and `.props` is where the credentials live.
// A piece published without the framework as a dependency reports no context version and so
// gets the V0 shape, which is why every action failed with "Cannot read properties of
// undefined (reading 'serverUrl')". Accept either shape rather than betting on one.
export function sellercloudAuthProps(auth: SellercloudAuthValue): SellercloudAuthProps {
    return 'props' in auth ? auth.props : auth;
}

export type SellercloudAuthValue = SellercloudAuthProps | { props: SellercloudAuthProps };
