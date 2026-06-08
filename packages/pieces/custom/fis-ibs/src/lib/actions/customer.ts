import { createAction, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisIbsAuth } from '../..';

// Helper function to build headers
function buildHeaders(auth: any, ibsAuthorization?: string, contentType = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
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
// IBS-Customer.json - Customer CRUD
// ============================================

export const customer_get = createAction({
  auth: fisIbsAuth,
  name: 'customer_get',
  displayName: 'Customer - Get Customer',
  description: 'Retrieve customer information by customer number',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    ciApplNbr: Property.ShortText({
      displayName: 'Customer Number',
      description: 'CIS customer number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCICUST/v4/customers/${context.propsValue.ciApplNbr}`,
      headers,
    });
    return response.body;
  },
});

export const customer_delete = createAction({
  auth: fisIbsAuth,
  name: 'customer_delete',
  displayName: 'Customer - Delete Customer',
  description: 'Delete a customer record',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    ciApplNbr: Property.ShortText({
      displayName: 'Customer Number',
      description: 'CIS customer number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCICUST/v4/customers/${context.propsValue.ciApplNbr}`,
      headers,
    });
    return response.body;
  },
});

export const customer_create_individual = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_individual',
  displayName: 'Customer - Create Individual',
  description: 'Create a new individual customer',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    customerData: Property.Object({
      displayName: 'Customer Data',
      description: 'Individual customer information',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCICUST/v4/customers/individuals`,
      headers,
      body: context.propsValue.customerData,
    });
    return response.body;
  },
});

export const customer_create_organization = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_organization',
  displayName: 'Customer - Create Organization',
  description: 'Create a new organization customer',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    customerData: Property.Object({
      displayName: 'Customer Data',
      description: 'Organization customer information',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCICUST/v4/customers/organizations`,
      headers,
      body: context.propsValue.customerData,
    });
    return response.body;
  },
});

export const customer_get_combined = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_combined',
  displayName: 'Customer - Get Combined Customer',
  description: 'Retrieve combined customer information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    survCustNbr: Property.ShortText({
      displayName: 'Surviving Customer Number',
      required: true,
    }),
    combCustNbr: Property.ShortText({
      displayName: 'Combined Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCICUST/v4/customers/${context.propsValue.survCustNbr}/combined-customer/${context.propsValue.combCustNbr}`,
      headers,
    });
    return response.body;
  },
});

export const customer_update_combined = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_combined',
  displayName: 'Customer - Update Combined Customer',
  description: 'Update combined customer information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    survCustNbr: Property.ShortText({
      displayName: 'Surviving Customer Number',
      required: true,
    }),
    combCustNbr: Property.ShortText({
      displayName: 'Combined Customer Number',
      required: true,
    }),
    updateData: Property.Object({
      displayName: 'Update Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCICUST/v4/customers/${context.propsValue.survCustNbr}/combined-customer/${context.propsValue.combCustNbr}`,
      headers,
      body: context.propsValue.updateData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Accounts.json - Account Management
// ============================================

export const customer_accounts_address_edit = createAction({
  auth: fisIbsAuth,
  name: 'customer_accounts_address_edit',
  displayName: 'Customer - Account Address Edit',
  description: 'Preview address standardization for account name/address data',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    addressData: Property.Object({
      displayName: 'Address Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCIACCT/v4/accounts/address-edit`,
      headers,
      body: context.propsValue.addressData,
    });
    return response.body;
  },
});

export const customer_accounts_delete = createAction({
  auth: fisIbsAuth,
  name: 'customer_accounts_delete',
  displayName: 'Customer - Delete Account',
  description: 'Delete an account from CIS',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    applCde: Property.ShortText({
      displayName: 'Application Code',
      description: 'DP, LN, SB, or CBM',
      required: true,
    }),
    applNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCIACCT/v4/accounts/${context.propsValue.applCde}/${context.propsValue.applNbr}`,
      headers,
    });
    return response.body;
  },
});

export const customer_accounts_get_name_address = createAction({
  auth: fisIbsAuth,
  name: 'customer_accounts_get_name_address',
  displayName: 'Customer - Get Account Name/Address',
  description: 'Retrieve account name and address information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    appCde: Property.ShortText({
      displayName: 'Application Code',
      required: true,
    }),
    applNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCIACCT/v4/accounts/${context.propsValue.appCde}/${context.propsValue.applNbr}/name-address`,
      headers,
    });
    return response.body;
  },
});

