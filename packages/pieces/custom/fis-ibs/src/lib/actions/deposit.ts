import { createAction, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisIbsAuth } from '../..';

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
// IBS-Deposit-Accounts.json
// ============================================

export const deposit_get_account = createAction({
  auth: fisIbsAuth,
  name: 'deposit_get_account',
  displayName: 'Deposit - Get Account',
  description: 'Retrieve deposit account information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSDPACCT/v4/accounts/${context.propsValue.acctNbr}`,
      headers,
    });
    return response.body;
  },
});

export const deposit_create_account = createAction({
  auth: fisIbsAuth,
  name: 'deposit_create_account',
  displayName: 'Deposit - Create Account',
  description: 'Create a new deposit account',
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
      url: `${auth.baseUrl}/IBSDPACCT/v4/accounts`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const deposit_update_account = createAction({
  auth: fisIbsAuth,
  name: 'deposit_update_account',
  displayName: 'Deposit - Update Account',
  description: 'Update a deposit account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
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
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSDPACCT/v4/accounts/${context.propsValue.acctNbr}`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const deposit_close_account = createAction({
  auth: fisIbsAuth,
  name: 'deposit_close_account',
  displayName: 'Deposit - Close Account',
  description: 'Close a deposit account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    closeData: Property.Object({
      displayName: 'Close Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPACCT/v4/accounts/${context.propsValue.acctNbr}/close`,
      headers,
      body: context.propsValue.closeData,
    });
    return response.body;
  },
});

export const deposit_get_balance = createAction({
  auth: fisIbsAuth,
  name: 'deposit_get_balance',
  displayName: 'Deposit - Get Balance',
  description: 'Retrieve deposit account balance',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSDPACCT/v4/accounts/${context.propsValue.acctNbr}/balance`,
      headers,
    });
    return response.body;
  },
});

export const deposit_get_interest_rates = createAction({
  auth: fisIbsAuth,
  name: 'deposit_get_interest_rates',
  displayName: 'Deposit - Get Interest Rates',
  description: 'Retrieve deposit account interest rates',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSDPACCT/v4/accounts/${context.propsValue.acctNbr}/interest-rates`,
      headers,
    });
    return response.body;
  },
});

export const deposit_update_interest_rates = createAction({
  auth: fisIbsAuth,
  name: 'deposit_update_interest_rates',
  displayName: 'Deposit - Update Interest Rates',
  description: 'Update deposit account interest rates',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    rateData: Property.Object({
      displayName: 'Rate Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSDPACCT/v4/accounts/${context.propsValue.acctNbr}/interest-rates`,
      headers,
      body: context.propsValue.rateData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Deposit-Transactions.json
// ============================================

export const deposit_get_transactions = createAction({
  auth: fisIbsAuth,
  name: 'deposit_get_transactions',
  displayName: 'Deposit - Get Transactions',
  description: 'Retrieve deposit account transactions',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    startDate: Property.ShortText({
      displayName: 'Start Date',
      description: 'YYYY-MM-DD format',
      required: false,
    }),
    endDate: Property.ShortText({
      displayName: 'End Date',
      description: 'YYYY-MM-DD format',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.startDate) params.append('startDate', context.propsValue.startDate);
    if (context.propsValue.endDate) params.append('endDate', context.propsValue.endDate);

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSDPTRAN/v4/accounts/${context.propsValue.acctNbr}/transactions${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

export const deposit_post_transaction = createAction({
  auth: fisIbsAuth,
  name: 'deposit_post_transaction',
  displayName: 'Deposit - Post Transaction',
  description: 'Post a transaction to a deposit account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    transactionData: Property.Object({
      displayName: 'Transaction Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPTRAN/v4/accounts/${context.propsValue.acctNbr}/transactions`,
      headers,
      body: context.propsValue.transactionData,
    });
    return response.body;
  },
});

export const deposit_reverse_transaction = createAction({
  auth: fisIbsAuth,
  name: 'deposit_reverse_transaction',
  displayName: 'Deposit - Reverse Transaction',
  description: 'Reverse a deposit account transaction',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    reversalData: Property.Object({
      displayName: 'Reversal Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPTRAN/v4/accounts/${context.propsValue.acctNbr}/reversals`,
      headers,
      body: context.propsValue.reversalData,
    });
    return response.body;
  },
});

export const deposit_transfer = createAction({
  auth: fisIbsAuth,
  name: 'deposit_transfer',
  displayName: 'Deposit - Transfer Funds',
  description: 'Transfer funds between deposit accounts',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    transferData: Property.Object({
      displayName: 'Transfer Data',
      description: 'Source account, destination account, and amount',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPTRAN/v4/transfers`,
      headers,
      body: context.propsValue.transferData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Deposits-Holds.json
// ============================================

export const deposit_get_holds = createAction({
  auth: fisIbsAuth,
  name: 'deposit_get_holds',
  displayName: 'Deposit - Get Holds',
  description: 'Retrieve deposit account holds',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSDPHLD/v4/accounts/${context.propsValue.acctNbr}/holds`,
      headers,
    });
    return response.body;
  },
});

export const deposit_create_hold = createAction({
  auth: fisIbsAuth,
  name: 'deposit_create_hold',
  displayName: 'Deposit - Create Hold',
  description: 'Create a hold on a deposit account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    holdData: Property.Object({
      displayName: 'Hold Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPHLD/v4/accounts/${context.propsValue.acctNbr}/holds`,
      headers,
      body: context.propsValue.holdData,
    });
    return response.body;
  },
});

