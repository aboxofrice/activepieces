import { createAction, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisIbsCardsAuth } from '../..';

// Helper function to build headers
function buildHeaders(auth: any, ibsAuthorization?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'organization-id': auth.organizationId,
    'source-id': auth.sourceId,
    'application-id': auth.applicationId,
    'uuid': crypto.randomUUID(),
    'ibs-authorization': ibsAuthorization || auth.ibsAuthorization,
  };
  if (auth.securityTokenType) {
    headers['security-token-type'] = auth.securityTokenType;
  }
  return headers;
}

// ============================================
// IBS-Cards.json - Card Management Functions
// ============================================

export const cards_single_commit = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_single_commit',
  displayName: 'Cards - Single Commit',
  description: 'Execute multiple host services as supported by Cardbase Single Commit',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    requestBody: Property.Object({
      displayName: 'Request Body',
      description: 'Single commit request data with up to 20 services',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCB/v4/cardbase-single-commit`,
      headers,
      body: context.propsValue.requestBody,
    });
    return response.body;
  },
});

export const cards_get_holds = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_holds',
  displayName: 'Cards - Get Holds',
  description: 'Return a list of all holds for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number or card alias',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCB/v4/cards/holds`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_authenticate = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_authenticate',
  displayName: 'Cards - Authenticate Cardholder',
  description: 'Authenticate a cardholder by comparing input data to stored data',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    authenticationData: Property.Object({
      displayName: 'Authentication Data',
      description: 'Card number and authentication fields (phone, SSN, PIN, etc.)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCB/v4/cards/authentication`,
      headers,
      body: context.propsValue.authenticationData,
    });
    return response.body;
  },
});

export const cards_link_unlink = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_link_unlink',
  displayName: 'Cards - Link/Unlink Cards',
  description: 'Create link or unlink between new and old card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    linkData: Property.Object({
      displayName: 'Link Data',
      description: 'Old card number, new card number, and link/unlink indicator',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCB/v4/cards/link-unlink`,
      headers,
      body: context.propsValue.linkData,
    });
    return response.body;
  },
});

export const cards_update_personal_limits = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_personal_limits',
  displayName: 'Cards - Update Personal Limits',
  description: 'Change the personal limits on a card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    limitsData: Property.Object({
      displayName: 'Limits Data',
      description: 'Card number and personal limits settings',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCB/v4/cards/personal-limits`,
      headers,
      body: context.propsValue.limitsData,
    });
    return response.body;
  },
});