export const customer_accounts_update_name_address = createAction({
  auth: fisIbsAuth,
  name: 'customer_accounts_update_name_address',
  displayName: 'Customer - Update Account Name/Address',
  description: 'Update account name and address information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    appCde: Property.ShortText({
      displayName: 'Application Code',
      required: true,
    }),
    applNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    addressData: Property.Object({
      displayName: 'Address Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCIACCT/v4/accounts/${context.propsValue.appCde}/${context.propsValue.applNbr}/name-address`,
      headers,
      body: context.propsValue.addressData,
    });
    return response.body;
  },
});

export const customer_accounts_create = createAction({
  auth: fisIbsAuth,
  name: 'customer_accounts_create',
  displayName: 'Customer - Create Account',
  description: 'Create a new account in CIS',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    accountData: Property.Object({
      displayName: 'Account Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCIACCT/v4/accounts`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const customer_accounts_update_related_address = createAction({
  auth: fisIbsAuth,
  name: 'customer_accounts_update_related_address',
  displayName: 'Customer - Update Related Accounts Address',
  description: 'Update customer address on all related accounts',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    addressData: Property.Object({
      displayName: 'Address Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCIACCT/v4/related-accounts-address`,
      headers,
      body: context.propsValue.addressData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Demographics.json
// ============================================

export const customer_address_edit = createAction({
  auth: fisIbsAuth,
  name: 'customer_address_edit',
  displayName: 'Customer - Address Edit Preview',
  description: 'Preview address standardization for customer name/address data',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    addressData: Property.Object({
      displayName: 'Address Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/address-edit`,
      headers,
      body: context.propsValue.addressData,
    });
    return response.body;
  },
});

export const customer_update_addresses = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_addresses',
  displayName: 'Customer - Update Addresses',
  description: 'Update customer address information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    ciApplNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    addressData: Property.Object({
      displayName: 'Address Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/${context.propsValue.ciApplNbr}/addresses`,
      headers,
      body: context.propsValue.addressData,
    });
    return response.body;
  },
});

export const customer_get_aliases = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_aliases',
  displayName: 'Customer - Get Aliases',
  description: 'Retrieve customer aliases',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/${context.propsValue.custNbr}/aliases`,
      headers,
    });
    return response.body;
  },
});

export const customer_create_alias = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_alias',
  displayName: 'Customer - Create Alias',
  description: 'Create a new customer alias',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    aliasData: Property.Object({
      displayName: 'Alias Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/${context.propsValue.custNbr}/aliases`,
      headers,
      body: context.propsValue.aliasData,
    });
    return response.body;
  },
});

export const customer_update_alias = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_alias',
  displayName: 'Customer - Update Alias',
  description: 'Update a customer alias',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    alSeqNbr: Property.ShortText({
      displayName: 'Alias Sequence Number',
      required: true,
    }),
    aliasData: Property.Object({
      displayName: 'Alias Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/${context.propsValue.custNbr}/aliases/${context.propsValue.alSeqNbr}`,
      headers,
      body: context.propsValue.aliasData,
    });
    return response.body;
  },
});

export const customer_delete_alias = createAction({
  auth: fisIbsAuth,
  name: 'customer_delete_alias',
  displayName: 'Customer - Delete Alias',
  description: 'Delete a customer alias',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    alSeqNbr: Property.ShortText({
      displayName: 'Alias Sequence Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/${context.propsValue.custNbr}/aliases/${context.propsValue.alSeqNbr}`,
      headers,
    });
    return response.body;
  },
});

export const customer_get_due_diligence = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_due_diligence',
  displayName: 'Customer - Get Due Diligence Demographics',
  description: 'Retrieve due diligence demographic information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/${context.propsValue.custNbr}/due-diligence-demographics`,
      headers,
    });
    return response.body;
  },
});

export const customer_update_due_diligence = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_due_diligence',
  displayName: 'Customer - Update Due Diligence Demographics',
  description: 'Update due diligence demographic information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    dueDiligenceData: Property.Object({
      displayName: 'Due Diligence Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCICUSTDEM/v4/customers/${context.propsValue.custNbr}/due-diligence-demographics`,
      headers,
      body: context.propsValue.dueDiligenceData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Contact-Information.json
// ============================================

