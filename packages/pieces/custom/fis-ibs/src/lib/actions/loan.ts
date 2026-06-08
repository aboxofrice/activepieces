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
// IBS-Loan-Accounts.json
// ============================================

export const loan_get_account = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_account',
  displayName: 'Loan - Get Account',
  description: 'Retrieve loan account information',
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
      url: `${auth.baseUrl}/IBSLNACCT/v4/accounts/${context.propsValue.acctNbr}`,
      headers,
    });
    return response.body;
  },
});

export const loan_create_account = createAction({
  auth: fisIbsAuth,
  name: 'loan_create_account',
  displayName: 'Loan - Create Account',
  description: 'Create a new loan account',
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
      url: `${auth.baseUrl}/IBSLNACCT/v4/accounts`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

export const loan_update_account = createAction({
  auth: fisIbsAuth,
  name: 'loan_update_account',
  displayName: 'Loan - Update Account',
  description: 'Update a loan account',
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
      url: `${auth.baseUrl}/IBSLNACCT/v4/accounts/${context.propsValue.acctNbr}`,
      headers,
      body: context.propsValue.accountData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Notes.json
// ============================================

export const loan_get_notes = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_notes',
  displayName: 'Loan - Get Notes',
  description: 'Retrieve loan notes',
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
      url: `${auth.baseUrl}/IBSLNNOTE/v4/accounts/${context.propsValue.acctNbr}/notes`,
      headers,
    });
    return response.body;
  },
});

export const loan_create_note = createAction({
  auth: fisIbsAuth,
  name: 'loan_create_note',
  displayName: 'Loan - Create Note',
  description: 'Create a new loan note',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteData: Property.Object({
      displayName: 'Note Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNNOTE/v4/accounts/${context.propsValue.acctNbr}/notes`,
      headers,
      body: context.propsValue.noteData,
    });
    return response.body;
  },
});

export const loan_get_note_balances = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_note_balances',
  displayName: 'Loan - Get Note Balances',
  description: 'Retrieve loan note balances',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSLNNOTE/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/balances`,
      headers,
    });
    return response.body;
  },
});

export const loan_renew_note = createAction({
  auth: fisIbsAuth,
  name: 'loan_renew_note',
  displayName: 'Loan - Renew Note',
  description: 'Renew a loan note',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    renewalData: Property.Object({
      displayName: 'Renewal Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNNOTE/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/renewals`,
      headers,
      body: context.propsValue.renewalData,
    });
    return response.body;
  },
});

export const loan_increase_note = createAction({
  auth: fisIbsAuth,
  name: 'loan_increase_note',
  displayName: 'Loan - Increase Note',
  description: 'Increase a loan note amount',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    increaseData: Property.Object({
      displayName: 'Increase Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNNOTE/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/increase`,
      headers,
      body: context.propsValue.increaseData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Payments.json
// ============================================

export const loan_get_payment_info = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_payment_info',
  displayName: 'Loan - Get Payment Info',
  description: 'Retrieve loan payment information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSLNPMT/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/payments`,
      headers,
    });
    return response.body;
  },
});

export const loan_post_payment = createAction({
  auth: fisIbsAuth,
  name: 'loan_post_payment',
  displayName: 'Loan - Post Payment',
  description: 'Post a loan payment',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    paymentData: Property.Object({
      displayName: 'Payment Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNPMT/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/payments`,
      headers,
      body: context.propsValue.paymentData,
    });
    return response.body;
  },
});

export const loan_reverse_payment = createAction({
  auth: fisIbsAuth,
  name: 'loan_reverse_payment',
  displayName: 'Loan - Reverse Payment',
  description: 'Reverse a loan payment',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
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
      url: `${auth.baseUrl}/IBSLNPMT/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/reversals`,
      headers,
      body: context.propsValue.reversalData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Collateral.json
// ============================================

export const loan_get_collateral = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_collateral',
  displayName: 'Loan - Get Collateral',
  description: 'Retrieve loan collateral information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSLNCOLL/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/multiple-collateral`,
      headers,
    });
    return response.body;
  },
});

export const loan_create_collateral = createAction({
  auth: fisIbsAuth,
  name: 'loan_create_collateral',
  displayName: 'Loan - Create Collateral',
  description: 'Add collateral to a loan note',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    collateralData: Property.Object({
      displayName: 'Collateral Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNCOLL/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/collateral`,
      headers,
      body: context.propsValue.collateralData,
    });
    return response.body;
  },
});

export const loan_update_collateral = createAction({
  auth: fisIbsAuth,
  name: 'loan_update_collateral',
  displayName: 'Loan - Update Collateral',
  description: 'Update loan collateral',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    seqNbr: Property.ShortText({
      displayName: 'Sequence Number',
      required: true,
    }),
    collateralData: Property.Object({
      displayName: 'Collateral Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSLNCOLL/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/collateral/${context.propsValue.seqNbr}`,
      headers,
      body: context.propsValue.collateralData,
    });
    return response.body;
  },
});