export const cards_activate = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_activate',
  displayName: 'Cards - Activate Card',
  description: 'Activate a new card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    activationData: Property.Object({
      displayName: 'Activation Data',
      description: 'Card number or card alias for activation',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCB/v4/cards/activation`,
      headers,
      body: context.propsValue.activationData,
    });
    return response.body;
  },
});

export const cards_get_cardholders = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_cardholders',
  displayName: 'Cards - Get Cardholder Info',
  description: 'Retrieve cardholder information for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number or card alias',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCB/v4/cards/cardholders`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_update_cardholder_address = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_cardholder_address',
  displayName: 'Cards - Update Cardholder Address',
  description: 'Update cardholder name, address, and other customer demographics',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    addressData: Property.Object({
      displayName: 'Address Data',
      description: 'Card number and address information to update',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCB/v4/cards/cardholder-address`,
      headers,
      body: context.propsValue.addressData,
    });
    return response.body;
  },
});

export const cards_get_details = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_details',
  displayName: 'Cards - Get Card Details',
  description: 'Retrieve information for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number or card alias',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCB/v4/cards/details`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_reset_failure_counters = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_reset_failure_counters',
  displayName: 'Cards - Reset Failure Counters',
  description: 'Reset the counters for consecutive rejected transactions or PIN failures',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    resetData: Property.Object({
      displayName: 'Reset Data',
      description: 'Card number and reset indicators',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCB/v4/cards/failure-counters`,
      headers,
      body: context.propsValue.resetData,
    });
    return response.body;
  },
});

export const cards_generate_number = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_generate_number',
  displayName: 'Cards - Generate Card Number',
  description: 'Generate a Cardbase System account number',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    requestData: Property.Object({
      displayName: 'Request Data',
      description: 'Prefix number and other parameters for card generation',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCB/v4/card-numbers`,
      headers,
      body: context.propsValue.requestData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Account.json - Account Management
// ============================================

export const cards_update_primary_accounts = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_primary_accounts',
  displayName: 'Cards - Update Primary Accounts',
  description: 'Update primary accounts associated with the debit card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    accountData: Property.Object({
      displayName: 'Account Data',
      description: 'Card number and primary account information',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBACCT/v4/cards/primary-accounts`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const cards_get_multiple_accounts = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_multiple_accounts',
  displayName: 'Cards - Get Multiple Accounts',
  description: 'Retrieve multiple account information for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number or card alias',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBACCT/v4/multiple-accounts/inquiry`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_update_multiple_accounts = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_multiple_accounts',
  displayName: 'Cards - Update Multiple Accounts',
  description: 'Change data for one or more existing multiple accounts',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    accountData: Property.Object({
      displayName: 'Account Data',
      description: 'Card number and multiple account changes',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBACCT/v4/multiple-accounts`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const cards_add_multiple_accounts = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_add_multiple_accounts',
  displayName: 'Cards - Add Multiple Accounts',
  description: 'Add up to four multiple accounts for a primary account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    accountData: Property.Object({
      displayName: 'Account Data',
      description: 'Card number and new multiple accounts',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBACCT/v4/multiple-accounts`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const cards_delete_multiple_accounts = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_delete_multiple_accounts',
  displayName: 'Cards - Delete Multiple Accounts',
  description: 'Delete multiple accounts from a primary account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    accountData: Property.Object({
      displayName: 'Account Data',
      description: 'Card number and accounts to delete',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBACCT/v4/multiple-accounts/deletion`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const cards_get_by_dda_account = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_by_dda_account',
  displayName: 'Cards - Get Cards by DDA Account',
  description: 'Retrieve information regarding cards related to the specified DDA account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    accountData: Property.Object({
      displayName: 'Account Data',
      description: 'DDA account number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBACCT/v4/dda-accounts/cards`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Alert.json - Card Alerts
// ============================================

export const cards_update_alert_preferences = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_alert_preferences',
  displayName: 'Cards - Update Alert Preferences',
  description: 'Maintain alert preference for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    alertData: Property.Object({
      displayName: 'Alert Data',
      description: 'Card number and alert preferences',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBALERT/v4/cards/alert-preferences`,
      headers,
      body: context.propsValue.alertData,
    });
    return response.body;
  },
});

export const cards_get_alert_preferences = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_alert_preferences',
  displayName: 'Cards - Get Alert Preferences',
  description: 'Retrieve alert preferences for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number or card alias',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBALERT/v4/cards/alert-preferences`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_update_alert_contact_info = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_alert_contact_info',
  displayName: 'Cards - Update Alert Contact Info',
  description: 'Maintain alert contact information for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    contactData: Property.Object({
      displayName: 'Contact Data',
      description: 'Card number and alert contact information (mobile, email)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBALERT/v4/cards/alert-contact-info`,
      headers,
      body: context.propsValue.contactData,
    });
    return response.body;
  },
});

export const cards_get_alert_contact_info = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_alert_contact_info',
  displayName: 'Cards - Get Alert Contact Info',
  description: 'Retrieve alert contact information for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number or card alias',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBALERT/v4/cards/alert-contact-info`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Fraud.json - Fraud Management
// ============================================

export const cards_get_fraud_exclusion_codes = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_fraud_exclusion_codes',
  displayName: 'Cards - Get Fraud Exclusion Codes',
  description: 'Retrieve list of fraud or travel exclusion codes with description',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBFRAUD/v4/cards/fraud-exclusion-codes`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_delete_fraud_exclusion = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_delete_fraud_exclusion',
  displayName: 'Cards - Delete Fraud Exclusion',
  description: 'Delete fraud exclusion information for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBFRAUD/v4/cards/fraud-exclusions/deletion`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_update_fraud_exclusion = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_fraud_exclusion',
  displayName: 'Cards - Update Fraud Exclusion',
  description: 'Add or update fraud exclusion information for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    fraudData: Property.Object({
      displayName: 'Fraud Data',
      description: 'Card number, exclusion code, start/end dates, VIP indicator',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBFRAUD/v4/cards/fraud-exclusions`,
      headers,
      body: context.propsValue.fraudData,
    });
    return response.body;
  },
});

export const cards_get_fraud_exclusion = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_fraud_exclusion',
  displayName: 'Cards - Get Fraud Exclusion',
  description: 'Retrieve current fraud exclusion information for the specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBFRAUD/v4/cards/fraud-exclusions`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Holds.json - Holds (v3 API)
// ============================================

export const cards_get_holds_v3 = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_holds_v3',
  displayName: 'Cards - Get Holds (v3)',
  description: 'Get Cardbase Hold List Inquiry (v3 API with path parameter)',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardNumber: Property.ShortText({
      displayName: 'Card Number',
      description: 'Cardholder account number',
      required: true,
    }),
    filter: Property.StaticDropdown({
      displayName: 'Filter',
      description: 'Indicates which holds to return',
      required: true,
      options: {
        options: [
          { label: '01 - Return all holds and Credit Notifications', value: '01' },
          { label: '02 - Return only active holds and Credit Notifications', value: '02' },
          { label: '08 - Return all holds & CR Notifications (internal)', value: '08' },
          { label: '09 - Return only active holds & CR Notifications (internal)', value: '09' },
        ],
      },
    }),
    nextPageCursor: Property.ShortText({
      displayName: 'Next Page Cursor',
      description: 'Cursor for pagination',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    let url = `${auth.baseUrl}/IBSCBHOLDS/v3/cards/${context.propsValue.cardNumber}/holds?Fltr=${context.propsValue.filter}`;
    if (context.propsValue.nextPageCursor) {
      url += `&NextPageCursor=${context.propsValue.nextPageCursor}`;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Negative-File.json - Negative File
// ============================================

export const cards_update_negative_file = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_negative_file',
  displayName: 'Cards - Update Negative File',
  description: 'Add, maintain, or remove card on negative file',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    negFileData: Property.Object({
      displayName: 'Negative File Data',
      description: 'Card number, action (add/maintain/remove), status, and reason codes',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBNEGFILE/v4/cards/negative-file`,
      headers,
      body: context.propsValue.negFileData,
    });
    return response.body;
  },
});

export const cards_get_negative_file = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_negative_file',
  displayName: 'Cards - Get Negative File',
  description: 'Retrieve negative file information for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number or card proxy ID',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBNEGFILE/v4/cards/negative-file`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_update_negative_file_replace_card = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_update_negative_file_replace_card',
  displayName: 'Cards - Negative File with Replace Card',
  description: 'Add, maintain, or remove card on negative file with card replacement',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    negFileReplaceData: Property.Object({
      displayName: 'Negative File Replace Data',
      description: 'Card data with replacement options and negative file settings',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBNEGFILE/v4/cards/negative-file-replace-card`,
      headers,
      body: context.propsValue.negFileReplaceData,
    });
    return response.body;
  },
});

export const cards_get_negative_file_replace_card = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_negative_file_replace_card',
  displayName: 'Cards - Get Negative File with Replace Details',
  description: 'Retrieve negative file information with card replacement details',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBNEGFILE/v4/cards/negative-file-replace-card`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_negative_file_ivr = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_negative_file_ivr',
  displayName: 'Cards - Negative File IVR',
  description: 'Place a card on negative file with status of hot',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    ivrData: Property.Object({
      displayName: 'IVR Data',
      description: 'Card number and IVR parameters',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBNEGFILE/v4/cards/negative-file-ivr`,
      headers,
      body: context.propsValue.ivrData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-PIN.json - PIN Management
// ============================================

export const cards_change_pin_ivr = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_change_pin_ivr',
  displayName: 'Cards - Change PIN (IVR)',
  description: 'Change the PIN for the specified card via IVR',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    pinData: Property.Object({
      displayName: 'PIN Data',
      description: 'Card number, current PIN, new PIN, and originator',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBPIN/v4/cards/pins-ivr`,
      headers,
      body: context.propsValue.pinData,
    });
    return response.body;
  },
});

export const cards_validate_pin_ivr = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_validate_pin_ivr',
  displayName: 'Cards - Validate PIN (IVR)',
  description: 'Validate PIN for specified card via IVR',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    pinData: Property.Object({
      displayName: 'PIN Data',
      description: 'Card number, PIN, and originator',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBPIN/v4/cards/pins-ivr`,
      headers,
      body: context.propsValue.pinData,
    });
    return response.body;
  },
});

export const cards_change_pin = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_change_pin',
  displayName: 'Cards - Change PIN/Offset',
  description: 'Change PIN or PIN offset for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    pinData: Property.Object({
      displayName: 'PIN Data',
      description: 'Card number, PIN or PIN offset',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBPIN/v4/cards/pins`,
      headers,
      body: context.propsValue.pinData,
    });
    return response.body;
  },
});

export const cards_get_pin_info = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_pin_info',
  displayName: 'Cards - Get PIN Info',
  description: 'Retrieve PIN-related information for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBPIN/v4/cards/pins`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_send_pin_reminder = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_send_pin_reminder',
  displayName: 'Cards - Send PIN Reminder',
  description: 'Send PIN reminder for the account or expedite PIN reminders',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    reminderData: Property.Object({
      displayName: 'Reminder Data',
      description: 'Card number and optional expedited address',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBPIN/v4/cards/pin-reminders`,
      headers,
      body: context.propsValue.reminderData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Prefix.json - Prefix Information
// ============================================

export const cards_get_prefix_fee_info = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_prefix_fee_info',
  displayName: 'Cards - Get Prefix Fee Info',
  description: 'Retrieve effective dates, transaction fees and fee groups for a specific prefix',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cbInstnNbr: Property.ShortText({
      displayName: 'CB Institution Number',
      description: 'FIS host system bank number (5 digits)',
      required: false,
    }),
    prfxNbr: Property.ShortText({
      displayName: 'Prefix Number',
      description: 'Prefix number (not needed if Card Number is entered)',
      required: false,
    }),
    prodID: Property.ShortText({
      displayName: 'Product ID',
      description: 'Product ID',
      required: false,
    }),
    crdNum: Property.ShortText({
      displayName: 'Card Number',
      description: 'Card number (not needed if Prefix Number is entered)',
      required: false,
    }),
    mthdInd: Property.StaticDropdown({
      displayName: 'Method Indicator',
      description: 'Type of data to return',
      required: true,
      options: {
        options: [
          { label: '01 - Effective dates', value: '01' },
          { label: '02 - Fee detail', value: '02' },
          { label: '03 - Free groups', value: '03' },
        ],
      },
    }),
    effDte: Property.ShortText({
      displayName: 'Effective Date',
      description: 'Prefix level effective date (CCYY-MM-DD)',
      required: false,
    }),
    svcChgCatCde1: Property.ShortText({
      displayName: 'Service Charge Category Code',
      description: 'S1I, S2I, S3I, VRI, CAI, SPI, or ALL',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    params.append('MthdInd', context.propsValue.mthdInd);
    if (context.propsValue.cbInstnNbr) params.append('CBInstnNbr', context.propsValue.cbInstnNbr);
    if (context.propsValue.prfxNbr) params.append('PrfxNbr', context.propsValue.prfxNbr);
    if (context.propsValue.prodID) params.append('ProdID', context.propsValue.prodID);
    if (context.propsValue.crdNum) params.append('CrdNum', context.propsValue.crdNum);
    if (context.propsValue.effDte) params.append('EffDte', context.propsValue.effDte);
    if (context.propsValue.svcChgCatCde1) params.append('SvcChgCatCde1', context.propsValue.svcChgCatCde1);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCBPREFIX/v3/prefixes/fee-info?${params.toString()}`,
      headers,
    });
    return response.body;
  },
});