export const customer_get_email_addresses = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_email_addresses',
  displayName: 'Customer - Get Email Addresses',
  description: 'Retrieve customer email addresses',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCICONTACT/v4/customers/${context.propsValue.custNbr}/email-addresses`,
      headers,
    });
    return response.body;
  },
});

export const customer_create_email_address = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_email_address',
  displayName: 'Customer - Create Email Address',
  description: 'Add a new email address for a customer',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    emailData: Property.Object({
      displayName: 'Email Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCICONTACT/v4/customers/${context.propsValue.custNbr}/email-addresses`,
      headers,
      body: context.propsValue.emailData,
    });
    return response.body;
  },
});

export const customer_delete_email_address = createAction({
  auth: fisIbsAuth,
  name: 'customer_delete_email_address',
  displayName: 'Customer - Delete Email Address',
  description: 'Delete a customer email address',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    reasonCode: Property.ShortText({
      displayName: 'Reason Code',
      required: true,
    }),
    effectiveDate: Property.ShortText({
      displayName: 'Effective Date',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCICONTACT/v4/customers/${context.propsValue.custNbr}/email-addresses/${context.propsValue.reasonCode}/${context.propsValue.effectiveDate}`,
      headers,
    });
    return response.body;
  },
});

export const customer_get_phone_numbers = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_phone_numbers',
  displayName: 'Customer - Get Phone Numbers',
  description: 'Retrieve customer phone numbers',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCICONTACT/v4/customers/${context.propsValue.custNbr}/phone-numbers`,
      headers,
    });
    return response.body;
  },
});

export const customer_create_phone_number = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_phone_number',
  displayName: 'Customer - Create Phone Number',
  description: 'Add a new phone number for a customer',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    phoneData: Property.Object({
      displayName: 'Phone Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCICONTACT/v4/customers/${context.propsValue.custNbr}/phone-numbers`,
      headers,
      body: context.propsValue.phoneData,
    });
    return response.body;
  },
});

export const customer_update_phone_number = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_phone_number',
  displayName: 'Customer - Update Phone Number',
  description: 'Update a customer phone number',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    phoneData: Property.Object({
      displayName: 'Phone Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCICONTACT/v4/customers/${context.propsValue.custNbr}/phone-numbers`,
      headers,
      body: context.propsValue.phoneData,
    });
    return response.body;
  },
});

export const customer_delete_phone_number = createAction({
  auth: fisIbsAuth,
  name: 'customer_delete_phone_number',
  displayName: 'Customer - Delete Phone Number',
  description: 'Delete a customer phone number',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    custNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    reasonCode: Property.ShortText({
      displayName: 'Reason Code',
      required: true,
    }),
    effectiveDate: Property.ShortText({
      displayName: 'Effective Date',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCICONTACT/v4/customers/${context.propsValue.custNbr}/phone-numbers/${context.propsValue.reasonCode}/${context.propsValue.effectiveDate}`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Information-Search.json
// ============================================

export const customer_search_by_name = createAction({
  auth: fisIbsAuth,
  name: 'customer_search_by_name',
  displayName: 'Customer - Search by Name/Address',
  description: 'Search customers by name and address',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    lastName: Property.ShortText({
      displayName: 'Last Name',
      required: true,
    }),
    firstName: Property.ShortText({
      displayName: 'First Name',
      required: false,
    }),
    city: Property.ShortText({
      displayName: 'City',
      required: false,
    }),
    state: Property.ShortText({
      displayName: 'State',
      required: false,
    }),
    zipCode: Property.ShortText({
      displayName: 'ZIP Code',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    params.append('lastName', context.propsValue.lastName);
    if (context.propsValue.firstName) params.append('firstName', context.propsValue.firstName);
    if (context.propsValue.city) params.append('city', context.propsValue.city);
    if (context.propsValue.state) params.append('state', context.propsValue.state);
    if (context.propsValue.zipCode) params.append('zipCode', context.propsValue.zipCode);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCISRH/v4/customers/search/name-address?${params.toString()}`,
      headers,
    });
    return response.body;
  },
});

export const customer_search_by_customer_number = createAction({
  auth: fisIbsAuth,
  name: 'customer_search_by_customer_number',
  displayName: 'Customer - Search by Customer Number',
  description: 'Search customers by customer number',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    customerNumber: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCISRH/v4/customers/search/customer-number?customerNumber=${context.propsValue.customerNumber}`,
      headers,
    });
    return response.body;
  },
});

export const customer_search_by_tax_number = createAction({
  auth: fisIbsAuth,
  name: 'customer_search_by_tax_number',
  displayName: 'Customer - Search by Tax Number',
  description: 'Search customers by SSN or tax ID',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    taxNumber: Property.ShortText({
      displayName: 'Tax Number',
      description: 'SSN or Tax ID',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCISRH/v4/customers/search/taxnbr?taxNumber=${context.propsValue.taxNumber}`,
      headers,
    });
    return response.body;
  },
});