export const loan_delete_collateral = createAction({
  auth: fisIbsAuth,
  name: 'loan_delete_collateral',
  displayName: 'Loan - Delete Collateral',
  description: 'Remove collateral from a loan note',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    seqNbr: Property.ShortText({
      displayName: 'Sequence Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${auth.baseUrl}/IBSLNCOLL/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/collateral/${context.propsValue.seqNbr}`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Fees.json
// ============================================

export const loan_get_fees = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_fees',
  displayName: 'Loan - Get Fees',
  description: 'Retrieve loan fee information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSLNFEE/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/fees`,
      headers,
    });
    return response.body;
  },
});

export const loan_create_fee = createAction({
  auth: fisIbsAuth,
  name: 'loan_create_fee',
  displayName: 'Loan - Create Fee',
  description: 'Add a fee to a loan note',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    feeData: Property.Object({
      displayName: 'Fee Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNFEE/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/fees`,
      headers,
      body: context.propsValue.feeData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Payoffs.json
// ============================================

export const loan_get_payoff_quote = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_payoff_quote',
  displayName: 'Loan - Get Payoff Quote',
  description: 'Get a payoff quote for a loan',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    payoffDate: Property.ShortText({
      displayName: 'Payoff Date',
      description: 'YYYY-MM-DD format',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.payoffDate) params.append('payoffDate', context.propsValue.payoffDate);

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSLNPOFF/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/payoff-quote${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

export const loan_payoff = createAction({
  auth: fisIbsAuth,
  name: 'loan_payoff',
  displayName: 'Loan - Payoff',
  description: 'Pay off a loan',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    payoffData: Property.Object({
      displayName: 'Payoff Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNPOFF/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/payoff`,
      headers,
      body: context.propsValue.payoffData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Rate-Changes.json
// ============================================

export const loan_change_rate_immediate = createAction({
  auth: fisIbsAuth,
  name: 'loan_change_rate_immediate',
  displayName: 'Loan - Change Rate (Immediate)',
  description: 'Immediately change the interest rate on a loan',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
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
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNRATE/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/rate-changes-immediate`,
      headers,
      body: context.propsValue.rateData,
    });
    return response.body;
  },
});

export const loan_get_pending_rate_changes = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_pending_rate_changes',
  displayName: 'Loan - Get Pending Rate Changes',
  description: 'Get pending rate changes for a loan',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSLNRATE/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/rate-changes-pending`,
      headers,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Note-Transactions.json
// ============================================

export const loan_get_transactions = createAction({
  auth: fisIbsAuth,
  name: 'loan_get_transactions',
  displayName: 'Loan - Get Transactions',
  description: 'Get loan note transactions',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSLNTRAN/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/transactions`,
      headers,
    });
    return response.body;
  },
});

export const loan_disburse = createAction({
  auth: fisIbsAuth,
  name: 'loan_disburse',
  displayName: 'Loan - Disburse',
  description: 'Disburse funds from a loan',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    acctNbr: Property.ShortText({
      displayName: 'Account Number',
      required: true,
    }),
    noteNbr: Property.ShortText({
      displayName: 'Note Number',
      required: true,
    }),
    disbursementData: Property.Object({
      displayName: 'Disbursement Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNTRAN/v4/accounts/${context.propsValue.acctNbr}/notes/${context.propsValue.noteNbr}/disbursement`,
      headers,
      body: context.propsValue.disbursementData,
    });
    return response.body;
  },
});

// ============================================
// IBS-Loan-Boarding.json
// ============================================

export const loan_board = createAction({
  auth: fisIbsAuth,
  name: 'loan_board',
  displayName: 'Loan - Board Loan',
  description: 'Board a new loan into the system',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      required: false,
    }),
    loanData: Property.Object({
      displayName: 'Loan Data',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${auth.baseUrl}/IBSLNBOARD/v4/loans`,
      headers,
      body: context.propsValue.loanData,
    });
    return response.body;
  },
});

// Export all loan actions
export const loanActions = [
  // Account Management
  loan_get_account,
  loan_create_account,
  loan_update_account,

  // Notes
  loan_get_notes,
  loan_create_note,
  loan_get_note_balances,
  loan_renew_note,
  loan_increase_note,

  // Payments
  loan_get_payment_info,
  loan_post_payment,
  loan_reverse_payment,

  // Collateral
  loan_get_collateral,
  loan_create_collateral,
  loan_update_collateral,
  loan_delete_collateral,

  // Fees
  loan_get_fees,
  loan_create_fee,

  // Payoffs
  loan_get_payoff_quote,
  loan_payoff,

  // Rate Changes
  loan_change_rate_immediate,
  loan_get_pending_rate_changes,

  // Transactions
  loan_get_transactions,
  loan_disburse,

  // Boarding
  loan_board,
];
