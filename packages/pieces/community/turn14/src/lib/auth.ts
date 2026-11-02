import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { Turn14AuthProps, turn14Client } from './common/client';

export const turn14Auth = PieceAuth.CustomAuth({
    description: `Connect a Turn 14 Distribution dealer account to the Turn14 API (OAuth client credentials).

1. Sign in at **turn14.com** and open **Account > API Settings**.
2. Copy the **Client ID** and **Client Secret** (generate them if none exist).
3. On the same page, make sure the API endpoints your flows need (items, inventory, pricing, orders, quotes...) are enabled for the account. A disabled endpoint answers *"This account does not have access..."*.
4. Problems with access: apisupport@turn14.com.`,
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
            description: 'Testing sends every request to apitest.turn14.com, Turn14\'s test host. Use it while building quote/order flows.',
            required: true,
            defaultValue: 'production',
            options: {
                options: [
                    { label: 'Production (api.turn14.com)', value: 'production' },
                    { label: 'Testing (apitest.turn14.com)', value: 'testing' },
                ],
            },
        }),
    },
    validate: async ({ auth }) => {
        const { error } = await turn14Client.tryGetToken({ auth });
        if (error) {
            return { valid: false, error: `Turn14 rejected the credentials: ${error}` };
        }
        return { valid: true };
    },
});

// Engines below context V1 hand actions the CustomAuth props directly; newer ones pass the whole
// connection with the credentials under `.props`. Accept either shape.
export function turn14AuthProps(auth: Turn14AuthValue): Turn14AuthProps {
    return 'props' in auth ? auth.props : auth;
}

export type Turn14AuthValue = Turn14AuthProps | { props: Turn14AuthProps };