export const cards_get_prefix_issuer_ids = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_prefix_issuer_ids',
  displayName: 'Cards - Get Prefix Issuer IDs',
  description: 'Retrieve issuer ID(s) assigned to a prefix',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    prfxNum: Property.ShortText({
      displayName: 'Prefix Number',
      description: 'Prefix number',
      required: true,
    }),
    prodID: Property.ShortText({
      displayName: 'Product ID',
      description: 'Product ID valid within the prefix',
      required: false,
    }),
    nextPageCursor: Property.ShortText({
      displayName: 'Next Page Cursor',
      description: 'Cursor for pagination',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.prodID) params.append('ProdID', context.propsValue.prodID);
    if (context.propsValue.nextPageCursor) params.append('NextPageCursor', context.propsValue.nextPageCursor);

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSCBPREFIX/v3/prefixes/${context.propsValue.prfxNum}/issuer-ids${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Search.json - Card Search
// ============================================

export const cards_search = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_search',
  displayName: 'Cards - Search Cards',
  description: 'Retrieve card number and details using cardholder name, SSN, customer number or related account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cbInstnNbr: Property.ShortText({
      displayName: 'CB Institution Number',
      description: 'FIS host system bank number (5 digits)',
      required: false,
    }),
    methodInd: Property.StaticDropdown({
      displayName: 'Method Indicator',
      description: 'Type of search to perform',
      required: true,
      options: {
        options: [
          { label: '01 - Name', value: '01' },
          { label: '02 - Account', value: '02' },
          { label: '03 - Customer number', value: '03' },
          { label: '04 - SSN', value: '04' },
        ],
      },
    }),
    searchCriteria1: Property.ShortText({
      displayName: 'Search Criteria 1',
      description: 'Last name, account number, customer number, or SSN',
      required: true,
    }),
    searchCriteria2: Property.ShortText({
      displayName: 'Search Criteria 2',
      description: 'First name (for name search) or account type (for account search: C, D, L, S)',
      required: false,
    }),
    holdingComp: Property.ShortText({
      displayName: 'Holding Company',
      description: 'Holding company number (5 digits)',
      required: false,
    }),
    nextPageCursor: Property.ShortText({
      displayName: 'Next Page Cursor',
      description: 'Cursor for pagination',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    params.append('MethodInd', context.propsValue.methodInd);
    params.append('SearchCriteria1', context.propsValue.searchCriteria1);
    if (context.propsValue.cbInstnNbr) params.append('CBInstnNbr', context.propsValue.cbInstnNbr);
    if (context.propsValue.searchCriteria2) params.append('SearchCriteria2', context.propsValue.searchCriteria2);
    if (context.propsValue.holdingComp) params.append('HoldingComp', context.propsValue.holdingComp);
    if (context.propsValue.nextPageCursor) params.append('NextPageCursor', context.propsValue.nextPageCursor);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCBSRH/v3/cards/search?${params.toString()}`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Cards-Transactions.json - Transactions
// ============================================

export const cards_prepaid_credit_adjustment = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_prepaid_credit_adjustment',
  displayName: 'Cards - Prepaid Credit Adjustment',
  description: 'Perform credit adjustments on a prepaid debit card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    adjustmentData: Property.Object({
      displayName: 'Adjustment Data',
      description: 'Card number and credit adjustment amount',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/prepaid-credit-adjustments`,
      headers,
      body: context.propsValue.adjustmentData,
    });
    return response.body;
  },
});

