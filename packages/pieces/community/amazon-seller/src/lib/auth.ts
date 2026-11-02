import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { AmazonSellerAuthProps, spApiClient } from './common/client';
import { DEFAULT_MARKETPLACE_ID, marketplaces } from './common/marketplaces';

export const amazonSellerAuth = PieceAuth.CustomAuth({
    description: `Connect an Amazon Seller Central account through the Selling Partner API (SP-API). SP-API signs requests with a Login with Amazon (LWA) token only; no AWS keys are needed.

1. In Seller Central open **Apps and Services > Develop Apps** and open your app.
2. Click **View** under LWA credentials and copy the **Client ID** and **Client Secret**.
3. Click **Authorize** (self-authorization) next to the app and copy the **Refresh Token** (it starts with \`Atzr|\`).
4. **Seller ID** is your Merchant Token: **Settings > Account Info > Merchant Token**. It is only needed for the listing actions.`,
    required: true,
    props: {
        clientId: Property.ShortText({
            displayName: 'LWA Client ID',
            description: 'Starts with amzn1.application-oa2-client.',
            required: true,
        }),
        clientSecret: PieceAuth.SecretText({
            displayName: 'LWA Client Secret',
            required: true,
        }),
        refreshToken: PieceAuth.SecretText({
            displayName: 'Refresh Token',
            description: 'From self-authorizing the app in Seller Central. Starts with Atzr|.',
            required: true,
        }),
        marketplaceId: Property.StaticDropdown({
            displayName: 'Default Marketplace',
            description: 'Also picks the SP-API region (North America, Europe or Far East). Actions can override the marketplace within the same region.',
            required: true,
            defaultValue: DEFAULT_MARKETPLACE_ID,
            options: { options: marketplaces.dropdownOptions() },
        }),
        sellerId: Property.ShortText({
            displayName: 'Seller ID (Merchant Token)',
            description: 'Needed for Get Listing and Update Listing Quantity, e.g. A1B2C3D4E5F6G7.',
            required: false,
        }),
        sandbox: Property.Checkbox({
            displayName: 'Use SP-API Sandbox',
            description: 'Send requests to the sandbox endpoints, which return canned responses and never change real data.',
            required: false,
            defaultValue: false,
        }),
    },
    validate: async ({ auth }) => {
        const { error } = await spApiClient.tryGetAccessToken({ auth });
        if (error) {
            return { valid: false, error: `Login with Amazon rejected the credentials: ${error}` };
        }
        return { valid: true };
    },
});

// Engines below context V1 hand actions the CustomAuth props directly, newer ones pass the
// whole connection with the credentials under `.props`; accept either shape.
export function amazonSellerAuthProps(auth: AmazonSellerAuthValue): AmazonSellerAuthProps {
    return 'props' in auth ? auth.props : auth;
}

export type AmazonSellerAuthValue = AmazonSellerAuthProps | { props: AmazonSellerAuthProps };
