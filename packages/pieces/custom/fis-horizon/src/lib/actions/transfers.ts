import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

/**
 * Transfers - Automatic Transfer Inquiry Details
 * GET /accounts/{applicationCode}/{accountNumber}/transfers/{sequenceNumber}
 * Retrieve details for a specific automatic transfer.
 */
export const transfers_automatic_transfer_inquiry_details = createAction({
  name: 'transfers_automatic_transfer_inquiry_details',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Automatic Transfer Inquiry Details',
  description: 'Retrieve details for a specific automatic transfer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application Code for the account',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'GL - General Ledger', value: 'GL' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (max 17 digits, no decimals)',
      required: true,
    }),
    sequenceNumber: Property.Number({
      displayName: 'Sequence Number',
      description: 'Sequence Number (up to 3 numeric digits, no decimal places)',
      required: true,
    }),
    externalDebitCreditFlag: Property.StaticDropdown({
      displayName: 'External Debit/Credit Flag',
      description: 'Indicates if the transfer is external',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
          { label: 'Blank', value: '' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, applicationCode, accountNumber, sequenceNumber, externalDebitCreditFlag } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {};
    if (externalDebitCreditFlag !== undefined) {
      queryParams['externalDebitCreditFlag'] = String(externalDebitCreditFlag);
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/transfers/v1/accounts/${applicationCode}/${accountNumber}/transfers/${sequenceNumber}${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Transfers - Automatic Transfer Inquiry List
 * GET /accounts/{applicationCode}/{accountNumber}/transfers
 * Retrieve a list of automatic transfers.
 */
export const transfers_automatic_transfer_inquiry_list = createAction({
  name: 'transfers_automatic_transfer_inquiry_list',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Automatic Transfer Inquiry List',
  description: 'Retrieve a list of automatic transfers for an account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application Code for the account',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'CD - Certificate of Deposits', value: 'CD' },
          { label: 'IR - Retirement Account', value: 'IR' },
          { label: 'LN - Loan', value: 'LN' },
          { label: 'RR - Ready Reserve', value: 'RR' },
          { label: 'ML - Mortgage Loans', value: 'ML' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (max 17 digits, no decimals)',
      required: true,
    }),
    sortOrder: Property.StaticDropdown({
      displayName: 'Sort Order',
      description: 'Sort by Debit or Credit',
      required: true,
      options: {
        options: [
          { label: 'D - Debit', value: 'D' },
          { label: 'C - Credit', value: 'C' },
        ],
      },
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First or Next request for pagination',
      required: true,
      options: {
        options: [
          { label: 'F - First request', value: 'F' },
          { label: 'N - Next request', value: 'N' },
        ],
      },
    }),
    numberToReturn: Property.Number({
      displayName: 'Number to Return',
      description: 'The number of records to be returned in the response',
      required: true,
    }),
    sequenceNumber: Property.Number({
      displayName: 'Sequence Number',
      description: 'Optional: Sequence Number for pagination (up to 3 numeric digits)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, applicationCode, accountNumber, sortOrder, firstNext, numberToReturn, sequenceNumber } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {
      'sortOrder': sortOrder,
      'firstNext': firstNext,
      'numberToReturn': String(numberToReturn),
    }
    if (sequenceNumber !== undefined) {
      queryParams['sequenceNumber'] = String(sequenceNumber);
    }

    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/transfers/v1/accounts/${applicationCode}/${accountNumber}/transfers${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Transfers - Automatic Transfer Add
 * POST /debit-accounts/{debitApplication}/{debitAccount}/transfers
 * Add a new automatic transfer.
 */
export const transfers_automatic_transfer_add = createAction({
  name: 'transfers_automatic_transfer_add',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Automatic Transfer Add',
  description: 'Add a new automatic transfer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    debitApplication: Property.StaticDropdown({
      displayName: 'Debit Application',
      description: 'Debit Application Code',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    debitAccount: Property.ShortText({
      displayName: 'Debit Account Number',
      description: 'The Debit Account Number',
      required: true,
    }),
    creditApplicationCode: Property.StaticDropdown({
      displayName: 'Credit Application Code',
      description: 'Credit Application Code',
      required: true,
      options: {
        options: [
          { label: 'CD - Certificate of Deposits', value: 'CD' },
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'ML - Mortgage Loan', value: 'ML' },
          { label: 'LN - Loan', value: 'LN' },
          { label: 'IR - Retirement Account', value: 'IR' },
          { label: 'RR - Ready Reserve', value: 'RR' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    creditAccountNumber: Property.ShortText({
      displayName: 'Credit Account Number',
      description: 'Credit Account Number (max 17 characters)',
      required: true,
    }),
    transferAmount: Property.Number({
      displayName: 'Transfer Amount',
      description: 'Transfer Amount (up to 11 numeric digits including two decimal places)',
      required: false,
    }),
    startNextDate: Property.Number({
      displayName: 'Start/Next Date',
      description: 'Start/Next Transfer Date in CCYYMMDD format (e.g., 20240101)',
      required: true,
    }),
    endingDate: Property.Number({
      displayName: 'Ending Date',
      description: 'Ending Date in CCYYMMDD format (e.g., 20251231)',
      required: true,
    }),
    frequency: Property.Number({
      displayName: 'Frequency',
      description: 'Frequency (1-999)',
      required: true,
    }),
    frequencyCode: Property.StaticDropdown({
      displayName: 'Frequency Code',
      description: 'Frequency Code',
      required: true,
      options: {
        options: [
          { label: 'M - Months', value: 'M' },
          { label: 'D - Days', value: 'D' },
          { label: 'E - Month End', value: 'E' },
        ],
      },
    }),
    chargeInsufficientFee: Property.StaticDropdown({
      displayName: 'Charge Insufficient Fee',
      description: 'Charge Insufficient Fee',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    generalNotices: Property.StaticDropdown({
      displayName: 'General Notices',
      description: 'General Notices option',
      required: true,
      options: {
        options: [
          { label: 'T - To Account', value: 'T' },
          { label: 'F - From Account', value: 'F' },
          { label: 'B - Both', value: 'B' },
          { label: 'I - Insufficient', value: 'I' },
          { label: 'N - None', value: 'N' },
        ],
      },
    }),
    calculationOption: Property.StaticDropdown({
      displayName: 'Calculation Option',
      description: 'Calculation Option',
      required: true,
      options: {
        options: [
          { label: 'A - Calculate using transfer amount', value: 'A' },
          { label: 'T - Calculate using amortization term', value: 'T' },
        ],
      },
    }),
    overrideStartNextDate: Property.StaticDropdown({
      displayName: 'Override Start/Next Date',
      description: 'Override Start/Next Date',
      required: false,
      options: {
        options: [
          { label: 'Y - Override', value: 'Y' },
          { label: 'Blank - Do Not Override', value: '' },
        ],
      },
    }),
    debitTransactionCode: Property.Number({
      displayName: 'Debit Transaction Code',
      description: 'Debit Transaction Code (DD/SV: 57, 58, 59, 86, 91, 92, 97)',
      required: false,
    }),
    debitDescription: Property.ShortText({
      displayName: 'Debit Description',
      description: 'Debit Description (up to 30 characters)',
      required: false,
    }),
    creditTransactionCode: Property.Number({
      displayName: 'Credit Transaction Code',
      description: 'Credit Transaction Code (DD/SV: 22, 26, 27)',
      required: false,
    }),
    creditDescription: Property.ShortText({
      displayName: 'Credit Description',
      description: 'Credit Description (up to 30 characters)',
      required: false,
    }),
    holdTransfer: Property.StaticDropdown({
      displayName: 'Hold Transfer',
      description: 'Hold Transfer',
      required: false,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
          { label: 'O - Once', value: 'O' },
        ],
      },
    }),
    transferDescription: Property.ShortText({
      displayName: 'Transfer Description',
      description: 'User-entered description of the transfer (up to 40 characters)',
      required: false,
    }),
    externalDr: Property.StaticDropdown({
      displayName: 'External Debit',
      description: 'Indicates if the debit portion of the transfer is external',
      required: false,
      options: {
        options: [
          { label: 'Y - External', value: 'Y' },
          { label: 'N - Internal', value: 'N' },
        ],
      },
    }),
    externalCr: Property.StaticDropdown({
      displayName: 'External Credit',
      description: 'Indicates if the credit portion of the transfer is external',
      required: false,
      options: {
        options: [
          { label: 'Y - External', value: 'Y' },
          { label: 'N - Internal', value: 'N' },
        ],
      },
    }),
    additionalOptions: Property.Json({
      displayName: 'Additional Options',
      description: 'Additional transfer options as JSON (debitAccount, availableBalance, amortizationTransfers, loanOptions, external, etc.)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization, sourceId, debitApplication, debitAccount, creditApplicationCode, creditAccountNumber,
      transferAmount, startNextDate, endingDate, frequency, frequencyCode, chargeInsufficientFee,
      generalNotices, calculationOption, overrideStartNextDate, debitTransactionCode, debitDescription,
      creditTransactionCode, creditDescription, holdTransfer, transferDescription, externalDr, externalCr,
      additionalOptions
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      creditAccount: {
        creditApplicationCode: creditApplicationCode,
        creditAccountNumber: creditAccountNumber,
      },
      startNextDate: startNextDate,
      endingDate: endingDate,
      frequency: frequency,
      frequencyCode: frequencyCode,
      chargeInsufficientFee: chargeInsufficientFee,
      generalNotices: generalNotices,
      calculationOption: calculationOption,
    };

    if (transferAmount !== undefined) {
      body['transferAmount'] = transferAmount;
    }

    if (overrideStartNextDate) {
      body['overrideStartNextDate'] = overrideStartNextDate;
    }

    if (debitTransactionCode || debitDescription || externalDr) {
      const debitAccountObj: Record<string, unknown> = {};
      if (debitTransactionCode) debitAccountObj['debitTransactionCode'] = debitTransactionCode;
      if (debitDescription) debitAccountObj['debitDescription'] = debitDescription;
      if (externalDr) debitAccountObj['externalDr'] = externalDr;
      body['debitAccount'] = debitAccountObj;
    }

    if (creditTransactionCode || creditDescription || externalCr) {
      const creditAccountObj = body['creditAccount'] as Record<string, unknown>;
      if (creditTransactionCode) creditAccountObj['creditTransactionCode'] = creditTransactionCode;
      if (creditDescription) creditAccountObj['creditDescription'] = creditDescription;
      if (externalCr) creditAccountObj['externalCr'] = externalCr;
    }

    if (holdTransfer) {
      body['holdTransfer'] = holdTransfer;
    }

    if (transferDescription) {
      body['transferDescription'] = transferDescription;
    }

    if (additionalOptions && typeof additionalOptions === 'object') {
      Object.assign(body, additionalOptions);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/transfers/v1/debit-accounts/${debitApplication}/${debitAccount}/transfers`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Transfers - Automatic Transfer Change
 * PUT /debit-accounts/{debitApplication}/{debitAccount}/transfers/{sequenceNumber}
 * Maintain an automatic transfer.
 */
export const transfers_automatic_transfer_change = createAction({
  name: 'transfers_automatic_transfer_change',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Automatic Transfer Change',
  description: 'Maintain an automatic transfer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    debitApplication: Property.StaticDropdown({
      displayName: 'Debit Application',
      description: 'Debit Application Code',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    debitAccount: Property.ShortText({
      displayName: 'Debit Account Number',
      description: 'The Debit Account Number',
      required: true,
    }),
    sequenceNumber: Property.Number({
      displayName: 'Sequence Number',
      description: 'Sequence Number (up to 3 numeric digits, no decimal places)',
      required: true,
    }),
    originalDebitApplication: Property.StaticDropdown({
      displayName: 'Original Debit Application',
      description: 'Original Debit Application Code',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'LN - Loan', value: 'LN' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    originalDebitAccountNumber: Property.ShortText({
      displayName: 'Original Debit Account Number',
      description: 'Original Debit Account Number (must not be blank)',
      required: true,
    }),
    originalExternalDRFlag: Property.StaticDropdown({
      displayName: 'Original External DR Flag',
      description: 'Original External DR Flag (cannot change from Internal to External or vice versa)',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    originalSequenceNumber: Property.Number({
      displayName: 'Original Sequence Number',
      description: 'Original Sequence Number (up to 3 numeric digits)',
      required: true,
    }),
    creditApplicationCode: Property.StaticDropdown({
      displayName: 'Credit Application Code',
      description: 'Credit Application Code',
      required: true,
      options: {
        options: [
          { label: 'CD - Certificate of Deposits', value: 'CD' },
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'ML - Mortgage Loan', value: 'ML' },
          { label: 'LN - Loan', value: 'LN' },
          { label: 'IR - Retirement Account', value: 'IR' },
          { label: 'RR - Ready Reserve', value: 'RR' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    creditAccountNumber: Property.ShortText({
      displayName: 'Credit Account Number',
      description: 'Credit Account Number (max 17 characters)',
      required: true,
    }),
    startNextDate: Property.Number({
      displayName: 'Start/Next Date',
      description: 'Start/Next Transfer Date in CCYYMMDD format',
      required: true,
    }),
    endingDate: Property.Number({
      displayName: 'Ending Date',
      description: 'Ending Date in CCYYMMDD format',
      required: true,
    }),
    frequency: Property.Number({
      displayName: 'Frequency',
      description: 'Frequency (1-999)',
      required: true,
    }),
    frequencyCode: Property.StaticDropdown({
      displayName: 'Frequency Code',
      description: 'Frequency Code',
      required: true,
      options: {
        options: [
          { label: 'M - Months', value: 'M' },
          { label: 'D - Days', value: 'D' },
          { label: 'E - Month End', value: 'E' },
        ],
      },
    }),
    chargeInsufficientFee: Property.StaticDropdown({
      displayName: 'Charge Insufficient Fee',
      description: 'Charge Insufficient Fee',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    generalNotices: Property.StaticDropdown({
      displayName: 'General Notices',
      description: 'General Notices option',
      required: true,
      options: {
        options: [
          { label: 'T - To Account', value: 'T' },
          { label: 'F - From Account', value: 'F' },
          { label: 'B - Both', value: 'B' },
          { label: 'I - Insufficient', value: 'I' },
          { label: 'N - None', value: 'N' },
        ],
      },
    }),
    calculationOption: Property.StaticDropdown({
      displayName: 'Calculation Option',
      description: 'Calculation Option',
      required: true,
      options: {
        options: [
          { label: 'A - Calculate using transfer amount', value: 'A' },
          { label: 'T - Calculate using amortization term', value: 'T' },
        ],
      },
    }),
    transferAmount: Property.Number({
      displayName: 'Transfer Amount',
      description: 'Transfer Amount',
      required: false,
    }),
    additionalOptions: Property.Json({
      displayName: 'Additional Options',
      description: 'Additional transfer options as JSON (debitAccount, availableBalance, amortizationTransfers, loanOptions, external, etc.)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization, sourceId, debitApplication, debitAccount, sequenceNumber,
      originalDebitApplication, originalDebitAccountNumber, originalExternalDRFlag, originalSequenceNumber,
      creditApplicationCode, creditAccountNumber, startNextDate, endingDate, frequency, frequencyCode,
      chargeInsufficientFee, generalNotices, calculationOption, transferAmount, additionalOptions
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      originalDebitApplication: originalDebitApplication,
      originalDebitAccountNumber: originalDebitAccountNumber,
      originalExternalDRFlag: originalExternalDRFlag,
      originalSequenceNumber: originalSequenceNumber,
      creditAccount: {
        creditApplicationCode: creditApplicationCode,
        creditAccountNumber: creditAccountNumber,
      },
      startNextDate: startNextDate,
      endingDate: endingDate,
      frequency: frequency,
      frequencyCode: frequencyCode,
      chargeInsufficientFee: chargeInsufficientFee,
      generalNotices: generalNotices,
      calculationOption: calculationOption,
    };

    if (transferAmount !== undefined) {
      body['transferAmount'] = transferAmount;
    }

    if (additionalOptions && typeof additionalOptions === 'object') {
      Object.assign(body, additionalOptions);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/transfers/v1/debit-accounts/${debitApplication}/${debitAccount}/transfers/${sequenceNumber}`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Transfers - Automatic Transfer Delete
 * DELETE /debit-accounts/{debitApplication}/{debitAccount}/transfers/{sequenceNumber}
 * Delete an automatic transfer.
 */
export const transfers_automatic_transfer_delete = createAction({
  name: 'transfers_automatic_transfer_delete',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Automatic Transfer Delete',
  description: 'Delete an automatic transfer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    debitApplication: Property.StaticDropdown({
      displayName: 'Debit Application',
      description: 'Debit Application Code',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    debitAccount: Property.ShortText({
      displayName: 'Debit Account Number',
      description: 'The Debit Account Number',
      required: true,
    }),
    sequenceNumber: Property.Number({
      displayName: 'Sequence Number',
      description: 'Sequence Number (up to 3 numeric digits, no decimal places)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, debitApplication, debitAccount, sequenceNumber } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/transfers/v1/debit-accounts/${debitApplication}/${debitAccount}/transfers/${sequenceNumber}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Transfers - Dynamic Transfer Inquiry
 * GET /dynamic-transfers/{primaryApplication}/{primaryAccount}
 * Retrieve the details of a dynamic transfer for a given account.
 */
export const transfers_dynamic_transfer_inquiry = createAction({
  name: 'transfers_dynamic_transfer_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Dynamic Transfer Inquiry',
  description: 'Retrieve the details of a dynamic transfer for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    primaryApplication: Property.StaticDropdown({
      displayName: 'Primary Application',
      description: 'The Primary Account Application',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    primaryAccount: Property.ShortText({
      displayName: 'Primary Account',
      description: 'The Primary Account Number (right justified, zero filled, max 20 chars)',
      required: true,
    }),
    transferLevel: Property.ShortText({
      displayName: 'Transfer Level',
      description: 'The Processing Level within the Transfer Group (3 characters, e.g., 001)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, primaryApplication, primaryAccount, transferLevel } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {
      'transferLevel': transferLevel,
    };
    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/transfers/v1/dynamic-transfers/${primaryApplication}/${primaryAccount}${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Transfers - Dynamic Transfer Add
 * POST /dynamic-transfers/{primaryApplication}/{primaryAccount}
 * Add a new dynamic transfer relationship between given accounts.
 */
export const transfers_dynamic_transfer_add = createAction({
  name: 'transfers_dynamic_transfer_add',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Dynamic Transfer Add',
  description: 'Add a new dynamic transfer relationship between given accounts.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    primaryApplication: Property.StaticDropdown({
      displayName: 'Primary Application',
      description: 'The Primary Account Application',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    primaryAccount: Property.ShortText({
      displayName: 'Primary Account',
      description: 'The Primary Account Number (right justified, zero filled, max 20 chars)',
      required: true,
    }),
    modeCode: Property.StaticDropdown({
      displayName: 'Mode Code',
      description: 'Indicates the type of operation',
      required: true,
      options: {
        options: [
          { label: '1 - Add additional MM, EB, or AL Secondary Accounts', value: '1' },
          { label: '2 - Create a new MM and/or EB Transfer Relationship', value: '2' },
          { label: '3 - Create a New AL Transfer Relationship', value: '3' },
        ],
      },
    }),
    transferLevel: Property.ShortText({
      displayName: 'Transfer Level',
      description: 'The Processing Level within the Transfer Group (3 characters, e.g., 000). Mode 2 & 3: Must be Zero',
      required: true,
      defaultValue: '000',
    }),
    noticeOption: Property.StaticDropdown({
      displayName: 'Notice Option',
      description: 'Determines how to print Dynamic Transfer notices',
      required: false,
      options: {
        options: [
          { label: 'A - Primary and Secondary', value: 'A' },
          { label: 'N - None', value: 'N' },
          { label: 'P - Primary Only', value: 'P' },
          { label: 'S - Secondary Only', value: 'S' },
        ],
      },
    }),
    manualControlOrder: Property.StaticDropdown({
      displayName: 'Manual Control Order',
      description: 'Allows the bank to assume control of transfer processing order',
      required: false,
      options: {
        options: [
          { label: 'N - Let system determine and assign levels', value: 'N' },
          { label: 'Y - Force all levels to Level 0', value: 'Y' },
        ],
      },
    }),
    overrideWarnings: Property.StaticDropdown({
      displayName: 'Override Warnings',
      description: 'Override warning messages',
      required: false,
      options: {
        options: [
          { label: '0 - No', value: 0 },
          { label: '1 - Yes', value: 1 },
        ],
      },
    }),
    transferGroup: Property.ShortText({
      displayName: 'Transfer Group',
      description: 'Transfer Group description (leave blank for system to assign)',
      required: false,
    }),
    expirationDate: Property.ShortText({
      displayName: 'Expiration Date',
      description: 'Expiration Date in CCYYMMDD format (e.g., 20501231)',
      required: false,
    }),
    primaryProcessingSequence: Property.ShortText({
      displayName: 'Primary Processing Sequence',
      description: 'Primary Processing Sequence (5 chars, right justified, zero filled)',
      required: false,
    }),
    numberOfMaintainMinimumAccounts: Property.Number({
      displayName: 'Number of Maintain Minimum Accounts',
      description: 'Number of Maintain Minimum Secondary accounts (0-99)',
      required: false,
    }),
    numberOfExcessBalanceAtLastAccounts: Property.Number({
      displayName: 'Number of Excess Balance/At-Last Accounts',
      description: 'Number of Excess Balance/At-Last Secondary accounts (0-99)',
      required: false,
    }),
    maintainMinimum: Property.Json({
      displayName: 'Maintain Minimum Control',
      description: 'Maintain Minimum Control settings as JSON (balanceThreshold, primaryBalanceCalculatedOption, incrementExceptionOption, thresholdExceptionOption, primaryServiceOption)',
      required: false,
    }),
    excessBalanceAtLast: Property.Json({
      displayName: 'Excess Balance/At-Last Control',
      description: 'Excess Balance/At-Last Control settings as JSON (triggerThreshold, targetBalance, primaryBalanceCalculatedOption, primaryServiceOption)',
      required: false,
    }),
    maintainMinimumDetail: Property.Json({
      displayName: 'Maintain Minimum Detail',
      description: 'Array of Maintain Minimum Secondary account details',
      required: false,
    }),
    excessBalanceAtLastDetail: Property.Json({
      displayName: 'Excess Balance/At-Last Detail',
      description: 'Array of Excess Balance/At-Last Secondary account details',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization, sourceId, primaryApplication, primaryAccount, modeCode, transferLevel,
      noticeOption, manualControlOrder, overrideWarnings, transferGroup, expirationDate,
      primaryProcessingSequence, numberOfMaintainMinimumAccounts, numberOfExcessBalanceAtLastAccounts,
      maintainMinimum, excessBalanceAtLast, maintainMinimumDetail, excessBalanceAtLastDetail
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      modeCode: modeCode,
      transferLevel: transferLevel,
    };
    if (noticeOption) body['noticeOption'] = noticeOption;
    if (manualControlOrder) body['manualControlOrder'] = manualControlOrder;
    if (overrideWarnings !== undefined) body['overrideWarnings'] = overrideWarnings;
    if (transferGroup) body['transferGroup'] = transferGroup;
    if (expirationDate) body['expirationDate'] = expirationDate;
    if (primaryProcessingSequence) body['primaryProcessingSequence'] = primaryProcessingSequence;
    if (numberOfMaintainMinimumAccounts !== undefined) body['numberOfMaintainMinimumAccounts'] = numberOfMaintainMinimumAccounts;
    if (numberOfExcessBalanceAtLastAccounts !== undefined) body['numberOfExcessBalanceAtLastAccounts'] = numberOfExcessBalanceAtLastAccounts;
    if (maintainMinimum) body['maintainMinimum'] = maintainMinimum;
    if (excessBalanceAtLast) body['excessBalanceAtLast'] = excessBalanceAtLast;
    if (maintainMinimumDetail) body['maintainMinimumDetail'] = maintainMinimumDetail;
    if (excessBalanceAtLastDetail) body['excessBalanceAtLastDetail'] = excessBalanceAtLastDetail;

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/transfers/v1/dynamic-transfers/${primaryApplication}/${primaryAccount}`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Transfers - Dynamic Transfer Change
 * PUT /dynamic-transfers/{primaryApplication}/{primaryAccount}
 * Maintain a dynamic transfer relationship between given accounts.
 */
export const transfers_dynamic_transfer_change = createAction({
  name: 'transfers_dynamic_transfer_change',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Dynamic Transfer Change',
  description: 'Maintain a dynamic transfer relationship between given accounts.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    primaryApplication: Property.StaticDropdown({
      displayName: 'Primary Application',
      description: 'The Primary Account Application',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    primaryAccount: Property.ShortText({
      displayName: 'Primary Account',
      description: 'The Primary Account Number (right justified, zero filled, max 20 chars)',
      required: true,
    }),
    transferLevel: Property.ShortText({
      displayName: 'Transfer Level',
      description: 'The Processing Level within the Transfer Group (3 characters)',
      required: true,
    }),
    noticeOption: Property.StaticDropdown({
      displayName: 'Notice Option',
      description: 'Determines how to print Dynamic Transfer notices',
      required: false,
      options: {
        options: [
          { label: 'A - Primary and Secondary', value: 'A' },
          { label: 'N - None', value: 'N' },
          { label: 'P - Primary Only', value: 'P' },
          { label: 'S - Secondary Only', value: 'S' },
        ],
      },
    }),
    manualControlOrder: Property.StaticDropdown({
      displayName: 'Manual Control Order',
      description: 'Allows the bank to assume control of transfer processing order',
      required: false,
      options: {
        options: [
          { label: 'N - Let system determine and assign levels', value: 'N' },
          { label: 'Y - Force all levels to Level 0', value: 'Y' },
        ],
      },
    }),
    overrideWarnings: Property.StaticDropdown({
      displayName: 'Override Warnings',
      description: 'Override warning messages',
      required: false,
      options: {
        options: [
          { label: '0 - No', value: 0 },
          { label: '1 - Yes', value: 1 },
        ],
      },
    }),
    transferGroup: Property.ShortText({
      displayName: 'Transfer Group',
      description: 'Transfer Group description',
      required: false,
    }),
    expirationDate: Property.ShortText({
      displayName: 'Expiration Date',
      description: 'Expiration Date in CCYYMMDD format',
      required: false,
    }),
    primaryProcessingSequence: Property.ShortText({
      displayName: 'Primary Processing Sequence',
      description: 'Primary Processing Sequence (5 chars, right justified, zero filled)',
      required: false,
    }),
    numberOfMaintainMinimumAccounts: Property.Number({
      displayName: 'Number of Maintain Minimum Accounts',
      description: 'Number of Maintain Minimum Secondary accounts (0-99)',
      required: false,
    }),
    numberOfExcessBalanceAtLastAccounts: Property.Number({
      displayName: 'Number of Excess Balance/At-Last Accounts',
      description: 'Number of Excess Balance/At-Last Secondary accounts (0-99)',
      required: false,
    }),
    maintainMinimum: Property.Json({
      displayName: 'Maintain Minimum Control',
      description: 'Maintain Minimum Control settings as JSON',
      required: false,
    }),
    excessBalanceAtLast: Property.Json({
      displayName: 'Excess Balance/At-Last Control',
      description: 'Excess Balance/At-Last Control settings as JSON',
      required: false,
    }),
    maintainMinimumDetail: Property.Json({
      displayName: 'Maintain Minimum Detail',
      description: 'Array of Maintain Minimum Secondary account details',
      required: false,
    }),
    excessBalanceAtLastDetail: Property.Json({
      displayName: 'Excess Balance/At-Last Detail',
      description: 'Array of Excess Balance/At-Last Secondary account details',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization, sourceId, primaryApplication, primaryAccount, transferLevel,
      noticeOption, manualControlOrder, overrideWarnings, transferGroup, expirationDate,
      primaryProcessingSequence, numberOfMaintainMinimumAccounts, numberOfExcessBalanceAtLastAccounts,
      maintainMinimum, excessBalanceAtLast, maintainMinimumDetail, excessBalanceAtLastDetail
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      transferLevel: transferLevel,
    };
    if (noticeOption) body['noticeOption'] = noticeOption;
    if (manualControlOrder) body['manualControlOrder'] = manualControlOrder;
    if (overrideWarnings !== undefined) body['overrideWarnings'] = overrideWarnings;
    if (transferGroup) body['transferGroup'] = transferGroup;
    if (expirationDate) body['expirationDate'] = expirationDate;
    if (primaryProcessingSequence) body['primaryProcessingSequence'] = primaryProcessingSequence;
    if (numberOfMaintainMinimumAccounts !== undefined) body['numberOfMaintainMinimumAccounts'] = numberOfMaintainMinimumAccounts;
    if (numberOfExcessBalanceAtLastAccounts !== undefined) body['numberOfExcessBalanceAtLastAccounts'] = numberOfExcessBalanceAtLastAccounts;
    if (maintainMinimum) body['maintainMinimum'] = maintainMinimum;
    if (excessBalanceAtLast) body['excessBalanceAtLast'] = excessBalanceAtLast;
    if (maintainMinimumDetail) body['maintainMinimumDetail'] = maintainMinimumDetail;
    if (excessBalanceAtLastDetail) body['excessBalanceAtLastDetail'] = excessBalanceAtLastDetail;

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/transfers/v1/dynamic-transfers/${primaryApplication}/${primaryAccount}`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Transfers - Dynamic Transfer Delete
 * DELETE /dynamic-transfers/{primaryApplication}/{primaryAccount}
 * Delete a dynamic transfer relationship between given accounts.
 */
export const transfers_dynamic_transfer_delete = createAction({
  name: 'transfers_dynamic_transfer_delete',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Dynamic Transfer Delete',
  description: 'Delete a dynamic transfer relationship between given accounts.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    primaryApplication: Property.StaticDropdown({
      displayName: 'Primary Application',
      description: 'The Primary Account Application',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    primaryAccount: Property.ShortText({
      displayName: 'Primary Account',
      description: 'The Primary Account Number',
      required: true,
    }),
    deleteMode: Property.StaticDropdown({
      displayName: 'Delete Mode',
      description: 'Indicates if deleting a single account or entire relationship',
      required: true,
      options: {
        options: [
          { label: '1 - Delete Single Account', value: 1 },
          { label: '2 - Delete Entire Relationship', value: 2 },
        ],
      },
    }),
    transferLevel: Property.ShortText({
      displayName: 'Transfer Level',
      description: 'The transfer level (3 characters)',
      required: true,
    }),
    transferType: Property.StaticDropdown({
      displayName: 'Transfer Type',
      description: 'Transfer Type (for Delete Single Secondary Mode Only)',
      required: true,
      options: {
        options: [
          { label: 'MM - Maintain Minimum', value: 'MM' },
          { label: 'EB - Excess Balance', value: 'EB' },
          { label: 'AL - At-Last Excess Balance', value: 'AL' },
        ],
      },
    }),
    secondaryApplication: Property.StaticDropdown({
      displayName: 'Secondary Application',
      description: 'Secondary Application (for Delete Single Secondary Mode Only)',
      required: false,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
          { label: 'RR - Ready Reserve', value: 'RR' },
        ],
      },
    }),
    secondaryAccount: Property.ShortText({
      displayName: 'Secondary Account',
      description: 'Secondary Account Number (for Delete Single Secondary Mode Only)',
      required: false,
    }),
    overrideWarnings: Property.StaticDropdown({
      displayName: 'Override Warnings',
      description: 'Override warning messages',
      required: false,
      options: {
        options: [
          { label: '0 - No', value: 0 },
          { label: '1 - Yes', value: 1 },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization, sourceId, primaryApplication, primaryAccount, deleteMode,
      transferLevel, transferType, secondaryApplication, secondaryAccount, overrideWarnings
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {
      'deleteMode': String(deleteMode),
      'transferLevel': transferLevel,
      'transferType': transferType,
    }
    if (secondaryApplication) {
      queryParams['secondaryApplication'] = secondaryApplication;
    }
    if (secondaryAccount) {
      queryParams['secondaryAccount'] = secondaryAccount;
    }
    if (overrideWarnings !== undefined) {
      queryParams['overrideWarnings'] = String(overrideWarnings);
    }

    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/transfers/v1/dynamic-transfers/${primaryApplication}/${primaryAccount}${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Transfers - Dynamic Transfer Search
 * GET /dynamic-transfers/list
 * Retrieve a list of dynamic transfers based on search criteria.
 */
export const transfers_dynamic_transfer_search = createAction({
  name: 'transfers_dynamic_transfer_search',
  auth: fisHorizonAuth,
  displayName: 'Transfers - Dynamic Transfer Search',
  description: 'Retrieve a list of dynamic transfers based on search criteria.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    transferGroup: Property.ShortText({
      displayName: 'Transfer Group',
      description: 'Transfer group filter. Wild Card Search Example: Jones* or *Jones*',
      required: false,
    }),
    transferLevel: Property.StaticDropdown({
      displayName: 'Transfer Level',
      description: 'Transfer level filter',
      required: false,
      options: {
        options: [
          { label: 'All levels', value: ' ' },
          { label: '000 - Level 0 (Manual Control)', value: '000' },
          { label: '001 - Level 1 relationships', value: '001' },
          { label: '002 - Level 2 relationships', value: '002' },
          { label: '003 - Level 3 relationships', value: '003' },
          { label: '004 - Level 4 relationships', value: '004' },
          { label: '005 - Level 5 relationships', value: '005' },
          { label: '006 - Level 6 relationships', value: '006' },
          { label: '007 - Level 7 relationships', value: '007' },
          { label: '008 - Level 8 relationships', value: '008' },
          { label: '009 - Level 9 relationships', value: '009' },
          { label: '999 - Level 999 (At-Last)', value: '999' },
        ],
      },
    }),
    transferType: Property.StaticDropdown({
      displayName: 'Transfer Type',
      description: 'Transfer type filter',
      required: false,
      options: {
        options: [
          { label: 'All Transfer Types', value: ' ' },
          { label: 'MM - Maintain Min', value: 'MM' },
          { label: 'EB - Excess Bal', value: 'EB' },
          { label: 'AL - At-Last Excess Bal', value: 'AL' },
        ],
      },
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Primary or secondary application filter',
      required: false,
      options: {
        options: [
          { label: 'All Applications', value: ' ' },
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'RR - Ready Reserve', value: 'RR' },
          { label: 'LN - Loan', value: 'LN' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Primary or secondary account filter (max 20 chars)',
      required: false,
    }),
    category: Property.StaticDropdown({
      displayName: 'Category',
      description: 'Transfer category filter',
      required: false,
      options: {
        options: [
          { label: 'All Categories', value: ' ' },
          { label: 'ODP - Overdraft Protection', value: 'ODP' },
          { label: 'ZBA - Zero Balance Account', value: 'ZBA' },
          { label: 'Sweep - Sweep Account', value: 'Sweep' },
        ],
      },
    }),
    showEntireTransferGroup: Property.StaticDropdown({
      displayName: 'Show Entire Transfer Group',
      description: 'Show all transfers in the group if at least one meets the criteria',
      required: false,
      options: {
        options: [
          { label: 'N - Show only transfers that meet search criteria', value: 'N' },
          { label: 'Y - Show all transfers in the group', value: 'Y' },
        ],
      },
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'The RMS key of the Selected Customer (blank for all customers)',
      required: false,
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-20)',
      required: false,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First or Next request for pagination',
      required: false,
      options: {
        options: [
          { label: 'Blank - Error Check Filters only', value: ' ' },
          { label: 'F - Send First set of Records', value: 'F' },
          { label: 'N - Send Next Set of Records', value: 'N' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization, sourceId, transferGroup, transferLevel, transferType,
      applicationCode, accountNumber, category, showEntireTransferGroup,
      customerId, returnNumber, firstNext
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {};

    if (transferGroup) queryParams['transferGroup'] = transferGroup;
    if (transferLevel) queryParams['transferLevel'] = transferLevel;
    if (transferType) queryParams['transferType'] = transferType;
    if (applicationCode) queryParams['applicationCode'] = applicationCode;
    if (accountNumber) queryParams['accountNumber'] = accountNumber;
    if (category) queryParams['category'] = category;
    if (showEntireTransferGroup) queryParams['showEntireTransferGroup'] = showEntireTransferGroup;
    if (customerId) queryParams['customerId'] = customerId;
    if (returnNumber !== undefined) queryParams['returnNumber'] = String(returnNumber);
    if (firstNext) queryParams['firstNext'] = firstNext;

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/transfers/v1/dynamic-transfers/list${queryString}`,
      headers,
    });

    return response.body;
  },
});