export const customer_search_by_phone = createAction({
  auth: fisIbsAuth,
  name: 'customer_search_by_phone',
  displayName: 'Customer - Search by Phone Number',
  description: 'Search customers by telephone number',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    phoneNumber: Property.ShortText({
      displayName: 'Phone Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCISRH/v4/customers/search/telephone-number?phoneNumber=${context.propsValue.phoneNumber}`,
      headers,
    });
    return response.body;
  },
});

export const customer_search_by_cip_id = createAction({
  auth: fisIbsAuth,
  name: 'customer_search_by_cip_id',
  displayName: 'Customer - Search by CIP ID',
  description: 'Search customers by CIP identification',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    cipId: Property.ShortText({
      displayName: 'CIP ID',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCISRH/v4/customers/search/cip-id?cipId=${context.propsValue.cipId}`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Combined-Statements.json
// ============================================

export const customer_get_statements = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_statements',
  displayName: 'Customer - Get Statements',
  description: 'Retrieve customer combined statement information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    ciCustNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCISTMT/v4/customers/${context.propsValue.ciCustNbr}/statements`,
      headers,
    });
    return response.body;
  },
});

export const customer_create_combined_statement = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_combined_statement',
  displayName: 'Customer - Create Combined Statement Relationship',
  description: 'Create a combined statement relationship',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    statementData: Property.Object({
      displayName: 'Statement Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCISTMT/v4/combined-statement-relationships`,
      headers,
      body: context.propsValue.statementData,
    });
    return response.body;
  },
});

export const customer_update_combined_statement = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_combined_statement',
  displayName: 'Customer - Update Combined Statement Relationship',
  description: 'Update a combined statement relationship',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    statementData: Property.Object({
      displayName: 'Statement Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCISTMT/v4/combined-statement-relationships`,
      headers,
      body: context.propsValue.statementData,
    });
    return response.body;
  },
});

export const customer_delete_combined_statement = createAction({
  auth: fisIbsAuth,
  name: 'customer_delete_combined_statement',
  displayName: 'Customer - Delete Combined Statement Relationship',
  description: 'Delete a combined statement relationship',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    ciCustNbr: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    ciCurPriAcctNbr: Property.ShortText({
      displayName: 'Primary Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCISTMT/v4/combined-statement-relationships/${context.propsValue.ciCustNbr}/${context.propsValue.ciCurPriAcctNbr}`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Remarks.json
// ============================================

export const customer_get_remarks = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_remarks',
  displayName: 'Customer - Get Remarks',
  description: 'Retrieve customer remarks',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    ciApplCde: Property.ShortText({
      displayName: 'Application Code',
      required: true,
    }),
    ciApplNbr: Property.ShortText({
      displayName: 'Application Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCIRMRK/v4/remarks/${context.propsValue.ciApplCde}/${context.propsValue.ciApplNbr}`,
      headers,
    });
    return response.body;
  },
});

export const customer_create_remark = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_remark',
  displayName: 'Customer - Create Remark',
  description: 'Create a new customer remark',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    remarkData: Property.Object({
      displayName: 'Remark Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCIRMRK/v4/remarks`,
      headers,
      body: context.propsValue.remarkData,
    });
    return response.body;
  },
});

export const customer_update_remark = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_remark',
  displayName: 'Customer - Update Remark',
  description: 'Update a customer remark',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    remarkData: Property.Object({
      displayName: 'Remark Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCIRMRK/v4/remarks`,
      headers,
      body: context.propsValue.remarkData,
    });
    return response.body;
  },
});