export const deposit_update_hold = createAction({
  auth: fisIbsAuth,
  name: 'deposit_update_hold',
  displayName: 'Deposit - Update Hold',
  description: 'Update a hold on a deposit account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    holdData: Property.Object({
      displayName: 'Hold Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSDPHLD/v4/accounts/${context.propsValue.acctNbr}/holds`,
      headers,
      body: context.propsValue.holdData,
    });
    return response.body;
  },
});

export const deposit_release_hold = createAction({
  auth: fisIbsAuth,
  name: 'deposit_release_hold',
  displayName: 'Deposit - Release Hold',
  description: 'Release a hold on a deposit account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    holdId: Property.ShortText({
      displayName: 'Hold ID',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSDPHLD/v4/accounts/${context.propsValue.acctNbr}/holds/${context.propsValue.holdId}`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Deposit-Escrow-Sub-Accounts.json
// ============================================

export const deposit_get_escrow_accounts = createAction({
  auth: fisIbsAuth,
  name: 'deposit_get_escrow_accounts',
  displayName: 'Deposit - Get Escrow Sub-Accounts',
  description: 'Retrieve escrow sub-account information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSDPESC/v4/accounts/${context.propsValue.acctNbr}/escrow-sub-accounts`,
      headers,
    });
    return response.body;
  },
});

export const deposit_create_escrow_account = createAction({
  auth: fisIbsAuth,
  name: 'deposit_create_escrow_account',
  displayName: 'Deposit - Create Escrow Sub-Account',
  description: 'Create an escrow sub-account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    escrowData: Property.Object({
      displayName: 'Escrow Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPESC/v4/accounts/${context.propsValue.acctNbr}/escrow-sub-accounts`,
      headers,
      body: context.propsValue.escrowData,
    });
    return response.body;
  },
});

export const deposit_update_escrow_account = createAction({
  auth: fisIbsAuth,
  name: 'deposit_update_escrow_account',
  displayName: 'Deposit - Update Escrow Sub-Account',
  description: 'Update an escrow sub-account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    escrowData: Property.Object({
      displayName: 'Escrow Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSDPESC/v4/accounts/${context.propsValue.acctNbr}/escrow-sub-accounts`,
      headers,
      body: context.propsValue.escrowData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Deposit-Calculator.json
// ============================================

export const deposit_calculate = createAction({
  auth: fisIbsAuth,
  name: 'deposit_calculate',
  displayName: 'Deposit - Calculator',
  description: 'Calculate deposit interest, maturity, or other values',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    calculationData: Property.Object({
      displayName: 'Calculation Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPCALC/v4/calculate`,
      headers,
      body: context.propsValue.calculationData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Deposit-Origination.json
// ============================================

export const deposit_originate = createAction({
  auth: fisIbsAuth,
  name: 'deposit_originate',
  displayName: 'Deposit - Originate Account',
  description: 'Originate a new deposit account',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    originationData: Property.Object({
      displayName: 'Origination Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSDPORG/v4/originations`,
      headers,
      body: context.propsValue.originationData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Deposit-Maintenance.json
// ============================================

export const deposit_update_maintenance = createAction({
  auth: fisIbsAuth,
  name: 'deposit_update_maintenance',
  displayName: 'Deposit - Update Maintenance',
  description: 'Update deposit account maintenance settings',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    maintenanceData: Property.Object({
      displayName: 'Maintenance Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSDPMAINT/v4/accounts/${context.propsValue.acctNbr}/maintenance`,
      headers,
      body: context.propsValue.maintenanceData,
    });
    return response.body;
  },
});

// Export all deposit actions
export const depositActions = [
  // Account Management
  deposit_get_account,
  deposit_create_account,
  deposit_update_account,
  deposit_close_account,
  deposit_get_balance,
  deposit_get_interest_rates,
  deposit_update_interest_rates,

  // Transactions
  deposit_get_transactions,
  deposit_post_transaction,
  deposit_reverse_transaction,
  deposit_transfer,

  // Holds
  deposit_get_holds,
  deposit_create_hold,
  deposit_update_hold,
  deposit_release_hold,

  // Escrow
  deposit_get_escrow_accounts,
  deposit_create_escrow_account,
  deposit_update_escrow_account,

  // Calculator
  deposit_calculate,

  // Origination
  deposit_originate,

  // Maintenance
  deposit_update_maintenance,
];