export const cards_prepaid_debit_adjustment = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_prepaid_debit_adjustment',
  displayName: 'Cards - Prepaid Debit Adjustment',
  description: 'Perform debit adjustments on a prepaid debit card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    adjustmentData: Property.Object({
      displayName: 'Adjustment Data',
      description: 'Card number and debit adjustment amount',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/prepaid-debit-adjustments`,
      headers,
      body: context.propsValue.adjustmentData,
    });
    return response.body;
  },
});

export const cards_dda_sav_transfer = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_dda_sav_transfer',
  displayName: 'Cards - DDA/Savings Transfer',
  description: 'Perform a funds transfer between DDA and Savings accounts',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    transferData: Property.Object({
      displayName: 'Transfer Data',
      description: 'Card number, transfer amount, and direction',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/dda-sav-transfers`,
      headers,
      body: context.propsValue.transferData,
    });
    return response.body;
  },
});

export const cards_get_transaction_detail = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_transaction_detail',
  displayName: 'Cards - Get Transaction Detail',
  description: 'Retrieve detailed information about a specific transaction',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    transactionData: Property.Object({
      displayName: 'Transaction Data',
      description: 'Card number and transaction identifiers',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/transactions/detail`,
      headers,
      body: context.propsValue.transactionData,
    });
    return response.body;
  },
});

export const cards_prepaid_load = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_prepaid_load',
  displayName: 'Cards - Prepaid Load Transaction',
  description: 'Create load transaction to the specified prepaid debit card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    loadData: Property.Object({
      displayName: 'Load Data',
      description: 'Card number and load amount',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/prepaid-load-transactions`,
      headers,
      body: context.propsValue.loadData,
    });
    return response.body;
  },
});

