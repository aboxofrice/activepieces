import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { ebayClient } from './common/client';

export const ebayAuth = PieceAuth.CustomAuth({
    description: `Connect one eBay seller account with a user refresh token.

1. **App ID / Cert ID** — from [developer.ebay.com](https://developer.ebay.com/my/keys) → Application Keys (the Production keyset for live stores).
2. **Refresh Token** — a user refresh token for this store, obtained by running the eBay consent flow with your app's RuName. The token must have been granted every scope the actions you use need — e.g. \`https://api.ebay.com/oauth/api_scope/commerce.message\` for Message actions and \`commerce.identity.readonly\` for the New Message trigger.
3. Refresh tokens last ~18 months; reconnect with a new one before it expires.`,
    required: true,
    props: {
        appId: Property.ShortText({
            displayName: 'App ID (Client ID)',
            required: true,
        }),
        certId: PieceAuth.SecretText({
            displayName: 'Cert ID (Client Secret)',
            required: true,
        }),
        refreshToken: PieceAuth.SecretText({
            displayName: 'Refresh Token',
            description: 'User refresh token for the seller account (starts with v^1.1#).',
            required: true,
        }),
        environment: Property.StaticDropdown({
            displayName: 'Environment',
            required: true,
            defaultValue: 'production',
            options: {
                options: [
                    { label: 'Production', value: 'production' },
                    { label: 'Sandbox', value: 'sandbox' },
                ],
            },
        }),
    },
    validate: async ({ auth }) => {
        const { error } = await ebayClient.tryGetAccessToken({ auth });
        if (error) {
            return { valid: false, error: `eBay rejected the credentials: ${error}` };
        }
        return { valid: true };
    },
});