export const customer_delete_remark = createAction({
  auth: fisIbsAuth,
  name: 'customer_delete_remark',
  displayName: 'Customer - Delete Remark',
  description: 'Delete a customer remark',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    ciApplCde: Property.ShortText({
      displayName: 'Application Code',
      required: true,
    }),
    ciApplNbr: Property.ShortText({
      displayName: 'Application Number',
      required: true,
    }),
    ciRmrkEffDte: Property.ShortText({
      displayName: 'Remark Effective Date',
      required: true,
    }),
    ciRmrkPrcsTme: Property.ShortText({
      displayName: 'Remark Process Time',
      required: true,
    }),
    ciRmrkEffTme: Property.ShortText({
      displayName: 'Remark Effective Time',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCIRMRK/v4/remarks/${context.propsValue.ciApplCde}/${context.propsValue.ciApplNbr}/${context.propsValue.ciRmrkEffDte}/${context.propsValue.ciRmrkPrcsTme}/${context.propsValue.ciRmrkEffTme}`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Relationships.json
// ============================================

export const customer_get_relationships = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_relationships',
  displayName: 'Customer - Get Relationships',
  description: 'Retrieve customer relationships',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    applCode: Property.ShortText({
      displayName: 'Application Code',
      required: true,
    }),
    applNumber: Property.ShortText({
      displayName: 'Application Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCIRLT/v4/relationships/${context.propsValue.applCode}/${context.propsValue.applNumber}`,
      headers,
    });
    return response.body;
  },
});

export const customer_create_relationship = createAction({
  auth: fisIbsAuth,
  name: 'customer_create_relationship',
  displayName: 'Customer - Create Relationship',
  description: 'Create a new customer relationship',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    relationshipData: Property.Object({
      displayName: 'Relationship Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSCIRLT/v4/relationships`,
      headers,
      body: context.propsValue.relationshipData,
    });
    return response.body;
  },
});

export const customer_update_relationship = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_relationship',
  displayName: 'Customer - Update Relationship',
  description: 'Update a customer relationship',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    relationshipData: Property.Object({
      displayName: 'Relationship Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCIRLT/v4/relationships`,
      headers,
      body: context.propsValue.relationshipData,
    });
    return response.body;
  },
});

export const customer_delete_relationship = createAction({
  auth: fisIbsAuth,
  name: 'customer_delete_relationship',
  displayName: 'Customer - Delete Relationship',
  description: 'Delete a customer relationship',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    relationshipData: Property.Object({
      displayName: 'Relationship Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSCIRLT/v4/relationships`,
      headers,
      body: context.propsValue.relationshipData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Customer-Profile.json
// ============================================

export const customer_get_profile = createAction({
  auth: fisIbsAuth,
  name: 'customer_get_profile',
  displayName: 'Customer - Get Profile',
  description: 'Retrieve customer profile information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    customerNumber: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSCIPROF/v4/customers/${context.propsValue.customerNumber}/profile`,
      headers,
    });
    return response.body;
  },
});

export const customer_update_profile = createAction({
  auth: fisIbsAuth,
  name: 'customer_update_profile',
  displayName: 'Customer - Update Profile',
  description: 'Update customer profile information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    customerNumber: Property.ShortText({
      displayName: 'Customer Number',
      required: true,
    }),
    profileData: Property.Object({
      displayName: 'Profile Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSCIPROF/v4/customers/${context.propsValue.customerNumber}/profile`,
      headers,
      body: context.propsValue.profileData,
    });
    return response.body;
  },
});

// Export all customer actions
export const customerActions = [
  // Customer CRUD
  customer_get,
  customer_delete,
  customer_create_individual,
  customer_create_organization,
  customer_get_combined,
  customer_update_combined,

  // Account Management
  customer_accounts_address_edit,
  customer_accounts_delete,
  customer_accounts_get_name_address,
  customer_accounts_update_name_address,
  customer_accounts_create,
  customer_accounts_update_related_address,

  // Demographics
  customer_address_edit,
  customer_update_addresses,
  customer_get_aliases,
  customer_create_alias,
  customer_update_alias,
  customer_delete_alias,
  customer_get_due_diligence,
  customer_update_due_diligence,

  // Contact Information
  customer_get_email_addresses,
  customer_create_email_address,
  customer_delete_email_address,
  customer_get_phone_numbers,
  customer_create_phone_number,
  customer_update_phone_number,
  customer_delete_phone_number,

  // Search
  customer_search_by_name,
  customer_search_by_customer_number,
  customer_search_by_tax_number,
  customer_search_by_phone,
  customer_search_by_cip_id,

  // Combined Statements
  customer_get_statements,
  customer_create_combined_statement,
  customer_update_combined_statement,
  customer_delete_combined_statement,

  // Remarks
  customer_get_remarks,
  customer_create_remark,
  customer_update_remark,
  customer_delete_remark,

  // Relationships
  customer_get_relationships,
  customer_create_relationship,
  customer_update_relationship,
  customer_delete_relationship,

  // Profile
  customer_get_profile,
  customer_update_profile,
];