export const cards_prepaid_unload = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_prepaid_unload',
  displayName: 'Cards - Prepaid Unload Transaction',
  description: 'Create unload transaction to the specified prepaid debit card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    unloadData: Property.Object({
      displayName: 'Unload Data',
      description: 'Card number and unload amount',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/prepaid-unload-transactions`,
      headers,
      body: context.propsValue.unloadData,
    });
    return response.body;
  },
});

export const cards_get_transactions = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_transactions',
  displayName: 'Cards - Get Transactions',
  description: 'Retrieve information about transactions for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number and optional filters',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/transactions`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_get_history_transactions = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_history_transactions',
  displayName: 'Cards - Get History Transactions',
  description: 'Retrieve information about history transactions for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number and optional date range',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/history-transactions`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_get_pending_transactions = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_pending_transactions',
  displayName: 'Cards - Get Pending Transactions',
  description: 'Retrieve information about pending transactions for specified card',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    cardData: Property.Object({
      displayName: 'Card Data',
      description: 'Card number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/pending-transactions`,
      headers,
      body: context.propsValue.cardData,
    });
    return response.body;
  },
});

export const cards_ach_transfer = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_ach_transfer',
  displayName: 'Cards - ACH Transfer',
  description: 'Perform an ACH funds transfer between cards and/or accounts',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    transferData: Property.Object({
      displayName: 'Transfer Data',
      description: 'Source/destination cards or accounts and transfer amount',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/ach-transfers`,
      headers,
      body: context.propsValue.transferData,
    });
    return response.body;
  },
});

export const cards_get_history_transaction_detail = createAction({
  auth: fisIbsCardsAuth,
  name: 'cards_get_history_transaction_detail',
  displayName: 'Cards - Get History Transaction Detail',
  description: 'Retrieve detailed information about a specific history transaction',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    transactionData: Property.Object({
      displayName: 'Transaction Data',
      description: 'Card number and transaction identifiers',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCBTRAN/v4/cards/history-transactions/detail`,
      headers,
      body: context.propsValue.transactionData,
    });
    return response.body;
  },
});
