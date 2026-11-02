import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { WALMART_ENVIRONMENT, WalmartAuthProps, walmartClient } from './common/client';

export const walmartAuth = PieceAuth.CustomAuth({
    description: `Connect a Walmart Marketplace seller account with API keys (client credentials).

1. Sign in to the [Walmart Developer Portal](https://developer.walmart.com/) with your Seller Center login.
2. Open **My Account → Marketplace → API Key Management**.
3. Copy the **Client ID** and **Client Secret** of the production keys (or the sandbox keys when testing).`,
    required: true,
    props: {
        clientId: Property.ShortText({
            displayName: 'Client ID',
            required: true,
        }),
        clientSecret: PieceAuth.SecretText({
            displayName: 'Client Secret',
            required: true,
        }),
        environment: Property.StaticDropdown({
            displayName: 'Environment',
            description: 'Use Sandbox only with sandbox keys.',
            required: true,
            defaultValue: WALMART_ENVIRONMENT.PRODUCTION,
            options: {
                disabled: false,
                options: [
                    { label: 'Production', value: WALMART_ENVIRONMENT.PRODUCTION },
                    { label: 'Sandbox', value: WALMART_ENVIRONMENT.SANDBOX },
                ],
            },
        }),
    },
    validate: async ({ auth }) => {
        const { error } = await walmartClient.tryGetToken({ auth });
        if (error) {
            return { valid: false, error: `Walmart rejected the credentials: ${error}` };
        }
        return { valid: true };
    },
});

// Engines below context V1 unwrap a CustomAuth connection to its props before handing it
// to the action; from V1 the whole connection value is passed and `.props` holds the
// credentials. A piece installed from npm may get either shape, so accept both.
export function walmartAuthProps(auth: WalmartAuthValue): WalmartAuthProps {
    return 'props' in auth ? auth.props : auth;
}

export type WalmartAuthValue = WalmartAuthProps | { props: WalmartAuthProps };
