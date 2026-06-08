import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

/**
 * Safe Deposit - Account Inquiry
 * GET /accounts/{applicationCode}/{accountNumber}
 * Retrieve basic information relating to a safe deposit account
 */
export const safe_deposit_account_inquiry = createAction({
  name: 'safe_deposit_account_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Safe Deposit - Account Inquiry',
  description: 'Retrieve basic information relating to a safe deposit account',
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
      description: 'Application Code for Safe Deposit Box',
      required: true,
      options: {
        options: [
          { label: 'BX - Safe Deposit Box', value: 'BX' },
        ],
      },
      defaultValue: 'BX',
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Specifies the unique identifier associated with a customer. Right-justified, zero filled, up to 14 digits',
      required: false,
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Return response in uppercase',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, applicationCode, accountNumber, customerId, returnUppercase } = context.propsValue;

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
    if (customerId) {
      queryParams['customerId'] = customerId;
    }
    if (returnUppercase) {
      queryParams['returnUppercase'] = returnUppercase;
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/safe-deposit/v1/accounts/${applicationCode}/${accountNumber}${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Safe Deposit - Transaction Inquiry
 * GET /accounts/{applicationCode}/{accountNumber}/transactions
 * Retrieve a list of historic transactions relating to an account
 */
export const safe_deposit_transaction_inquiry = createAction({
  name: 'safe_deposit_transaction_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Safe Deposit - Transaction Inquiry',
  description: 'Retrieve a list of historic transactions relating to a safe deposit account',
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
      description: 'Application Code for Safe Deposit Box',
      required: true,
      options: {
        options: [
          { label: 'BX - Safe Deposit Box', value: 'BX' },
        ],
      },
      defaultValue: 'BX',
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    dateSelectOption: Property.StaticDropdown({
      displayName: 'Date Select Option',
      description: 'Date selection option for transactions',
      required: true,
      options: {
        options: [
          { label: 'M - Today\'s memo posted transactions', value: 'M' },
          { label: 'P - All transactions from last BOSS processing run', value: 'P' },
          { label: 'R - User specified date range (Effective Dates)', value: 'R' },
          { label: 'S - All transactions since last statement date', value: 'S' },
          { label: 'T - User specified date range (Transaction Dates)', value: 'T' },
        ],
      },
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First request or next request for additional transactions',
      required: true,
      options: {
        options: [
          { label: 'F - First request', value: 'F' },
          { label: 'N - Next request for additional transactions', value: 'N' },
        ],
      },
      defaultValue: 'F',
    }),
    numberToReturn: Property.Number({
      displayName: 'Number to Return',
      description: 'Number of transactions to return at a time (0-999). 999 returns as many as can fit in buffer',
      required: true,
      defaultValue: 999,
    }),
    beginDate: Property.Number({
      displayName: 'Begin Date',
      description: 'Begin date for date range (YYYYMMDD format). Required when Date Select Option is R, T, or M',
      required: false,
    }),
    endDate: Property.Number({
      displayName: 'End Date',
      description: 'End date for date range (YYYYMMDD format). Optional when Date Select Option is R or T. Defaults to 99999999 if zero',
      required: false,
    }),
    returnMemoPostTransaction: Property.StaticDropdown({
      displayName: 'Return Memo Post Transaction',
      description: 'Option for returning memo post transactions',
      required: false,
      options: {
        options: [
          { label: 'A - Return all of today\'s memo post transactions', value: 'A' },
          { label: 'Y - Return today\'s memo post transactions (excluding those not affecting available balance)', value: 'Y' },
          { label: 'N - Do not return memo post transactions', value: 'N' },
        ],
      },
    }),
    returnPackagePostItems: Property.StaticDropdown({
      displayName: 'Return Package Post Items',
      description: 'Option for returning package post items',
      required: false,
      options: {
        options: [
          { label: 'A - Return all items (including PKPST)', value: 'A' },
          { label: 'P - Return history items and package posted check', value: 'P' },
        ],
      },
    }),
    returnScheduledExternalTransfers: Property.StaticDropdown({
      displayName: 'Return Scheduled External Transfers',
      description: 'Option for returning scheduled auto transfers',
      required: false,
      options: {
        options: [
          { label: 'Y - Return scheduled Auto Transfers', value: 'Y' },
          { label: 'N - Do not return scheduled Auto Transfers', value: 'N' },
        ],
      },
    }),
    sequenceOption: Property.StaticDropdown({
      displayName: 'Sequence Option',
      description: 'Order of returned transactions',
      required: false,
      options: {
        options: [
          { label: 'A - Ascending order', value: 'A' },
          { label: 'D - Descending order', value: 'D' },
        ],
      },
      defaultValue: 'A',
    }),
    searchToken: Property.ShortText({
      displayName: 'Search Token',
      description: 'Search Token for stateless middleware processing (max 20 characters)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization,
      sourceId,
      applicationCode,
      accountNumber,
      dateSelectOption,
      firstNext,
      numberToReturn,
      beginDate,
      endDate,
      returnMemoPostTransaction,
      returnPackagePostItems,
      returnScheduledExternalTransfers,
      sequenceOption,
      searchToken,
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
    queryParams['dateSelectOption'] = dateSelectOption;
    queryParams['firstNext'] = firstNext;
    queryParams['numberToReturn'] = String(numberToReturn);

    if (beginDate !== undefined && beginDate !== null) {
      queryParams['beginDate'] = String(beginDate);
    }
    if (endDate !== undefined && endDate !== null) {
      queryParams['endDate'] = String(endDate);
    }
    if (returnMemoPostTransaction) {
      queryParams['returnMemoPostTransaction'] = returnMemoPostTransaction;
    }
    if (returnPackagePostItems) {
      queryParams['returnPackagePostItems'] = returnPackagePostItems;
    }
    if (returnScheduledExternalTransfers) {
      queryParams['returnScheduledExternalTransfers'] = returnScheduledExternalTransfers;
    }
    if (sequenceOption) {
      queryParams['sequenceOption'] = sequenceOption;
    }
    if (searchToken) {
      queryParams['searchToken'] = searchToken;
    }

    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/safe-deposit/v1/accounts/${applicationCode}/${accountNumber}/transactions${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Safe Deposit - Box Inquiry
 * GET /accounts/safe-deposit-box
 * Retrieve the details of a safe deposit box account information
 */
export const safe_deposit_box_inquiry = createAction({
  name: 'safe_deposit_box_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Safe Deposit - Box Inquiry',
  description: 'Retrieve the details of a safe deposit box account information',
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
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch number (max 3 digits). Conditional: Use branch and box numbers OR account number',
      required: false,
    }),
    boxNumber: Property.ShortText({
      displayName: 'Box Number',
      description: 'Box number (max 5 characters). Conditional: Use branch and box numbers OR account number',
      required: false,
    }),
    accountNumber: Property.Number({
      displayName: 'Account Number',
      description: 'Box account number (max 10 digits). Conditional: Use account number OR branch and box numbers',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, branchNumber, boxNumber, accountNumber } = context.propsValue;

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
    if (branchNumber !== undefined && branchNumber !== null) {
      queryParams['branchNumber'] = String(branchNumber);
    }
    if (boxNumber) {
      queryParams['boxNumber'] = boxNumber;
    }
    if (accountNumber !== undefined && accountNumber !== null) {
      queryParams['accountNumber'] = String(accountNumber);
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/safe-deposit/v1/accounts/safe-deposit-box${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * Safe Deposit - Box Maintain
 * PUT /accounts/safe-deposit-box
 * Maintain a safe deposit box account
 */
export const safe_deposit_box_maintain = createAction({
  name: 'safe_deposit_box_maintain',
  auth: fisHorizonAuth,
  displayName: 'Safe Deposit - Box Maintain',
  description: 'Maintain a safe deposit box account',
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
    // Required fields
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch number (1-3 characters)',
      required: true,
    }),
    boxNumber: Property.ShortText({
      displayName: 'Box Number',
      description: 'Box number (1-5 characters)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Box account number (1-10 characters)',
      required: true,
    }),
    boxType: Property.ShortText({
      displayName: 'Box Type',
      description: 'Box Type populated from the BX01 transaction (1-3 characters)',
      required: true,
    }),
    openDate: Property.Number({
      displayName: 'Open Date',
      description: 'A valid date less than or equal to current date (YYYYMMDD format)',
      required: true,
    }),
    status: Property.StaticDropdown({
      displayName: 'Status',
      description: 'Box status',
      required: true,
      options: {
        options: [
          { label: 'D - Drill pending', value: 'D' },
          { label: 'O - Out of service', value: 'O' },
          { label: 'W - Pending activation', value: 'W' },
          { label: '1 - Rented', value: '1' },
          { label: '2 - Available', value: '2' },
          { label: '9 - Deleted', value: '9' },
        ],
      },
    }),
    autodraftIncrement: Property.Number({
      displayName: 'Autodraft Increment',
      description: 'The number of months the safe deposit box is occupied (1-2 digits)',
      required: true,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'Valid general ledger type (1-4 characters)',
      required: true,
    }),
    automaticTransfer: Property.StaticDropdown({
      displayName: 'Automatic Transfer',
      description: 'Automatic transfer setting. If 5 or 9, auto transfer fields are populated',
      required: true,
      options: {
        options: [
          { label: 'N - No, Auto transfer disabled', value: 'N' },
          { label: '5 - ATS, do not bill', value: '5' },
          { label: '9 - ATS, send all bills', value: '9' },
        ],
      },
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'The customer key from the customer record of primary account holder (up to 14 characters)',
      required: true,
    }),
    // Optional fields
    boxPrice: Property.Number({
      displayName: 'Box Price',
      description: 'Box Price (7 digits with 2 decimal places)',
      required: false,
    }),
    discountCode: Property.ShortText({
      displayName: 'Discount Code',
      description: 'Box discount code (1 character)',
      required: false,
    }),
    salesTax: Property.StaticDropdown({
      displayName: 'Sales Tax',
      description: 'Sales tax setting',
      required: false,
      options: {
        options: [
          { label: 'Use BCR default', value: '' },
          { label: 'Y - Apply sales tax', value: 'Y' },
          { label: 'N - Do not apply sales tax', value: 'N' },
        ],
      },
    }),
    dateLastPayment: Property.Number({
      displayName: 'Date Last Payment',
      description: 'Last pay date (YYYYMMDD format)',
      required: false,
    }),
    dateNextPayment: Property.Number({
      displayName: 'Date Next Payment',
      description: 'A valid date in the future based on the payment contract (YYYYMMDD format)',
      required: false,
    }),
    amountDue: Property.Number({
      displayName: 'Amount Due',
      description: 'Due amount represents the entire amount owed (7 digits with 2 decimal places)',
      required: false,
    }),
    billDate: Property.Number({
      displayName: 'Bill Date',
      description: 'Billed to date represents the date thru which bills are generated (YYYYMMDD format)',
      required: false,
    }),
    drillNoticeDate: Property.Number({
      displayName: 'Drill Notice Date',
      description: 'Drill notice date reflects the last time that the box had to be drilled to open (YYYYMMDD format)',
      required: false,
    }),
    lastContactDate: Property.Number({
      displayName: 'Last Contact Date',
      description: 'Last date contact (YYYYMMDD format)',
      required: false,
    }),
    abandonedPropFlag: Property.StaticDropdown({
      displayName: 'Abandoned Property Flag',
      description: 'Abandoned property flag',
      required: false,
      options: {
        options: [
          { label: 'Blank', value: '' },
          { label: 'Y', value: 'Y' },
        ],
      },
    }),
    holdFlag: Property.StaticDropdown({
      displayName: 'Hold Flag',
      description: 'Hold flag',
      required: false,
      options: {
        options: [
          { label: 'Blank - No Hold', value: '' },
          { label: 'D - Dormant', value: 'D' },
          { label: 'F - Forced', value: 'F' },
          { label: 'P - Past Due', value: 'P' },
          { label: 'S - Surrendered', value: 'S' },
        ],
      },
    }),
    lastEntryDate: Property.Number({
      displayName: 'Last Entry Date',
      description: 'Date last entry (YYYYMMDD format)',
      required: false,
    }),
    lastEntryCode: Property.StaticDropdown({
      displayName: 'Last Entry Code',
      description: 'Last entry code. Required if date last entry is a valid date',
      required: false,
      options: {
        options: [
          { label: 'Blank', value: '' },
          { label: 'B - Bank', value: 'B' },
          { label: 'C - Customer', value: 'C' },
          { label: 'F - Force Entry', value: 'F' },
          { label: 'L - Lost Key', value: 'L' },
        ],
      },
    }),
    numberBoxKeys: Property.Number({
      displayName: 'Number of Box Keys',
      description: 'Number of keys issued to the customer (1 digit)',
      required: false,
    }),
    salesTaxDue: Property.Number({
      displayName: 'Sales Tax Due',
      description: 'Sales tax due (7 digits with 2 decimal places)',
      required: false,
    }),
    // Auto Transfer fields
    debitApplication: Property.StaticDropdown({
      displayName: 'Debit Application',
      description: 'Debit application (conditional for auto transfer)',
      required: false,
      options: {
        options: [
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'Blank - Not a HORIZON account', value: '' },
        ],
      },
    }),
    debitAccount: Property.ShortText({
      displayName: 'Debit Account',
      description: 'Debit account number (up to 17 characters)',
      required: false,
    }),
    generalLedgerBranch: Property.ShortText({
      displayName: 'General Ledger Branch',
      description: 'General ledger branch (up to 4 characters)',
      required: false,
    }),
    generalLedgerCenter: Property.Number({
      displayName: 'General Ledger Center',
      description: 'General ledger center (up to 4 digits)',
      required: false,
    }),
    externalDebit: Property.StaticDropdown({
      displayName: 'External Debit',
      description: 'External debit flag',
      required: false,
      options: {
        options: [
          { label: 'Y - External account', value: 'Y' },
          { label: 'N - Not external account', value: 'N' },
        ],
      },
    }),
    individualIdentification: Property.ShortText({
      displayName: 'Individual Identification',
      description: 'Individual identification for external auto transfer (up to 15 characters)',
      required: false,
    }),
    additionalInfo1: Property.ShortText({
      displayName: 'Additional Info 1',
      description: 'Additional information for external auto transfer (up to 40 characters)',
      required: false,
    }),
    additionalInfo2: Property.ShortText({
      displayName: 'Additional Info 2',
      description: 'Additional information for external auto transfer (up to 40 characters)',
      required: false,
    }),
    holdTransfer: Property.StaticDropdown({
      displayName: 'Hold Transfer',
      description: 'Hold flag for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'N - No', value: 'N' },
          { label: 'Y - Yes', value: 'Y' },
          { label: 'O - Once', value: 'O' },
        ],
      },
    }),
    routingNumber: Property.ShortText({
      displayName: 'Routing Number',
      description: 'Routing and transit number for external account (9 characters)',
      required: false,
    }),
    discretionaryData: Property.ShortText({
      displayName: 'Discretionary Data',
      description: 'Discretionary data for external auto transfer (up to 2 characters)',
      required: false,
    }),
    transactionCode: Property.ShortText({
      displayName: 'Transaction Code',
      description: 'Transaction code for auto transfer (up to 4 characters)',
      required: false,
    }),
    debitDescription: Property.ShortText({
      displayName: 'Debit Description',
      description: 'Debit description for auto transfer (up to 30 characters)',
      required: false,
    }),
    creditDescription: Property.ShortText({
      displayName: 'Credit Description',
      description: 'Credit description for auto transfer (up to 30 characters)',
      required: false,
    }),
    transferDescription: Property.ShortText({
      displayName: 'Transfer Description',
      description: 'Transfer description for auto transfer (up to 40 characters)',
      required: false,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Amount of transfer (up to 15 digits)',
      required: false,
    }),
    feeOption: Property.StaticDropdown({
      displayName: 'Fee Option',
      description: 'Fee option for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    frequencyTerm: Property.Number({
      displayName: 'Frequency Term',
      description: 'Number of months or days controlling the auto transfer (up to 3 digits)',
      required: false,
    }),
    frequencyCode: Property.StaticDropdown({
      displayName: 'Frequency Code',
      description: 'Frequency code for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'E - Month-end', value: 'E' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    noticeOption: Property.StaticDropdown({
      displayName: 'Notice Option',
      description: 'Notice option for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'B - Both', value: 'B' },
          { label: 'F - From Account', value: 'F' },
          { label: 'I - NSF notice', value: 'I' },
          { label: 'N - No', value: 'N' },
          { label: 'T - To Account', value: 'T' },
        ],
      },
    }),
    nextTransferDate: Property.Number({
      displayName: 'Next Transfer Date',
      description: 'Next transfer date (YYYYMMDD format)',
      required: false,
    }),
    endDate: Property.Number({
      displayName: 'End Date',
      description: 'End date for auto transfer (YYYYMMDD format)',
      required: false,
    }),
    availableBalanceFlag: Property.StaticDropdown({
      displayName: 'Available Balance Flag',
      description: 'Available balance calculation for auto transfer',
      required: false,
      options: {
        options: [
          { label: '1 - Add RRS to Calculation', value: '1' },
          { label: '2 - Add OD limit to Calc', value: '2' },
          { label: '3 - Add RRS+OD Limit to calc', value: '3' },
          { label: '4 - Do not add RRS+OD Limit to Calc', value: '4' },
          { label: '5 - Include RRS and Dynamic Balance', value: '5' },
          { label: '6 - Include OD Limit and Dynamic Balance', value: '6' },
          { label: '7 - Include RRS, OD Limit and Dynamic Balance', value: '7' },
          { label: '8 - Include Dynamic Balance Only', value: '8' },
        ],
      },
    }),
    achTransferRequestMethod: Property.StaticDropdown({
      displayName: 'ACH Transfer Request Method',
      description: 'ACH transfer request method. Required if External Debit is Y',
      required: false,
      options: {
        options: [
          { label: 'Blank - No external debit', value: '' },
          { label: 'E - Electronically', value: 'E' },
          { label: 'P - Person', value: 'P' },
          { label: 'T - Telephone', value: 'T' },
        ],
      },
    }),
    lateChargePointer: Property.ShortText({
      displayName: 'Late Charge Pointer',
      description: 'Late charge pointer (up to 3 characters)',
      required: false,
    }),
    lateChargesWaived: Property.Number({
      displayName: 'Late Charges Waived',
      description: 'Late charges waived life to date (7 digits with 2 decimal places)',
      required: false,
    }),
    feeWaived: Property.Number({
      displayName: 'Fee Waived',
      description: 'Fee waived life to date (7 digits with 2 decimal places)',
      required: false,
    }),
    applyFeeTaxOverrideFlag: Property.StaticDropdown({
      displayName: 'Apply Fee Tax Override Flag',
      description: 'Apply fee tax override flag',
      required: false,
      options: {
        options: [
          { label: 'Blank - Use bank control default', value: '' },
          { label: 'N - Do not apply tax to fees', value: 'N' },
          { label: 'Y - Apply tax to fees', value: 'Y' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, ...bodyProps } = context.propsValue;

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

    // Build request body with only defined values
    const body: Record<string, unknown> = {};

    // Required fields
    body['branchNumber'] = bodyProps.branchNumber;
    body['boxNumber'] = bodyProps.boxNumber;
    body['accountNumber'] = bodyProps.accountNumber;
    body['boxType'] = bodyProps.boxType;
    body['openDate'] = bodyProps.openDate;
    body['status'] = bodyProps.status;
    body['autodraftIncrement'] = bodyProps.autodraftIncrement;
    body['generalLedgerType'] = bodyProps.generalLedgerType;
    body['automaticTransfer'] = bodyProps.automaticTransfer;
    body['customerId'] = bodyProps.customerId;

    // Optional fields - only add if defined
    if (bodyProps.boxPrice !== undefined && bodyProps.boxPrice !== null) {
      body['boxPrice'] = bodyProps.boxPrice;
    }
    if (bodyProps.discountCode) {
      body['discountCode'] = bodyProps.discountCode;
    }
    if (bodyProps.salesTax !== undefined) {
      body['salesTax'] = bodyProps.salesTax;
    }
    if (bodyProps.dateLastPayment !== undefined && bodyProps.dateLastPayment !== null) {
      body['dateLastPayment'] = bodyProps.dateLastPayment;
    }
    if (bodyProps.dateNextPayment !== undefined && bodyProps.dateNextPayment !== null) {
      body['dateNextPayment'] = bodyProps.dateNextPayment;
    }
    if (bodyProps.amountDue !== undefined && bodyProps.amountDue !== null) {
      body['amountDue'] = bodyProps.amountDue;
    }
    if (bodyProps.billDate !== undefined && bodyProps.billDate !== null) {
      body['billDate'] = bodyProps.billDate;
    }
    if (bodyProps.drillNoticeDate !== undefined && bodyProps.drillNoticeDate !== null) {
      body['drillNoticeDate'] = bodyProps.drillNoticeDate;
    }
    if (bodyProps.lastContactDate !== undefined && bodyProps.lastContactDate !== null) {
      body['lastContactDate'] = bodyProps.lastContactDate;
    }
    if (bodyProps.abandonedPropFlag !== undefined) {
      body['abandonedPropFlag'] = bodyProps.abandonedPropFlag;
    }
    if (bodyProps.holdFlag !== undefined) {
      body['holdFlag'] = bodyProps.holdFlag;
    }
    if (bodyProps.lastEntryDate !== undefined && bodyProps.lastEntryDate !== null) {
      body['lastEntryDate'] = bodyProps.lastEntryDate;
    }
    if (bodyProps.lastEntryCode !== undefined) {
      body['lastEntryCode'] = bodyProps.lastEntryCode;
    }
    if (bodyProps.numberBoxKeys !== undefined && bodyProps.numberBoxKeys !== null) {
      body['numberBoxKeys'] = bodyProps.numberBoxKeys;
    }
    if (bodyProps.salesTaxDue !== undefined && bodyProps.salesTaxDue !== null) {
      body['salesTaxDue'] = bodyProps.salesTaxDue;
    }
    if (bodyProps.debitApplication !== undefined) {
      body['debitApplication'] = bodyProps.debitApplication;
    }
    if (bodyProps.debitAccount) {
      body['debitAccount'] = bodyProps.debitAccount;
    }
    if (bodyProps.generalLedgerBranch) {
      body['generalLedgerBranch'] = bodyProps.generalLedgerBranch;
    }
    if (bodyProps.generalLedgerCenter !== undefined && bodyProps.generalLedgerCenter !== null) {
      body['generalLedgerCenter'] = bodyProps.generalLedgerCenter;
    }
    if (bodyProps.externalDebit) {
      body['externalDebit'] = bodyProps.externalDebit;
    }
    if (bodyProps.individualIdentification) {
      body['individualIdentification'] = bodyProps.individualIdentification;
    }
    if (bodyProps.additionalInfo1) {
      body['additionalInfo1'] = bodyProps.additionalInfo1;
    }
    if (bodyProps.additionalInfo2) {
      body['additionalInfo2'] = bodyProps.additionalInfo2;
    }
    if (bodyProps.holdTransfer) {
      body['holdTransfer'] = bodyProps.holdTransfer;
    }
    if (bodyProps.routingNumber) {
      body['routingNumber'] = bodyProps.routingNumber;
    }
    if (bodyProps.discretionaryData) {
      body['discretionaryData'] = bodyProps.discretionaryData;
    }
    if (bodyProps.transactionCode) {
      body['transactionCode'] = bodyProps.transactionCode;
    }
    if (bodyProps.debitDescription) {
      body['debitDescription'] = bodyProps.debitDescription;
    }
    if (bodyProps.creditDescription) {
      body['creditDescription'] = bodyProps.creditDescription;
    }
    if (bodyProps.transferDescription) {
      body['transferDescription'] = bodyProps.transferDescription;
    }
    if (bodyProps.amount !== undefined && bodyProps.amount !== null) {
      body['amount'] = bodyProps.amount;
    }
    if (bodyProps.feeOption) {
      body['feeOption'] = bodyProps.feeOption;
    }
    if (bodyProps.frequencyTerm !== undefined && bodyProps.frequencyTerm !== null) {
      body['frequencyTerm'] = bodyProps.frequencyTerm;
    }
    if (bodyProps.frequencyCode) {
      body['frequencyCode'] = bodyProps.frequencyCode;
    }
    if (bodyProps.noticeOption) {
      body['noticeOption'] = bodyProps.noticeOption;
    }
    if (bodyProps.nextTransferDate !== undefined && bodyProps.nextTransferDate !== null) {
      body['nextTransferDate'] = bodyProps.nextTransferDate;
    }
    if (bodyProps.endDate !== undefined && bodyProps.endDate !== null) {
      body['endDate'] = bodyProps.endDate;
    }
    if (bodyProps.availableBalanceFlag) {
      body['availableBalanceFlag'] = bodyProps.availableBalanceFlag;
    }
    if (bodyProps.achTransferRequestMethod !== undefined) {
      body['achTransferRequestMethod'] = bodyProps.achTransferRequestMethod;
    }
    if (bodyProps.lateChargePointer) {
      body['lateChargePointer'] = bodyProps.lateChargePointer;
    }
    if (bodyProps.lateChargesWaived !== undefined && bodyProps.lateChargesWaived !== null) {
      body['lateChargesWaived'] = bodyProps.lateChargesWaived;
    }
    if (bodyProps.feeWaived !== undefined && bodyProps.feeWaived !== null) {
      body['feeWaived'] = bodyProps.feeWaived;
    }
    if (bodyProps.applyFeeTaxOverrideFlag !== undefined) {
      body['applyFeeTaxOverrideFlag'] = bodyProps.applyFeeTaxOverrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/safe-deposit/v1/accounts/safe-deposit-box`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Safe Deposit - Box Add
 * POST /accounts/safe-deposit-box
 * Add a safe deposit box account
 */
export const safe_deposit_box_add = createAction({
  name: 'safe_deposit_box_add',
  auth: fisHorizonAuth,
  displayName: 'Safe Deposit - Box Add',
  description: 'Add a safe deposit box account',
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
    // Required fields
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch number (1-3 characters)',
      required: true,
    }),
    boxNumber: Property.ShortText({
      displayName: 'Box Number',
      description: 'Box number (1-5 characters)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Box account number (1-10 characters)',
      required: true,
    }),
    boxType: Property.ShortText({
      displayName: 'Box Type',
      description: 'Box Type populated from the BX01 transaction (1-3 characters)',
      required: true,
    }),
    openDate: Property.Number({
      displayName: 'Open Date',
      description: 'A valid date less than or equal to current date (YYYYMMDD format)',
      required: true,
    }),
    status: Property.StaticDropdown({
      displayName: 'Status',
      description: 'Status for adding a safe deposit box',
      required: true,
      options: {
        options: [
          { label: '1 - Rented', value: '1' },
        ],
      },
      defaultValue: '1',
    }),
    autodraftIncrement: Property.Number({
      displayName: 'Autodraft Increment',
      description: 'The number of months the safe deposit box is occupied (1-2 digits)',
      required: true,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'Valid general ledger type (1-4 characters)',
      required: true,
    }),
    automaticTransfer: Property.StaticDropdown({
      displayName: 'Automatic Transfer',
      description: 'Automatic transfer setting. If 5 or 9, auto transfer fields must be populated',
      required: true,
      options: {
        options: [
          { label: 'N - No, Auto transfer disabled', value: 'N' },
          { label: '5 - ATS, do not bill', value: '5' },
          { label: '9 - ATS, send all bills', value: '9' },
        ],
      },
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'The customer key from the customer record of primary account holder (up to 14 characters)',
      required: true,
    }),
    // Optional fields
    boxPrice: Property.Number({
      displayName: 'Box Price',
      description: 'Box Price Filler (7 digits with 2 decimal places)',
      required: false,
    }),
    discountCode: Property.ShortText({
      displayName: 'Discount Code',
      description: 'Box discount code (1 character)',
      required: false,
    }),
    salesTax: Property.StaticDropdown({
      displayName: 'Sales Tax',
      description: 'Sales tax setting',
      required: false,
      options: {
        options: [
          { label: 'Use BCR default', value: '' },
          { label: 'Y - Apply sales tax', value: 'Y' },
          { label: 'N - Do not apply sales tax', value: 'N' },
        ],
      },
    }),
    dateLastPayment: Property.Number({
      displayName: 'Date Last Payment',
      description: 'Last pay date (YYYYMMDD format)',
      required: false,
    }),
    dateNextPayment: Property.Number({
      displayName: 'Date Next Payment',
      description: 'A valid date in the future based on the payment contract (YYYYMMDD format)',
      required: false,
    }),
    lastContactDate: Property.Number({
      displayName: 'Last Contact Date',
      description: 'Last date contact (YYYYMMDD format)',
      required: false,
    }),
    abandonedPropFlag: Property.StaticDropdown({
      displayName: 'Abandoned Property Flag',
      description: 'Abandoned property flag',
      required: false,
      options: {
        options: [
          { label: 'Blank', value: '' },
          { label: 'Y', value: 'Y' },
        ],
      },
    }),
    holdFlag: Property.ShortText({
      displayName: 'Hold Flag',
      description: 'Hold flag to add a safe deposit box (filled with 1 for Rented)',
      required: false,
    }),
    lastEntryDate: Property.Number({
      displayName: 'Last Entry Date',
      description: 'Date last entry (YYYYMMDD format)',
      required: false,
    }),
    lastEntryCode: Property.StaticDropdown({
      displayName: 'Last Entry Code',
      description: 'Last entry code. Required if date last entry is a valid date',
      required: false,
      options: {
        options: [
          { label: 'Blank', value: '' },
          { label: 'B - Bank', value: 'B' },
          { label: 'C - Customer', value: 'C' },
          { label: 'F - Force Entry', value: 'F' },
          { label: 'L - Lost Key', value: 'L' },
        ],
      },
    }),
    numberBoxKeys: Property.Number({
      displayName: 'Number of Box Keys',
      description: 'Number of keys issued to the customer (1 digit)',
      required: false,
    }),
    salesTaxDue: Property.Number({
      displayName: 'Sales Tax Due',
      description: 'Sales tax due (7 digits with 2 decimal places)',
      required: false,
    }),
    // Auto Transfer fields
    debitApplication: Property.StaticDropdown({
      displayName: 'Debit Application',
      description: 'Debit application (conditional for auto transfer)',
      required: false,
      options: {
        options: [
          { label: 'DD - Demand Deposit', value: 'DD' },
          { label: 'GL - General Ledger', value: 'GL' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'Blank - Not a HORIZON account', value: '' },
        ],
      },
    }),
    debitAccount: Property.ShortText({
      displayName: 'Debit Account',
      description: 'Debit account number (up to 17 characters)',
      required: false,
    }),
    generalLedgerBranch: Property.ShortText({
      displayName: 'General Ledger Branch',
      description: 'General ledger branch (up to 4 characters)',
      required: false,
    }),
    generalLedgerCenter: Property.Number({
      displayName: 'General Ledger Center',
      description: 'General ledger center (up to 4 digits)',
      required: false,
    }),
    externalDebit: Property.StaticDropdown({
      displayName: 'External Debit',
      description: 'External debit flag (Y if debit is to external account)',
      required: false,
      options: {
        options: [
          { label: 'Y - External account', value: 'Y' },
          { label: 'N - Not external account', value: 'N' },
        ],
      },
    }),
    individualIdentification: Property.ShortText({
      displayName: 'Individual Identification',
      description: 'Individual identification for external auto transfer (up to 15 characters)',
      required: false,
    }),
    additionalInfo1: Property.ShortText({
      displayName: 'Additional Info 1',
      description: 'Additional information for external auto transfer (up to 40 characters)',
      required: false,
    }),
    additionalInfo2: Property.ShortText({
      displayName: 'Additional Info 2',
      description: 'Additional information for external auto transfer (up to 40 characters)',
      required: false,
    }),
    holdTransfer: Property.StaticDropdown({
      displayName: 'Hold Transfer',
      description: 'Hold flag for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'N - No', value: 'N' },
          { label: 'Y - Yes', value: 'Y' },
          { label: 'O - Once', value: 'O' },
        ],
      },
    }),
    routingNumber: Property.ShortText({
      displayName: 'Routing Number',
      description: 'Routing and transit number for external account (9 characters)',
      required: false,
    }),
    discretionaryData: Property.ShortText({
      displayName: 'Discretionary Data',
      description: 'Discretionary data for external auto transfer (up to 2 characters)',
      required: false,
    }),
    transactionCode: Property.ShortText({
      displayName: 'Transaction Code',
      description: 'Transaction code for auto transfer (up to 4 characters)',
      required: false,
    }),
    debitDescription: Property.ShortText({
      displayName: 'Debit Description',
      description: 'Debit description for auto transfer (up to 30 characters)',
      required: false,
    }),
    creditDescription: Property.ShortText({
      displayName: 'Credit Description',
      description: 'Credit description for auto transfer (up to 30 characters)',
      required: false,
    }),
    transferDescription: Property.ShortText({
      displayName: 'Transfer Description',
      description: 'Transfer description for auto transfer (up to 40 characters)',
      required: false,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Amount of transfer (up to 15 digits)',
      required: false,
    }),
    feeOption: Property.StaticDropdown({
      displayName: 'Fee Option',
      description: 'Fee option for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    frequencyTerm: Property.Number({
      displayName: 'Frequency Term',
      description: 'Number of months or days controlling the auto transfer (up to 3 digits)',
      required: false,
    }),
    frequencyCode: Property.StaticDropdown({
      displayName: 'Frequency Code',
      description: 'Frequency code for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'D - Days', value: 'D' },
          { label: 'E - Month-end', value: 'E' },
          { label: 'M - Months', value: 'M' },
        ],
      },
    }),
    noticeOption: Property.StaticDropdown({
      displayName: 'Notice Option',
      description: 'Notice option for auto transfer',
      required: false,
      options: {
        options: [
          { label: 'B - Both', value: 'B' },
          { label: 'F - From Account', value: 'F' },
          { label: 'I - NSF notice', value: 'I' },
          { label: 'N - No', value: 'N' },
          { label: 'T - To Account', value: 'T' },
        ],
      },
    }),
    nextTransferDate: Property.Number({
      displayName: 'Next Transfer Date',
      description: 'Next transfer date (YYYYMMDD format)',
      required: false,
    }),
    endDate: Property.Number({
      displayName: 'End Date',
      description: 'End date for auto transfer (YYYYMMDD format)',
      required: false,
    }),
    availableBalanceFlag: Property.StaticDropdown({
      displayName: 'Available Balance Flag',
      description: 'Available balance calculation for auto transfer',
      required: false,
      options: {
        options: [
          { label: '1 - Add RRS to Calculation', value: '1' },
          { label: '2 - Add OD limit to Calc', value: '2' },
          { label: '3 - Add RRS+OD Limit to calc', value: '3' },
          { label: '4 - Do not add RRS+OD Limit to Calc', value: '4' },
          { label: '5 - Include RRS and Dynamic Balance', value: '5' },
          { label: '6 - Include OD Limit and Dynamic Balance', value: '6' },
          { label: '7 - Include RRS, OD Limit and Dynamic Balance', value: '7' },
          { label: '8 - Include Dynamic Balance Only', value: '8' },
        ],
      },
    }),
    achTransferRequestMethod: Property.StaticDropdown({
      displayName: 'ACH Transfer Request Method',
      description: 'ACH transfer request method. Required if External Debit is Y',
      required: false,
      options: {
        options: [
          { label: 'Blank - No external debit', value: '' },
          { label: 'E - Electronically', value: 'E' },
          { label: 'P - Person', value: 'P' },
          { label: 'T - Telephone', value: 'T' },
        ],
      },
    }),
    lateChargePointer: Property.ShortText({
      displayName: 'Late Charge Pointer',
      description: 'Late charge pointer (up to 3 characters). Defaults to value from Box Type in bank control if not sent',
      required: false,
    }),
    applyFeeTaxOverrideFlag: Property.StaticDropdown({
      displayName: 'Apply Fee Tax Override Flag',
      description: 'Apply fee tax override flag',
      required: false,
      options: {
        options: [
          { label: 'Blank - Use bank control default', value: '' },
          { label: 'N - Do not apply tax to fees', value: 'N' },
          { label: 'Y - Apply tax to fees', value: 'Y' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, ...bodyProps } = context.propsValue;

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

    // Build request body with only defined values
    const body: Record<string, unknown> = {};

    // Required fields
    body['branchNumber'] = bodyProps.branchNumber;
    body['boxNumber'] = bodyProps.boxNumber;
    body['accountNumber'] = bodyProps.accountNumber;
    body['boxType'] = bodyProps.boxType;
    body['openDate'] = bodyProps.openDate;
    body['status'] = bodyProps.status;
    body['autodraftIncrement'] = bodyProps.autodraftIncrement;
    body['generalLedgerType'] = bodyProps.generalLedgerType;
    body['automaticTransfer'] = bodyProps.automaticTransfer;
    body['customerId'] = bodyProps.customerId;

    // Optional fields - only add if defined
    if (bodyProps.boxPrice !== undefined && bodyProps.boxPrice !== null) {
      body['boxPrice'] = bodyProps.boxPrice;
    }
    if (bodyProps.discountCode) {
      body['discountCode'] = bodyProps.discountCode;
    }
    if (bodyProps.salesTax !== undefined) {
      body['salesTax'] = bodyProps.salesTax;
    }
    if (bodyProps.dateLastPayment !== undefined && bodyProps.dateLastPayment !== null) {
      body['dateLastPayment'] = bodyProps.dateLastPayment;
    }
    if (bodyProps.dateNextPayment !== undefined && bodyProps.dateNextPayment !== null) {
      body['dateNextPayment'] = bodyProps.dateNextPayment;
    }
    if (bodyProps.lastContactDate !== undefined && bodyProps.lastContactDate !== null) {
      body['lastContactDate'] = bodyProps.lastContactDate;
    }
    if (bodyProps.abandonedPropFlag !== undefined) {
      body['abandonedPropFlag'] = bodyProps.abandonedPropFlag;
    }
    if (bodyProps.holdFlag) {
      body['holdFlag'] = bodyProps.holdFlag;
    }
    if (bodyProps.lastEntryDate !== undefined && bodyProps.lastEntryDate !== null) {
      body['lastEntryDate'] = bodyProps.lastEntryDate;
    }
    if (bodyProps.lastEntryCode !== undefined) {
      body['lastEntryCode'] = bodyProps.lastEntryCode;
    }
    if (bodyProps.numberBoxKeys !== undefined && bodyProps.numberBoxKeys !== null) {
      body['numberBoxKeys'] = bodyProps.numberBoxKeys;
    }
    if (bodyProps.salesTaxDue !== undefined && bodyProps.salesTaxDue !== null) {
      body['salesTaxDue'] = bodyProps.salesTaxDue;
    }
    if (bodyProps.debitApplication !== undefined) {
      body['debitApplication'] = bodyProps.debitApplication;
    }
    if (bodyProps.debitAccount) {
      body['debitAccount'] = bodyProps.debitAccount;
    }
    if (bodyProps.generalLedgerBranch) {
      body['generalLedgerBranch'] = bodyProps.generalLedgerBranch;
    }
    if (bodyProps.generalLedgerCenter !== undefined && bodyProps.generalLedgerCenter !== null) {
      body['generalLedgerCenter'] = bodyProps.generalLedgerCenter;
    }
    if (bodyProps.externalDebit) {
      body['externalDebit'] = bodyProps.externalDebit;
    }
    if (bodyProps.individualIdentification) {
      body['individualIdentification'] = bodyProps.individualIdentification;
    }
    if (bodyProps.additionalInfo1) {
      body['additionalInfo1'] = bodyProps.additionalInfo1;
    }
    if (bodyProps.additionalInfo2) {
      body['additionalInfo2'] = bodyProps.additionalInfo2;
    }
    if (bodyProps.holdTransfer) {
      body['holdTransfer'] = bodyProps.holdTransfer;
    }
    if (bodyProps.routingNumber) {
      body['routingNumber'] = bodyProps.routingNumber;
    }
    if (bodyProps.discretionaryData) {
      body['discretionaryData'] = bodyProps.discretionaryData;
    }
    if (bodyProps.transactionCode) {
      body['transactionCode'] = bodyProps.transactionCode;
    }
    if (bodyProps.debitDescription) {
      body['debitDescription'] = bodyProps.debitDescription;
    }
    if (bodyProps.creditDescription) {
      body['creditDescription'] = bodyProps.creditDescription;
    }
    if (bodyProps.transferDescription) {
      body['transferDescription'] = bodyProps.transferDescription;
    }
    if (bodyProps.amount !== undefined && bodyProps.amount !== null) {
      body['amount'] = bodyProps.amount;
    }
    if (bodyProps.feeOption) {
      body['feeOption'] = bodyProps.feeOption;
    }
    if (bodyProps.frequencyTerm !== undefined && bodyProps.frequencyTerm !== null) {
      body['frequencyTerm'] = bodyProps.frequencyTerm;
    }
    if (bodyProps.frequencyCode) {
      body['frequencyCode'] = bodyProps.frequencyCode;
    }
    if (bodyProps.noticeOption) {
      body['noticeOption'] = bodyProps.noticeOption;
    }
    if (bodyProps.nextTransferDate !== undefined && bodyProps.nextTransferDate !== null) {
      body['nextTransferDate'] = bodyProps.nextTransferDate;
    }
    if (bodyProps.endDate !== undefined && bodyProps.endDate !== null) {
      body['endDate'] = bodyProps.endDate;
    }
    if (bodyProps.availableBalanceFlag) {
      body['availableBalanceFlag'] = bodyProps.availableBalanceFlag;
    }
    if (bodyProps.achTransferRequestMethod !== undefined) {
      body['achTransferRequestMethod'] = bodyProps.achTransferRequestMethod;
    }
    if (bodyProps.lateChargePointer !== undefined) {
      body['lateChargePointer'] = bodyProps.lateChargePointer;
    }
    if (bodyProps.applyFeeTaxOverrideFlag !== undefined) {
      body['applyFeeTaxOverrideFlag'] = bodyProps.applyFeeTaxOverrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/safe-deposit/v1/accounts/safe-deposit-box`,
      headers,
      body,
    });

    return response.body;
  },
});
