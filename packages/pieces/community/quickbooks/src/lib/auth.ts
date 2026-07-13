import { PieceAuth, Property } from '@activepieces/pieces-framework';

export const quickbooksAuth = PieceAuth.OAuth2({
	description: 'You can find Company ID under **settings->Additional Info**. For sandbox companies, it is shown on developer.intuit.com → API Docs & Tools → Sandbox.',
	required: true,
	props: {
		companyId: Property.ShortText({
			displayName: 'Company ID',
			required: true,
		}),
		environment: Property.StaticDropdown({
			displayName: 'Environment',
			description: 'Pick Sandbox for developer sandbox companies.',
			required: false,
			defaultValue: 'production',
			options: {
				options: [
					{ label: 'Production', value: 'production' },
					{ label: 'Sandbox', value: 'sandbox' },
				],
			},
		}),
	},
	authUrl: 'https://appcenter.intuit.com/connect/oauth2',
	tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
	scope: ['com.intuit.quickbooks.accounting'],
});
