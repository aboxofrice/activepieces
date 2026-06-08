import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// Base URL path for Time Deposit API
const API_PATH = '/time-deposit/v1';

/**
 * Retrieve basic information relating to a Time Deposit account
 */
export const time_deposit_account_inquiry = createAction({
  name: 'time_deposit_account_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Account Inquiry',
  description: 'Retrieve basic information relating to a Time Deposit account (Certificate of Deposit or Retirement)',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application type',
      required: true,
      options: {
        options: [
          { label: 'CD - Certificates of Deposit', value: 'CD' },
          { label: 'IR - Retirement', value: 'IR' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (up to 20 characters)',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Optional: Customer ID, right-justified, zero filled (up to 14 digits)',
      required: false,
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Whether to return data in uppercase',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const queryParams: Record<string, string> = {};
    if (props.customerId) {
      queryParams['customerId'] = props.customerId;
    }
    if (props.returnUppercase) {
      queryParams['returnUppercase'] = props.returnUppercase;
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}${API_PATH}/accounts/${props.applicationCode}/${props.accountNumber}${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Retrieve a list of historic transactions relating to an account
 */
export const time_deposit_transaction_inquiry = createAction({
  name: 'time_deposit_transaction_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Transaction Inquiry',
  description: 'Retrieve a list of historic transactions for a Time Deposit account',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application type',
      required: true,
      options: {
        options: [
          { label: 'CD - Certificates of Deposit', value: 'CD' },
          { label: 'IR - Retirement', value: 'IR' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (up to 20 characters)',
      required: true,
    }),
    dateSelectOption: Property.StaticDropdown({
      displayName: 'Date Select Option',
      description: 'Option for date selection',
      required: false,
      options: {
        options: [
          { label: 'B - Both current and history', value: 'B' },
          { label: 'C - Current only', value: 'C' },
          { label: 'H - History only', value: 'H' },
        ],
      },
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'Indicates first or next page of results',
      required: false,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    numberToReturn: Property.Number({
      displayName: 'Number To Return',
      description: 'Number of records to return (1-999)',
      required: false,
    }),
    beginDate: Property.ShortText({
      displayName: 'Begin Date',
      description: 'Begin date for transaction search (MMDDYY)',
      required: false,
    }),
    endDate: Property.ShortText({
      displayName: 'End Date',
      description: 'End date for transaction search (MMDDYY)',
      required: false,
    }),
    returnMemoPostTransaction: Property.StaticDropdown({
      displayName: 'Return Memo Post Transactions',
      description: 'Whether to return memo post transactions',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    returnPackagePostItems: Property.StaticDropdown({
      displayName: 'Return Package Post Items',
      description: 'Whether to return package post items',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    returnScheduledExternalTransfers: Property.StaticDropdown({
      displayName: 'Return Scheduled External Transfers',
      description: 'Whether to return scheduled external transfers',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    sequenceOption: Property.StaticDropdown({
      displayName: 'Sequence Option',
      description: 'Sort order for transactions',
      required: false,
      options: {
        options: [
          { label: 'A - Ascending', value: 'A' },
          { label: 'D - Descending', value: 'D' },
        ],
      },
    }),
    searchToken: Property.ShortText({
      displayName: 'Search Token',
      description: 'Token for pagination (from previous response)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const queryParams: Record<string, string> = {};
    if (props.dateSelectOption) {
      queryParams['dateSelectOption'] = props.dateSelectOption;
    }
    if (props.firstNext) {
      queryParams['firstNext'] = props.firstNext;
    }
    if (props.numberToReturn !== undefined && props.numberToReturn !== null) {
      queryParams['numberToReturn'] = props.numberToReturn.toString();
    }
    if (props.beginDate) {
      queryParams['beginDate'] = props.beginDate;
    }
    if (props.endDate) {
      queryParams['endDate'] = props.endDate;
    }
    if (props.returnMemoPostTransaction) {
      queryParams['returnMemoPostTransaction'] = props.returnMemoPostTransaction;
    }
    if (props.returnPackagePostItems) {
      queryParams['returnPackagePostItems'] = props.returnPackagePostItems;
    }
    if (props.returnScheduledExternalTransfers) {
      queryParams['returnScheduledExternalTransfers'] = props.returnScheduledExternalTransfers;
    }
    if (props.sequenceOption) {
      queryParams['sequenceOption'] = props.sequenceOption;
    }
    if (props.searchToken) {
      queryParams['searchToken'] = props.searchToken;
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}${API_PATH}/accounts/${props.applicationCode}/${props.accountNumber}/transactions${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Retrieve a Certificate or IRA renewal
 */
export const time_deposit_renewal_inquiry = createAction({
  name: 'time_deposit_renewal_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Renewal Inquiry',
  description: 'Retrieve a Certificate or IRA renewal information',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number, right justified zero filled (up to 15 digits)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application type',
      required: true,
      options: {
        options: [
          { label: 'C - Certificates', value: 'C' },
          { label: 'R - IRA', value: 'R' },
        ],
      },
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'Optional: Account holder user ID (up to 10 digits)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const queryParams: Record<string, string> = {
      applicationCode: props.applicationCode,
    };
    if (props.userId) {
      queryParams['userId'] = props.userId;
    }

    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/${props.accountNumber}/renewals${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Add a certificate or IRA renewal
 */
export const time_deposit_renewal_add = createAction({
  name: 'time_deposit_renewal_add',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Add Renewal',
  description: 'Add a certificate or IRA renewal',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number, right justified zero filled (up to 15 digits)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application type',
      required: true,
      options: {
        options: [
          { label: 'C - Certificate', value: 'C' },
          { label: 'R - IRA', value: 'R' },
        ],
      },
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: false,
    }),
    currentMaturityDate: Property.ShortText({
      displayName: 'Current Maturity Date',
      description: 'Current maturity date (MMDDYY)',
      required: false,
    }),
    maturityTermType: Property.StaticDropdown({
      displayName: 'Maturity Term Type',
      description: 'Maturity term type',
      required: false,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
          { label: 'O - Open Ended', value: 'O' },
        ],
      },
    }),
    maturityOption: Property.StaticDropdown({
      displayName: 'Maturity Option',
      description: 'Maturity option',
      required: false,
      options: {
        options: [
          { label: 'P - Principal only', value: 'P' },
          { label: 'I - Interest only', value: 'I' },
          { label: 'B - Both principal and interest', value: 'B' },
          { label: 'N - No auto renewal', value: 'N' },
        ],
      },
    }),
    maturityTerm: Property.ShortText({
      displayName: 'Maturity Term',
      description: 'Maturity term (up to 5 characters)',
      required: false,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'General ledger type (0001-9999)',
      required: false,
    }),
    renewalProductType: Property.ShortText({
      displayName: 'Renewal Product Type',
      description: 'Renewal product type (up to 3 characters)',
      required: false,
    }),
    penaltyType: Property.ShortText({
      displayName: 'Penalty Type',
      description: 'Penalty type (up to 3 characters)',
      required: false,
    }),
    officerCode: Property.ShortText({
      displayName: 'Officer Code',
      description: 'Officer code (up to 3 characters)',
      required: false,
    }),
    nextInterestPaymentDate: Property.ShortText({
      displayName: 'Next Interest Payment Date',
      description: 'Next interest payment date (MMDDYY)',
      required: false,
    }),
    interestRate: Property.ShortText({
      displayName: 'Interest Rate',
      description: 'Interest rate',
      required: false,
    }),
    plusMinusIndexRate: Property.ShortText({
      displayName: 'Plus/Minus Index Rate',
      description: 'Plus or minus index rate',
      required: false,
    }),
    percentageIndexRate: Property.ShortText({
      displayName: 'Percentage Index Rate',
      description: 'Percentage of index rate',
      required: false,
    }),
    interestPeriodTerm: Property.ShortText({
      displayName: 'Interest Period Term',
      description: 'Interest period term (up to 5 characters)',
      required: false,
    }),
    interestPeriodType: Property.StaticDropdown({
      displayName: 'Interest Period Type',
      description: 'Interest period type',
      required: false,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    interestRateType: Property.StaticDropdown({
      displayName: 'Interest Rate Type',
      description: 'Interest rate type',
      required: false,
      options: {
        options: [
          { label: 'F - Fixed Rate', value: 'F' },
          { label: 'S - Step Rate', value: 'S' },
          { label: 'V - Variable Rate', value: 'V' },
        ],
      },
    }),
    interestRateIndex: Property.ShortText({
      displayName: 'Interest Rate Index',
      description: 'Interest rate index',
      required: false,
    }),
    interestPaymentMethod: Property.StaticDropdown({
      displayName: 'Interest Payment Method',
      description: 'Interest payment method',
      required: false,
      options: {
        options: [
          { label: 'A - ACH Transfer', value: 'A' },
          { label: 'C - Capitalize', value: 'C' },
          { label: 'K - Check', value: 'K' },
          { label: 'T - Transfer', value: 'T' },
        ],
      },
    }),
    gracePeriodInterestControl: Property.ShortText({
      displayName: 'Grace Period Interest Control',
      description: 'Grace period interest control',
      required: false,
    }),
    gracePeriodRateType: Property.ShortText({
      displayName: 'Grace Period Rate Type',
      description: 'Grace period rate type',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (up to 10 characters)',
      required: false,
    }),
    overrideMaturity: Property.StaticDropdown({
      displayName: 'Override Maturity',
      description: 'Override maturity date warning',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: '' },
        ],
      },
    }),
    overrideNextInterest: Property.StaticDropdown({
      displayName: 'Override Next Interest',
      description: 'Override next interest payment date warning',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: '' },
        ],
      },
    }),
    lastRenewalBalance: Property.ShortText({
      displayName: 'Last Renewal Balance',
      description: 'Last renewal balance',
      required: false,
    }),
    interestTransferToApplication: Property.StaticDropdown({
      displayName: 'Interest Transfer To Application',
      description: 'Application for interest transfer',
      required: false,
      options: {
        options: [
          { label: 'CD - Certificate of Deposit', value: 'CD' },
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'IR - Retirement', value: 'IR' },
          { label: 'LN - ELS Loan', value: 'LN' },
          { label: 'ML - Mortgage Loan', value: 'ML' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    interestTransferToAccount: Property.ShortText({
      displayName: 'Interest Transfer To Account',
      description: 'Account number for interest transfer',
      required: false,
    }),
    achTransactionCode: Property.StaticDropdown({
      displayName: 'ACH Transaction Code',
      description: 'ACH transaction code (required if payment method is ACH)',
      required: false,
      options: {
        options: [
          { label: '22 - Demand Deposit', value: '22' },
          { label: '32 - Savings', value: '32' },
          { label: '42 - General Ledger Credit', value: '42' },
        ],
      },
    }),
    achDestinationRdfi: Property.ShortText({
      displayName: 'ACH Destination RDFI',
      description: 'ACH destination routing number',
      required: false,
    }),
    achBankName: Property.ShortText({
      displayName: 'ACH Bank Name',
      description: 'ACH bank name',
      required: false,
    }),
    achDestinationAccountNumber: Property.ShortText({
      displayName: 'ACH Destination Account Number',
      description: 'ACH destination account number',
      required: false,
    }),
    achDescription: Property.ShortText({
      displayName: 'ACH Description',
      description: 'ACH description',
      required: false,
    }),
    externalCustomerType: Property.StaticDropdown({
      displayName: 'External Customer Type',
      description: 'External customer type (required if payment method is ACH)',
      required: false,
      options: {
        options: [
          { label: 'C - Consumer', value: 'C' },
          { label: 'N - Non-Consumer', value: 'N' },
        ],
      },
    }),
    additionalFields: Property.Json({
      displayName: 'Additional Fields',
      description: 'Additional fields to include in the request body as JSON object',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      applicationCode: props.applicationCode,
    };

    if (props.productType) {
      body['productType'] = props.productType;
    }
    if (props.currentMaturityDate) {
      body['currentMaturityDate'] = props.currentMaturityDate;
    }
    if (props.maturityTermType) {
      body['maturityTermType'] = props.maturityTermType;
    }
    if (props.maturityOption) {
      body['maturityOption'] = props.maturityOption;
    }
    if (props.maturityTerm) {
      body['maturityTerm'] = props.maturityTerm;
    }
    if (props.generalLedgerType) {
      body['generalLedgerType'] = props.generalLedgerType;
    }
    if (props.renewalProductType) {
      body['renewalProductType'] = props.renewalProductType;
    }
    if (props.penaltyType) {
      body['penaltyType'] = props.penaltyType;
    }
    if (props.officerCode) {
      body['officerCode'] = props.officerCode;
    }
    if (props.nextInterestPaymentDate) {
      body['nextInterestPaymentDate'] = props.nextInterestPaymentDate;
    }
    if (props.interestRate) {
      body['interestRate'] = props.interestRate;
    }
    if (props.plusMinusIndexRate) {
      body['plusMinusIndexRate'] = props.plusMinusIndexRate;
    }
    if (props.percentageIndexRate) {
      body['percentageIndexRate'] = props.percentageIndexRate;
    }
    if (props.interestPeriodTerm) {
      body['interestPeriodTerm'] = props.interestPeriodTerm;
    }
    if (props.interestPeriodType) {
      body['interestPeriodType'] = props.interestPeriodType;
    }
    if (props.interestRateType) {
      body['interestRateType'] = props.interestRateType;
    }
    if (props.interestRateIndex) {
      body['interestRateIndex'] = props.interestRateIndex;
    }
    if (props.interestPaymentMethod) {
      body['interestPaymentMethod'] = props.interestPaymentMethod;
    }
    if (props.gracePeriodInterestControl) {
      body['gracePeriodInterestControl'] = props.gracePeriodInterestControl;
    }
    if (props.gracePeriodRateType) {
      body['gracePeriodRateType'] = props.gracePeriodRateType;
    }
    if (props.userId) {
      body['userId'] = props.userId;
    }
    if (props.overrideMaturity !== undefined && props.overrideMaturity !== null) {
      body['overrideMaturity'] = props.overrideMaturity;
    }
    if (props.overrideNextInterest !== undefined && props.overrideNextInterest !== null) {
      body['overrideNextInterest'] = props.overrideNextInterest;
    }
    if (props.lastRenewalBalance) {
      body['lastRenewalBalance'] = props.lastRenewalBalance;
    }
    if (props.interestTransferToApplication) {
      body['interestTransferToApplication'] = props.interestTransferToApplication;
    }
    if (props.interestTransferToAccount) {
      body['interestTransferToAccount'] = props.interestTransferToAccount;
    }
    if (props.achTransactionCode) {
      body['achTransactionCode'] = props.achTransactionCode;
    }
    if (props.achDestinationRdfi) {
      body['achDestinationRdfi'] = props.achDestinationRdfi;
    }
    if (props.achBankName) {
      body['achBankName'] = props.achBankName;
    }
    if (props.achDestinationAccountNumber) {
      body['achDestinationAccountNumber'] = props.achDestinationAccountNumber;
    }
    if (props.achDescription) {
      body['achDescription'] = props.achDescription;
    }
    if (props.externalCustomerType) {
      body['externalCustomerType'] = props.externalCustomerType;
    }

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/${props.accountNumber}/renewals`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Maintain a certificate or IRA renewal
 */
export const time_deposit_renewal_maintain = createAction({
  name: 'time_deposit_renewal_maintain',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Maintain Renewal',
  description: 'Maintain a certificate or IRA renewal',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number, right justified zero filled (up to 15 digits)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application type',
      required: true,
      options: {
        options: [
          { label: 'C - Certificate', value: 'C' },
          { label: 'R - IRA', value: 'R' },
        ],
      },
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: false,
    }),
    currentMaturityDate: Property.ShortText({
      displayName: 'Current Maturity Date',
      description: 'Current maturity date (MMDDYY)',
      required: false,
    }),
    maturityTermType: Property.StaticDropdown({
      displayName: 'Maturity Term Type',
      description: 'Maturity term type',
      required: false,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
          { label: 'O - Open Ended', value: 'O' },
        ],
      },
    }),
    maturityOption: Property.StaticDropdown({
      displayName: 'Maturity Option',
      description: 'Maturity option',
      required: false,
      options: {
        options: [
          { label: 'P - Principal only', value: 'P' },
          { label: 'I - Interest only', value: 'I' },
          { label: 'B - Both principal and interest', value: 'B' },
          { label: 'N - No auto renewal', value: 'N' },
        ],
      },
    }),
    maturityTerm: Property.ShortText({
      displayName: 'Maturity Term',
      description: 'Maturity term (up to 5 characters)',
      required: false,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'General ledger type (0001-9999)',
      required: false,
    }),
    renewalProductType: Property.ShortText({
      displayName: 'Renewal Product Type',
      description: 'Renewal product type (up to 3 characters)',
      required: false,
    }),
    penaltyType: Property.ShortText({
      displayName: 'Penalty Type',
      description: 'Penalty type (up to 3 characters)',
      required: false,
    }),
    officerCode: Property.ShortText({
      displayName: 'Officer Code',
      description: 'Officer code (up to 3 characters)',
      required: false,
    }),
    nextInterestPaymentDate: Property.ShortText({
      displayName: 'Next Interest Payment Date',
      description: 'Next interest payment date (MMDDYY)',
      required: false,
    }),
    interestRate: Property.ShortText({
      displayName: 'Interest Rate',
      description: 'Interest rate',
      required: false,
    }),
    plusMinusIndexRate: Property.ShortText({
      displayName: 'Plus/Minus Index Rate',
      description: 'Plus or minus index rate',
      required: false,
    }),
    percentageIndexRate: Property.ShortText({
      displayName: 'Percentage Index Rate',
      description: 'Percentage of index rate',
      required: false,
    }),
    interestPeriodTerm: Property.ShortText({
      displayName: 'Interest Period Term',
      description: 'Interest period term (up to 5 characters)',
      required: false,
    }),
    interestPeriodType: Property.StaticDropdown({
      displayName: 'Interest Period Type',
      description: 'Interest period type',
      required: false,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    interestRateType: Property.StaticDropdown({
      displayName: 'Interest Rate Type',
      description: 'Interest rate type',
      required: false,
      options: {
        options: [
          { label: 'F - Fixed Rate', value: 'F' },
          { label: 'S - Step Rate', value: 'S' },
          { label: 'V - Variable Rate', value: 'V' },
        ],
      },
    }),
    interestRateIndex: Property.ShortText({
      displayName: 'Interest Rate Index',
      description: 'Interest rate index',
      required: false,
    }),
    interestPaymentMethod: Property.StaticDropdown({
      displayName: 'Interest Payment Method',
      description: 'Interest payment method',
      required: false,
      options: {
        options: [
          { label: 'A - ACH Transfer', value: 'A' },
          { label: 'C - Capitalize', value: 'C' },
          { label: 'K - Check', value: 'K' },
          { label: 'T - Transfer', value: 'T' },
        ],
      },
    }),
    gracePeriodInterestControl: Property.ShortText({
      displayName: 'Grace Period Interest Control',
      description: 'Grace period interest control',
      required: false,
    }),
    gracePeriodRateType: Property.ShortText({
      displayName: 'Grace Period Rate Type',
      description: 'Grace period rate type',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (up to 10 characters)',
      required: false,
    }),
    overrideMaturity: Property.StaticDropdown({
      displayName: 'Override Maturity',
      description: 'Override maturity date warning',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: '' },
        ],
      },
    }),
    overrideNextInterest: Property.StaticDropdown({
      displayName: 'Override Next Interest',
      description: 'Override next interest payment date warning',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: '' },
        ],
      },
    }),
    lastRenewalBalance: Property.ShortText({
      displayName: 'Last Renewal Balance',
      description: 'Last renewal balance',
      required: false,
    }),
    interestTransferToApplication: Property.StaticDropdown({
      displayName: 'Interest Transfer To Application',
      description: 'Application for interest transfer',
      required: false,
      options: {
        options: [
          { label: 'CD - Certificate of Deposit', value: 'CD' },
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'IR - Retirement', value: 'IR' },
          { label: 'LN - ELS Loan', value: 'LN' },
          { label: 'ML - Mortgage Loan', value: 'ML' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    interestTransferToAccount: Property.ShortText({
      displayName: 'Interest Transfer To Account',
      description: 'Account number for interest transfer',
      required: false,
    }),
    achTransactionCode: Property.StaticDropdown({
      displayName: 'ACH Transaction Code',
      description: 'ACH transaction code (required if payment method is ACH)',
      required: false,
      options: {
        options: [
          { label: '22 - Demand Deposit', value: '22' },
          { label: '32 - Savings', value: '32' },
          { label: '42 - General Ledger Credit', value: '42' },
        ],
      },
    }),
    achDestinationRdfi: Property.ShortText({
      displayName: 'ACH Destination RDFI',
      description: 'ACH destination routing number',
      required: false,
    }),
    achBankName: Property.ShortText({
      displayName: 'ACH Bank Name',
      description: 'ACH bank name',
      required: false,
    }),
    achDestinationAccountNumber: Property.ShortText({
      displayName: 'ACH Destination Account Number',
      description: 'ACH destination account number',
      required: false,
    }),
    achDescription: Property.ShortText({
      displayName: 'ACH Description',
      description: 'ACH description',
      required: false,
    }),
    externalCustomerType: Property.StaticDropdown({
      displayName: 'External Customer Type',
      description: 'External customer type (required if payment method is ACH)',
      required: false,
      options: {
        options: [
          { label: 'C - Consumer', value: 'C' },
          { label: 'N - Non-Consumer', value: 'N' },
        ],
      },
    }),
    additionalFields: Property.Json({
      displayName: 'Additional Fields',
      description: 'Additional fields to include in the request body as JSON object',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      applicationCode: props.applicationCode,
    };

    if (props.productType) {
      body['productType'] = props.productType;
    }
    if (props.currentMaturityDate) {
      body['currentMaturityDate'] = props.currentMaturityDate;
    }
    if (props.maturityTermType) {
      body['maturityTermType'] = props.maturityTermType;
    }
    if (props.maturityOption) {
      body['maturityOption'] = props.maturityOption;
    }
    if (props.maturityTerm) {
      body['maturityTerm'] = props.maturityTerm;
    }
    if (props.generalLedgerType) {
      body['generalLedgerType'] = props.generalLedgerType;
    }
    if (props.renewalProductType) {
      body['renewalProductType'] = props.renewalProductType;
    }
    if (props.penaltyType) {
      body['penaltyType'] = props.penaltyType;
    }
    if (props.officerCode) {
      body['officerCode'] = props.officerCode;
    }
    if (props.nextInterestPaymentDate) {
      body['nextInterestPaymentDate'] = props.nextInterestPaymentDate;
    }
    if (props.interestRate) {
      body['interestRate'] = props.interestRate;
    }
    if (props.plusMinusIndexRate) {
      body['plusMinusIndexRate'] = props.plusMinusIndexRate;
    }
    if (props.percentageIndexRate) {
      body['percentageIndexRate'] = props.percentageIndexRate;
    }
    if (props.interestPeriodTerm) {
      body['interestPeriodTerm'] = props.interestPeriodTerm;
    }
    if (props.interestPeriodType) {
      body['interestPeriodType'] = props.interestPeriodType;
    }
    if (props.interestRateType) {
      body['interestRateType'] = props.interestRateType;
    }
    if (props.interestRateIndex) {
      body['interestRateIndex'] = props.interestRateIndex;
    }
    if (props.interestPaymentMethod) {
      body['interestPaymentMethod'] = props.interestPaymentMethod;
    }
    if (props.gracePeriodInterestControl) {
      body['gracePeriodInterestControl'] = props.gracePeriodInterestControl;
    }
    if (props.gracePeriodRateType) {
      body['gracePeriodRateType'] = props.gracePeriodRateType;
    }
    if (props.userId) {
      body['userId'] = props.userId;
    }
    if (props.overrideMaturity !== undefined && props.overrideMaturity !== null) {
      body['overrideMaturity'] = props.overrideMaturity;
    }
    if (props.overrideNextInterest !== undefined && props.overrideNextInterest !== null) {
      body['overrideNextInterest'] = props.overrideNextInterest;
    }
    if (props.lastRenewalBalance) {
      body['lastRenewalBalance'] = props.lastRenewalBalance;
    }
    if (props.interestTransferToApplication) {
      body['interestTransferToApplication'] = props.interestTransferToApplication;
    }
    if (props.interestTransferToAccount) {
      body['interestTransferToAccount'] = props.interestTransferToAccount;
    }
    if (props.achTransactionCode) {
      body['achTransactionCode'] = props.achTransactionCode;
    }
    if (props.achDestinationRdfi) {
      body['achDestinationRdfi'] = props.achDestinationRdfi;
    }
    if (props.achBankName) {
      body['achBankName'] = props.achBankName;
    }
    if (props.achDestinationAccountNumber) {
      body['achDestinationAccountNumber'] = props.achDestinationAccountNumber;
    }
    if (props.achDescription) {
      body['achDescription'] = props.achDescription;
    }
    if (props.externalCustomerType) {
      body['externalCustomerType'] = props.externalCustomerType;
    }

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/${props.accountNumber}/renewals`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Delete a certificate or IRA renewal
 */
export const time_deposit_renewal_delete = createAction({
  name: 'time_deposit_renewal_delete',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Delete Renewal',
  description: 'Delete a certificate or IRA renewal',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number, right justified zero filled (up to 15 digits)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application type',
      required: true,
      options: {
        options: [
          { label: 'C - Certificates', value: 'C' },
          { label: 'R - IRA', value: 'R' },
        ],
      },
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'Optional: General ledger type (0001-9999)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const queryParams: Record<string, string> = {
      applicationCode: props.applicationCode,
    };
    if (props.generalLedgerType) {
      queryParams['generalLedgerType'] = props.generalLedgerType;
    }

    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/${props.accountNumber}/renewals${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Add a certificate account
 */
export const time_deposit_certificate_add = createAction({
  name: 'time_deposit_certificate_add',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Add Certificate Account',
  description: 'Add a certificate account',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (up to 14 characters)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (up to 15 characters)',
      required: true,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch number (up to 3 characters)',
      required: true,
    }),
    tinStatus: Property.StaticDropdown({
      displayName: 'TIN Status',
      description: 'Tax Identification Number status',
      required: true,
      options: {
        options: [
          { label: 'B - B-Notice Received', value: 'B' },
          { label: 'C - Certified', value: 'C' },
          { label: 'E - Exempt', value: 'E' },
          { label: 'N - Not Certified', value: 'N' },
          { label: 'O - No TIN Number', value: 'O' },
          { label: 'P - TIN Applied For', value: 'P' },
          { label: 'U - IRS Notice of Under Reporting', value: 'U' },
          { label: 'W - Exemption Expired', value: 'W' },
          { label: 'X - Voluntary Withholding', value: 'X' },
        ],
      },
    }),
    openingAmount: Property.ShortText({
      displayName: 'Opening Amount',
      description: 'Opening amount (e.g., 200.00)',
      required: true,
    }),
    effectiveOpenDate: Property.ShortText({
      displayName: 'Effective Open Date',
      description: 'Effective open date (MMDDYY)',
      required: true,
    }),
    shortName: Property.ShortText({
      displayName: 'Short Name',
      description: 'Customer short name (up to 20 characters)',
      required: true,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'General ledger type (0001-9999)',
      required: true,
    }),
    personalNonPersonal: Property.StaticDropdown({
      displayName: 'Personal/Non-Personal',
      description: 'Personal or non-personal account',
      required: true,
      options: {
        options: [
          { label: 'P - Personal', value: 'P' },
          { label: 'N - Non-Personal', value: 'N' },
        ],
      },
    }),
    passbookAccount: Property.StaticDropdown({
      displayName: 'Passbook Account',
      description: 'Is this a passbook account?',
      required: true,
      options: {
        options: [
          { label: 'N - Not a Passbook Account', value: 'N' },
          { label: 'Y - Passbook Account', value: 'Y' },
        ],
      },
    }),
    rateIndex: Property.ShortText({
      displayName: 'Rate Index',
      description: 'Rate index (up to 3 characters)',
      required: true,
    }),
    interestYearBase: Property.StaticDropdown({
      displayName: 'Interest Year Base',
      description: 'Interest year base calculation',
      required: true,
      options: {
        options: [
          { label: '1 - 30/360', value: 1 },
          { label: '2 - 30/365', value: 2 },
          { label: '3 - Actual/360', value: 3 },
          { label: '4 - Actual/365', value: 4 },
        ],
      },
    }),
    maturityTerm: Property.ShortText({
      displayName: 'Maturity Term',
      description: 'Maturity term',
      required: true,
    }),
    maturityTermType: Property.StaticDropdown({
      displayName: 'Maturity Term Type',
      description: 'Maturity term type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
          { label: 'O - Open Ended', value: 'O' },
        ],
      },
    }),
    interestPeriodTerm: Property.ShortText({
      displayName: 'Interest Period Term',
      description: 'Interest period term',
      required: true,
    }),
    interestPeriodType: Property.StaticDropdown({
      displayName: 'Interest Period Type',
      description: 'Interest period type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    paymentMethod: Property.StaticDropdown({
      displayName: 'Payment Method',
      description: 'Interest payment method',
      required: true,
      options: {
        options: [
          { label: 'A - ACH Transfer', value: 'A' },
          { label: 'C - Capitalize', value: 'C' },
          { label: 'K - Check', value: 'K' },
          { label: 'T - Transfer', value: 'T' },
        ],
      },
    }),
    interestRate: Property.ShortText({
      displayName: 'Interest Rate',
      description: 'Interest rate (e.g., 6.2500)',
      required: true,
    }),
    interestRateType: Property.StaticDropdown({
      displayName: 'Interest Rate Type',
      description: 'Interest rate type',
      required: true,
      options: {
        options: [
          { label: 'F - Fixed Rate', value: 'F' },
          { label: 'S - Step Rate', value: 'S' },
          { label: 'V - Variable Rate', value: 'V' },
        ],
      },
    }),
    compoundFrequency: Property.StaticDropdown({
      displayName: 'Compound Frequency',
      description: 'Compound frequency',
      required: true,
      options: {
        options: [
          { label: 'C - Daily', value: 'C' },
          { label: 'P - Periodic', value: 'P' },
          { label: 'S - Simple', value: 'S' },
        ],
      },
    }),
    combinedChecks: Property.StaticDropdown({
      displayName: 'Combined Checks',
      description: 'Combined checks',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    combinedInterestNotices: Property.StaticDropdown({
      displayName: 'Combined Interest Notices',
      description: 'Combined interest notices',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    controlMaturity: Property.StaticDropdown({
      displayName: 'Control Maturity',
      description: 'Control maturity',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    maturityOption: Property.StaticDropdown({
      displayName: 'Maturity Option',
      description: 'Maturity option',
      required: true,
      options: {
        options: [
          { label: 'P - Principal only', value: 'P' },
          { label: 'I - Interest only', value: 'I' },
          { label: 'B - Both principal and interest', value: 'B' },
          { label: 'N - No auto renewal', value: 'N' },
        ],
      },
    }),
    autoCloseCode: Property.StaticDropdown({
      displayName: 'Auto Close Code',
      description: 'Auto close code',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    mailSortCode: Property.ShortText({
      displayName: 'Mail Sort Code',
      description: 'Mail sort code',
      required: true,
    }),
    statementType: Property.ShortText({
      displayName: 'Statement Type',
      description: 'Statement type',
      required: true,
    }),
    printApyeOnStatement: Property.StaticDropdown({
      displayName: 'Print APYE On Statement',
      description: 'Print APYE on statement',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    purgeControlCode: Property.ShortText({
      displayName: 'Purge Control Code',
      description: 'Purge control code',
      required: true,
    }),
    alternateWithholdingMethod: Property.ShortText({
      displayName: 'Alternate Withholding Method',
      description: 'Alternate withholding method',
      required: true,
    }),
    additionalFields: Property.Json({
      displayName: 'Additional Fields',
      description: 'Additional fields to include in the request body as JSON object',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      customerId: props.customerId,
      accountNumber: props.accountNumber,
      productType: props.productType,
      branchNumber: props.branchNumber,
      tinStatus: props.tinStatus,
      openingAmount: props.openingAmount,
      effectiveOpenDate: props.effectiveOpenDate,
      shortName: props.shortName,
      generalLedgerType: props.generalLedgerType,
      personalNonPersonal: props.personalNonPersonal,
      passbookAccount: props.passbookAccount,
      rateIndex: props.rateIndex,
      interestYearBase: props.interestYearBase,
      maturityTerm: props.maturityTerm,
      maturityTermType: props.maturityTermType,
      interestPeriodTerm: props.interestPeriodTerm,
      interestPeriodType: props.interestPeriodType,
      paymentMethod: props.paymentMethod,
      interestRate: props.interestRate,
      interestRateType: props.interestRateType,
      compoundFrequency: props.compoundFrequency,
      combinedChecks: props.combinedChecks,
      combinedInterestNotices: props.combinedInterestNotices,
      controlMaturity: props.controlMaturity,
      maturityOption: props.maturityOption,
      autoCloseCode: props.autoCloseCode,
      mailSortCode: props.mailSortCode,
      statementType: props.statementType,
      printApyeOnStatement: props.printApyeOnStatement,
      purgeControlCode: props.purgeControlCode,
      alternateWithholdingMethod: props.alternateWithholdingMethod,
    };

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/certificates`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Add a certificate account to staging
 */
export const time_deposit_certificate_add_staging = createAction({
  name: 'time_deposit_certificate_add_staging',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Add Certificate Account to Staging',
  description: 'Add a certificate account to staging',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (up to 14 characters)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (up to 15 characters)',
      required: true,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch number (up to 3 characters)',
      required: true,
    }),
    tinStatus: Property.StaticDropdown({
      displayName: 'TIN Status',
      description: 'Tax Identification Number status',
      required: true,
      options: {
        options: [
          { label: 'B - B-Notice Received', value: 'B' },
          { label: 'C - Certified', value: 'C' },
          { label: 'E - Exempt', value: 'E' },
          { label: 'N - Not Certified', value: 'N' },
          { label: 'O - No TIN Number', value: 'O' },
          { label: 'P - TIN Applied For', value: 'P' },
          { label: 'U - IRS Notice of Under Reporting', value: 'U' },
          { label: 'W - Exemption Expired', value: 'W' },
          { label: 'X - Voluntary Withholding', value: 'X' },
        ],
      },
    }),
    openingAmount: Property.ShortText({
      displayName: 'Opening Amount',
      description: 'Opening amount (e.g., 200.00)',
      required: true,
    }),
    effectiveOpenDate: Property.ShortText({
      displayName: 'Effective Open Date',
      description: 'Effective open date (MMDDYY)',
      required: true,
    }),
    shortName: Property.ShortText({
      displayName: 'Short Name',
      description: 'Customer short name (up to 20 characters)',
      required: true,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'General ledger type (0001-9999)',
      required: true,
    }),
    personalNonPersonal: Property.StaticDropdown({
      displayName: 'Personal/Non-Personal',
      description: 'Personal or non-personal account',
      required: true,
      options: {
        options: [
          { label: 'P - Personal', value: 'P' },
          { label: 'N - Non-Personal', value: 'N' },
        ],
      },
    }),
    passbookAccount: Property.StaticDropdown({
      displayName: 'Passbook Account',
      description: 'Is this a passbook account?',
      required: true,
      options: {
        options: [
          { label: 'N - Not a Passbook Account', value: 'N' },
          { label: 'Y - Passbook Account', value: 'Y' },
        ],
      },
    }),
    rateIndex: Property.ShortText({
      displayName: 'Rate Index',
      description: 'Rate index (up to 3 characters)',
      required: true,
    }),
    interestYearBase: Property.StaticDropdown({
      displayName: 'Interest Year Base',
      description: 'Interest year base calculation',
      required: true,
      options: {
        options: [
          { label: '1 - 30/360', value: 1 },
          { label: '2 - 30/365', value: 2 },
          { label: '3 - Actual/360', value: 3 },
          { label: '4 - Actual/365', value: 4 },
        ],
      },
    }),
    maturityTerm: Property.ShortText({
      displayName: 'Maturity Term',
      description: 'Maturity term',
      required: true,
    }),
    maturityTermType: Property.StaticDropdown({
      displayName: 'Maturity Term Type',
      description: 'Maturity term type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
          { label: 'O - Open Ended', value: 'O' },
        ],
      },
    }),
    interestPeriodTerm: Property.ShortText({
      displayName: 'Interest Period Term',
      description: 'Interest period term',
      required: true,
    }),
    interestPeriodType: Property.StaticDropdown({
      displayName: 'Interest Period Type',
      description: 'Interest period type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    paymentMethod: Property.StaticDropdown({
      displayName: 'Payment Method',
      description: 'Interest payment method',
      required: true,
      options: {
        options: [
          { label: 'A - ACH Transfer', value: 'A' },
          { label: 'C - Capitalize', value: 'C' },
          { label: 'K - Check', value: 'K' },
          { label: 'T - Transfer', value: 'T' },
        ],
      },
    }),
    interestRate: Property.ShortText({
      displayName: 'Interest Rate',
      description: 'Interest rate (e.g., 6.2500)',
      required: true,
    }),
    interestRateType: Property.StaticDropdown({
      displayName: 'Interest Rate Type',
      description: 'Interest rate type',
      required: true,
      options: {
        options: [
          { label: 'F - Fixed Rate', value: 'F' },
          { label: 'S - Step Rate', value: 'S' },
          { label: 'V - Variable Rate', value: 'V' },
        ],
      },
    }),
    compoundFrequency: Property.StaticDropdown({
      displayName: 'Compound Frequency',
      description: 'Compound frequency',
      required: true,
      options: {
        options: [
          { label: 'C - Daily', value: 'C' },
          { label: 'P - Periodic', value: 'P' },
          { label: 'S - Simple', value: 'S' },
        ],
      },
    }),
    combinedChecks: Property.StaticDropdown({
      displayName: 'Combined Checks',
      description: 'Combined checks',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    combinedInterestNotices: Property.StaticDropdown({
      displayName: 'Combined Interest Notices',
      description: 'Combined interest notices',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    controlMaturity: Property.StaticDropdown({
      displayName: 'Control Maturity',
      description: 'Control maturity',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    maturityOption: Property.StaticDropdown({
      displayName: 'Maturity Option',
      description: 'Maturity option',
      required: true,
      options: {
        options: [
          { label: 'P - Principal only', value: 'P' },
          { label: 'I - Interest only', value: 'I' },
          { label: 'B - Both principal and interest', value: 'B' },
          { label: 'N - No auto renewal', value: 'N' },
        ],
      },
    }),
    autoCloseCode: Property.StaticDropdown({
      displayName: 'Auto Close Code',
      description: 'Auto close code',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    mailSortCode: Property.ShortText({
      displayName: 'Mail Sort Code',
      description: 'Mail sort code',
      required: true,
    }),
    statementType: Property.ShortText({
      displayName: 'Statement Type',
      description: 'Statement type',
      required: true,
    }),
    printApyeOnStatement: Property.StaticDropdown({
      displayName: 'Print APYE On Statement',
      description: 'Print APYE on statement',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    purgeControlCode: Property.ShortText({
      displayName: 'Purge Control Code',
      description: 'Purge control code',
      required: true,
    }),
    alternateWithholdingMethod: Property.ShortText({
      displayName: 'Alternate Withholding Method',
      description: 'Alternate withholding method',
      required: true,
    }),
    additionalFields: Property.Json({
      displayName: 'Additional Fields',
      description: 'Additional fields to include in the request body as JSON object',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      customerId: props.customerId,
      accountNumber: props.accountNumber,
      productType: props.productType,
      branchNumber: props.branchNumber,
      tinStatus: props.tinStatus,
      openingAmount: props.openingAmount,
      effectiveOpenDate: props.effectiveOpenDate,
      shortName: props.shortName,
      generalLedgerType: props.generalLedgerType,
      personalNonPersonal: props.personalNonPersonal,
      passbookAccount: props.passbookAccount,
      rateIndex: props.rateIndex,
      interestYearBase: props.interestYearBase,
      maturityTerm: props.maturityTerm,
      maturityTermType: props.maturityTermType,
      interestPeriodTerm: props.interestPeriodTerm,
      interestPeriodType: props.interestPeriodType,
      paymentMethod: props.paymentMethod,
      interestRate: props.interestRate,
      interestRateType: props.interestRateType,
      compoundFrequency: props.compoundFrequency,
      combinedChecks: props.combinedChecks,
      combinedInterestNotices: props.combinedInterestNotices,
      controlMaturity: props.controlMaturity,
      maturityOption: props.maturityOption,
      autoCloseCode: props.autoCloseCode,
      mailSortCode: props.mailSortCode,
      statementType: props.statementType,
      printApyeOnStatement: props.printApyeOnStatement,
      purgeControlCode: props.purgeControlCode,
      alternateWithholdingMethod: props.alternateWithholdingMethod,
    };

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/certificates/staging`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Add a retirement (IRA) account
 */
export const time_deposit_ira_add = createAction({
  name: 'time_deposit_ira_add',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Add IRA Account',
  description: 'Add a retirement (IRA) account',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (up to 14 characters)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (up to 15 characters)',
      required: true,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch number (up to 3 characters)',
      required: true,
    }),
    tinStatus: Property.StaticDropdown({
      displayName: 'TIN Status',
      description: 'Tax Identification Number status',
      required: true,
      options: {
        options: [
          { label: 'B - B-Notice Received', value: 'B' },
          { label: 'C - Certified', value: 'C' },
          { label: 'E - Exempt', value: 'E' },
          { label: 'N - Not Certified', value: 'N' },
          { label: 'O - No TIN Number', value: 'O' },
          { label: 'P - TIN Applied For', value: 'P' },
          { label: 'U - IRS Notice of Under Reporting', value: 'U' },
          { label: 'W - Exemption Expired', value: 'W' },
          { label: 'X - Voluntary Withholding', value: 'X' },
        ],
      },
    }),
    openingAmount: Property.ShortText({
      displayName: 'Opening Amount',
      description: 'Opening amount (e.g., 200.00)',
      required: true,
    }),
    effectiveOpenDate: Property.ShortText({
      displayName: 'Effective Open Date',
      description: 'Effective open date (MMDDYY)',
      required: true,
    }),
    shortName: Property.ShortText({
      displayName: 'Short Name',
      description: 'Customer short name (up to 20 characters)',
      required: true,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'General ledger type (0001-9999)',
      required: true,
    }),
    personalNonPersonal: Property.StaticDropdown({
      displayName: 'Personal/Non-Personal',
      description: 'Personal or non-personal account',
      required: true,
      options: {
        options: [
          { label: 'P - Personal', value: 'P' },
          { label: 'N - Non-Personal', value: 'N' },
        ],
      },
    }),
    passbookAccount: Property.StaticDropdown({
      displayName: 'Passbook Account',
      description: 'Is this a passbook account? (Note: Passbooks are not valid for IRAs)',
      required: true,
      options: {
        options: [
          { label: 'N - Not a Passbook Account', value: 'N' },
          { label: 'Y - Passbook Account', value: 'Y' },
        ],
      },
    }),
    rateIndex: Property.ShortText({
      displayName: 'Rate Index',
      description: 'Rate index (up to 3 characters)',
      required: true,
    }),
    interestYearBase: Property.StaticDropdown({
      displayName: 'Interest Year Base',
      description: 'Interest year base calculation',
      required: true,
      options: {
        options: [
          { label: '1 - 30/360', value: '1' },
          { label: '2 - 30/365', value: '2' },
          { label: '3 - Actual/360', value: '3' },
          { label: '4 - Actual/365', value: '4' },
        ],
      },
    }),
    maturityTerm: Property.ShortText({
      displayName: 'Maturity Term',
      description: 'Maturity term',
      required: true,
    }),
    maturityTermType: Property.StaticDropdown({
      displayName: 'Maturity Term Type',
      description: 'Maturity term type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
          { label: 'O - Open Ended', value: 'O' },
        ],
      },
    }),
    interestPeriodTerm: Property.ShortText({
      displayName: 'Interest Period Term',
      description: 'Interest period term',
      required: true,
    }),
    interestPeriodType: Property.StaticDropdown({
      displayName: 'Interest Period Type',
      description: 'Interest period type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    paymentMethod: Property.StaticDropdown({
      displayName: 'Payment Method',
      description: 'Interest payment method',
      required: true,
      options: {
        options: [
          { label: 'C - Capitalize', value: 'C' },
        ],
      },
    }),
    interestRate: Property.ShortText({
      displayName: 'Interest Rate',
      description: 'Interest rate (e.g., 6.2500)',
      required: true,
    }),
    interestRateType: Property.StaticDropdown({
      displayName: 'Interest Rate Type',
      description: 'Interest rate type',
      required: true,
      options: {
        options: [
          { label: 'F - Fixed Rate', value: 'F' },
          { label: 'S - Step Rate', value: 'S' },
          { label: 'V - Variable Rate', value: 'V' },
        ],
      },
    }),
    compoundFrequency: Property.StaticDropdown({
      displayName: 'Compound Frequency',
      description: 'Compound frequency',
      required: true,
      options: {
        options: [
          { label: 'C - Daily', value: 'C' },
          { label: 'P - Periodic', value: 'P' },
          { label: 'S - Simple', value: 'S' },
        ],
      },
    }),
    combinedChecks: Property.StaticDropdown({
      displayName: 'Combined Checks',
      description: 'Combined checks',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    combinedInterestNotices: Property.StaticDropdown({
      displayName: 'Combined Interest Notices',
      description: 'Combined interest notices',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    controlMaturity: Property.StaticDropdown({
      displayName: 'Control Maturity',
      description: 'Control maturity',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    maturityOption: Property.StaticDropdown({
      displayName: 'Maturity Option',
      description: 'Maturity option',
      required: true,
      options: {
        options: [
          { label: 'P - Principal only', value: 'P' },
          { label: 'I - Interest only', value: 'I' },
          { label: 'B - Both principal and interest', value: 'B' },
          { label: 'N - No auto renewal', value: 'N' },
        ],
      },
    }),
    autoCloseCode: Property.StaticDropdown({
      displayName: 'Auto Close Code',
      description: 'Auto close code',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    mailSortCode: Property.ShortText({
      displayName: 'Mail Sort Code',
      description: 'Mail sort code',
      required: true,
    }),
    statementType: Property.ShortText({
      displayName: 'Statement Type',
      description: 'Statement type',
      required: true,
    }),
    printApyeOnStatement: Property.StaticDropdown({
      displayName: 'Print APYE On Statement',
      description: 'Print APYE on statement',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    purgeControlCode: Property.ShortText({
      displayName: 'Purge Control Code',
      description: 'Purge control code',
      required: true,
    }),
    planNumber: Property.Number({
      displayName: 'Plan Number',
      description: 'IRA plan number',
      required: true,
    }),
    planType: Property.ShortText({
      displayName: 'Plan Type',
      description: 'IRA plan type',
      required: true,
    }),
    additionalFields: Property.Json({
      displayName: 'Additional Fields',
      description: 'Additional fields to include in the request body as JSON object',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      customerId: props.customerId,
      accountNumber: props.accountNumber,
      productType: props.productType,
      branchNumber: props.branchNumber,
      tinStatus: props.tinStatus,
      openingAmount: props.openingAmount,
      effectiveOpenDate: props.effectiveOpenDate,
      shortName: props.shortName,
      generalLedgerType: props.generalLedgerType,
      personalNonPersonal: props.personalNonPersonal,
      passbookAccount: props.passbookAccount,
      rateIndex: props.rateIndex,
      interestYearBase: props.interestYearBase,
      maturityTerm: props.maturityTerm,
      maturityTermType: props.maturityTermType,
      interestPeriodTerm: props.interestPeriodTerm,
      interestPeriodType: props.interestPeriodType,
      paymentMethod: props.paymentMethod,
      interestRate: props.interestRate,
      interestRateType: props.interestRateType,
      compoundFrequency: props.compoundFrequency,
      combinedChecks: props.combinedChecks,
      combinedInterestNotices: props.combinedInterestNotices,
      controlMaturity: props.controlMaturity,
      maturityOption: props.maturityOption,
      autoCloseCode: props.autoCloseCode,
      mailSortCode: props.mailSortCode,
      statementType: props.statementType,
      printApyeOnStatement: props.printApyeOnStatement,
      purgeControlCode: props.purgeControlCode,
      planNumber: props.planNumber,
      planType: props.planType,
    };

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/ira`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Add a retirement (IRA) account to staging
 */
export const time_deposit_ira_add_staging = createAction({
  name: 'time_deposit_ira_add_staging',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Add IRA Account to Staging',
  description: 'Add a retirement (IRA) account to staging',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (up to 14 characters)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number (up to 15 characters)',
      required: true,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch number (up to 3 characters)',
      required: true,
    }),
    tinStatus: Property.StaticDropdown({
      displayName: 'TIN Status',
      description: 'Tax Identification Number status',
      required: true,
      options: {
        options: [
          { label: 'B - B-Notice Received', value: 'B' },
          { label: 'C - Certified', value: 'C' },
          { label: 'E - Exempt', value: 'E' },
          { label: 'N - Not Certified', value: 'N' },
          { label: 'O - No TIN Number', value: 'O' },
          { label: 'P - TIN Applied For', value: 'P' },
          { label: 'U - IRS Notice of Under Reporting', value: 'U' },
          { label: 'W - Exemption Expired', value: 'W' },
          { label: 'X - Voluntary Withholding', value: 'X' },
        ],
      },
    }),
    openingAmount: Property.ShortText({
      displayName: 'Opening Amount',
      description: 'Opening amount (e.g., 200.00)',
      required: true,
    }),
    effectiveOpenDate: Property.ShortText({
      displayName: 'Effective Open Date',
      description: 'Effective open date (MMDDYY)',
      required: true,
    }),
    shortName: Property.ShortText({
      displayName: 'Short Name',
      description: 'Customer short name (up to 20 characters)',
      required: true,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'General ledger type (0001-9999)',
      required: true,
    }),
    personalNonPersonal: Property.StaticDropdown({
      displayName: 'Personal/Non-Personal',
      description: 'Personal or non-personal account',
      required: true,
      options: {
        options: [
          { label: 'P - Personal', value: 'P' },
          { label: 'N - Non-Personal', value: 'N' },
        ],
      },
    }),
    passbookAccount: Property.StaticDropdown({
      displayName: 'Passbook Account',
      description: 'Is this a passbook account? (Note: Passbooks are not valid for IRAs)',
      required: true,
      options: {
        options: [
          { label: 'N - Not a Passbook Account', value: 'N' },
          { label: 'Y - Passbook Account', value: 'Y' },
        ],
      },
    }),
    rateIndex: Property.ShortText({
      displayName: 'Rate Index',
      description: 'Rate index (up to 3 characters)',
      required: true,
    }),
    interestYearBase: Property.StaticDropdown({
      displayName: 'Interest Year Base',
      description: 'Interest year base calculation',
      required: true,
      options: {
        options: [
          { label: '1 - 30/360', value: '1' },
          { label: '2 - 30/365', value: '2' },
          { label: '3 - Actual/360', value: '3' },
          { label: '4 - Actual/365', value: '4' },
        ],
      },
    }),
    maturityTerm: Property.ShortText({
      displayName: 'Maturity Term',
      description: 'Maturity term',
      required: true,
    }),
    maturityTermType: Property.StaticDropdown({
      displayName: 'Maturity Term Type',
      description: 'Maturity term type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
          { label: 'O - Open Ended', value: 'O' },
        ],
      },
    }),
    interestPeriodTerm: Property.ShortText({
      displayName: 'Interest Period Term',
      description: 'Interest period term',
      required: true,
    }),
    interestPeriodType: Property.StaticDropdown({
      displayName: 'Interest Period Type',
      description: 'Interest period type',
      required: true,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    paymentMethod: Property.StaticDropdown({
      displayName: 'Payment Method',
      description: 'Interest payment method',
      required: true,
      options: {
        options: [
          { label: 'C - Capitalize', value: 'C' },
        ],
      },
    }),
    interestRate: Property.ShortText({
      displayName: 'Interest Rate',
      description: 'Interest rate (e.g., 6.2500)',
      required: true,
    }),
    interestRateType: Property.StaticDropdown({
      displayName: 'Interest Rate Type',
      description: 'Interest rate type',
      required: true,
      options: {
        options: [
          { label: 'F - Fixed Rate', value: 'F' },
          { label: 'S - Step Rate', value: 'S' },
          { label: 'V - Variable Rate', value: 'V' },
        ],
      },
    }),
    compoundFrequency: Property.StaticDropdown({
      displayName: 'Compound Frequency',
      description: 'Compound frequency',
      required: true,
      options: {
        options: [
          { label: 'C - Daily', value: 'C' },
          { label: 'P - Periodic', value: 'P' },
          { label: 'S - Simple', value: 'S' },
        ],
      },
    }),
    combinedChecks: Property.StaticDropdown({
      displayName: 'Combined Checks',
      description: 'Combined checks',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    combinedInterestNotices: Property.StaticDropdown({
      displayName: 'Combined Interest Notices',
      description: 'Combined interest notices',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    controlMaturity: Property.StaticDropdown({
      displayName: 'Control Maturity',
      description: 'Control maturity',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    maturityOption: Property.StaticDropdown({
      displayName: 'Maturity Option',
      description: 'Maturity option',
      required: true,
      options: {
        options: [
          { label: 'P - Principal only', value: 'P' },
          { label: 'I - Interest only', value: 'I' },
          { label: 'B - Both principal and interest', value: 'B' },
          { label: 'N - No auto renewal', value: 'N' },
        ],
      },
    }),
    autoCloseCode: Property.StaticDropdown({
      displayName: 'Auto Close Code',
      description: 'Auto close code',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    mailSortCode: Property.ShortText({
      displayName: 'Mail Sort Code',
      description: 'Mail sort code',
      required: true,
    }),
    statementType: Property.ShortText({
      displayName: 'Statement Type',
      description: 'Statement type',
      required: true,
    }),
    printApyeOnStatement: Property.StaticDropdown({
      displayName: 'Print APYE On Statement',
      description: 'Print APYE on statement',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    purgeControlCode: Property.ShortText({
      displayName: 'Purge Control Code',
      description: 'Purge control code',
      required: true,
    }),
    planNumber: Property.Number({
      displayName: 'Plan Number',
      description: 'IRA plan number',
      required: true,
    }),
    planType: Property.ShortText({
      displayName: 'Plan Type',
      description: 'IRA plan type',
      required: true,
    }),
    additionalFields: Property.Json({
      displayName: 'Additional Fields',
      description: 'Additional fields to include in the request body as JSON object',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      customerId: props.customerId,
      accountNumber: props.accountNumber,
      productType: props.productType,
      branchNumber: props.branchNumber,
      tinStatus: props.tinStatus,
      openingAmount: props.openingAmount,
      effectiveOpenDate: props.effectiveOpenDate,
      shortName: props.shortName,
      generalLedgerType: props.generalLedgerType,
      personalNonPersonal: props.personalNonPersonal,
      passbookAccount: props.passbookAccount,
      rateIndex: props.rateIndex,
      interestYearBase: props.interestYearBase,
      maturityTerm: props.maturityTerm,
      maturityTermType: props.maturityTermType,
      interestPeriodTerm: props.interestPeriodTerm,
      interestPeriodType: props.interestPeriodType,
      paymentMethod: props.paymentMethod,
      interestRate: props.interestRate,
      interestRateType: props.interestRateType,
      compoundFrequency: props.compoundFrequency,
      combinedChecks: props.combinedChecks,
      combinedInterestNotices: props.combinedInterestNotices,
      controlMaturity: props.controlMaturity,
      maturityOption: props.maturityOption,
      autoCloseCode: props.autoCloseCode,
      mailSortCode: props.mailSortCode,
      statementType: props.statementType,
      printApyeOnStatement: props.printApyeOnStatement,
      purgeControlCode: props.purgeControlCode,
      planNumber: props.planNumber,
      planType: props.planType,
    };

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/time-deposits/ira/staging`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Add a retirement plan
 */
export const time_deposit_ira_plan_add = createAction({
  name: 'time_deposit_ira_plan_add',
  auth: fisHorizonAuth,
  displayName: 'Time Deposit - Add IRA Plan',
  description: 'Add a retirement (IRA) plan for a customer',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer identification number (up to 14 characters)',
      required: true,
    }),
    planNumber: Property.Number({
      displayName: 'Plan Number',
      description: 'Plan number (up to 9 digits)',
      required: true,
    }),
    planType: Property.ShortText({
      displayName: 'Plan Type',
      description: 'Plan type',
      required: true,
    }),
    shortName: Property.ShortText({
      displayName: 'Short Name',
      description: 'Customer short name (up to 20 characters)',
      required: true,
    }),
    dateOpened: Property.ShortText({
      displayName: 'Date Opened',
      description: 'Date opened (CCYYMMDD). Must be less than or equal to current processing date.',
      required: true,
    }),
    birthDate: Property.ShortText({
      displayName: 'Birth Date',
      description: 'Birth date (CCYYMMDD). Must be less than or equal to current processing date.',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch number (up to 3 characters)',
      required: true,
    }),
    effectiveDate: Property.ShortText({
      displayName: 'Effective Date',
      description: 'Effective date (CCYYMMDD). Must be less than or equal to current processing date.',
      required: true,
    }),
    spousalPlanNumber: Property.Number({
      displayName: 'Spousal Plan Number',
      description: 'Optional: Spousal plan number',
      required: false,
    }),
    employerTaxId: Property.ShortText({
      displayName: 'Employer Tax ID',
      description: 'Optional: Employer tax ID (up to 9 characters)',
      required: false,
    }),
    employerName: Property.ShortText({
      displayName: 'Employer Name',
      description: 'Optional: Employer name (up to 35 characters)',
      required: false,
    }),
    nextServiceChargeDate: Property.ShortText({
      displayName: 'Next Service Charge Date',
      description: 'Next service charge date (CCYYMMDD). Required if serviceChargeType is not blank.',
      required: false,
    }),
    serviceChargeType: Property.ShortText({
      displayName: 'Service Charge Type',
      description: 'Service charge type (user defined, up to 3 characters)',
      required: false,
    }),
    serviceChargeFrequency: Property.StaticDropdown({
      displayName: 'Service Charge Frequency',
      description: 'Service charge frequency. Required if serviceChargeType is not blank.',
      required: false,
      options: {
        options: [
          { label: 'A - Annual', value: 'A' },
          { label: 'M - Monthly', value: 'M' },
          { label: 'Q - Quarterly', value: 'Q' },
          { label: 'S - Semi Annual', value: 'S' },
        ],
      },
    }),
    serviceChargeDay: Property.Number({
      displayName: 'Service Charge Day',
      description: 'Service charge day (1-31). Required if serviceChargeType is not blank.',
      required: false,
    }),
    serviceChargeSequence: Property.StaticDropdown({
      displayName: 'Service Charge Sequence',
      description: 'Service charge sequence. Required if serviceChargeType is not blank.',
      required: false,
      options: {
        options: [
          { label: '00 - Account Level, User Defined', value: '00' },
          { label: '01 - Lowest to Highest Rate Account', value: '01' },
          { label: '02 - Highest to Lowest Rate Account', value: '02' },
          { label: '03 - Lowest to Highest Account', value: '03' },
          { label: '04 - Highest to Lowest Account', value: '04' },
          { label: '99 - All Account in Plan', value: '99' },
        ],
      },
    }),
    serviceChargeApplication: Property.StaticDropdown({
      displayName: 'Service Charge Application',
      description: 'Service charge application. Required if serviceChargeType is not blank.',
      required: false,
      options: {
        options: [
          { label: 'CD - Certificate of Deposit', value: 'CD' },
          { label: 'DD - Checking Account', value: 'DD' },
          { label: 'IR - Individual Retirement Account', value: 'IR' },
          { label: 'SV - Savings Account', value: 'SV' },
        ],
      },
    }),
    serviceChargeAccount: Property.ShortText({
      displayName: 'Service Charge Account',
      description: 'Service charge account (up to 15 characters). Required if serviceChargeType is not blank.',
      required: false,
    }),
    retirementDate: Property.ShortText({
      displayName: 'Retirement Date',
      description: 'Retirement date (CCYYMMDD)',
      required: false,
    }),
    additionalFields: Property.Json({
      displayName: 'Additional Fields',
      description: 'Additional fields to include in the request body as JSON object',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const props = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      planNumber: props.planNumber,
      planType: props.planType,
      shortName: props.shortName,
      dateOpened: props.dateOpened,
      birthDate: props.birthDate,
      branchNumber: props.branchNumber,
      effectiveDate: props.effectiveDate,
    };

    if (props.spousalPlanNumber !== undefined && props.spousalPlanNumber !== null) {
      body['spousalPlanNumber'] = props.spousalPlanNumber;
    }
    if (props.employerTaxId) {
      body['employerTaxId'] = props.employerTaxId;
    }
    if (props.employerName) {
      body['employerName'] = props.employerName;
    }
    if (props.nextServiceChargeDate) {
      body['nextServiceChargeDate'] = props.nextServiceChargeDate;
    }
    if (props.serviceChargeType) {
      body['serviceChargeType'] = props.serviceChargeType;
    }
    if (props.serviceChargeFrequency) {
      body['serviceChargeFrequency'] = props.serviceChargeFrequency;
    }
    if (props.serviceChargeDay !== undefined && props.serviceChargeDay !== null) {
      body['serviceChargeDay'] = props.serviceChargeDay;
    }
    if (props.serviceChargeSequence) {
      body['serviceChargeSequence'] = props.serviceChargeSequence;
    }
    if (props.serviceChargeApplication) {
      body['serviceChargeApplication'] = props.serviceChargeApplication;
    }
    if (props.serviceChargeAccount) {
      body['serviceChargeAccount'] = props.serviceChargeAccount;
    }
    if (props.retirementDate) {
      body['retirementDate'] = props.retirementDate;
    }

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/customers/${props.customerId}/ira-plans`,
      headers,
      body,
    });

    return response.body;
  },
});
