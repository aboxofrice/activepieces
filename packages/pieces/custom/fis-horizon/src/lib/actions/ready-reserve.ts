import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// Base URL path for Ready Reserve API
const API_PATH = '/ready-reserve/v1';

/**
 * Ready Reserve - Add Account
 * POST /accounts/ready-reserve
 * Add a new ready reserve account
 */
export const ready_reserve_add_account = createAction({
  name: 'ready_reserve_add_account',
  auth: fisHorizonAuth,
  displayName: 'Ready Reserve - Add Account',
  description: 'Add a new ready reserve revolving line of credit account',
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
    // Required fields
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID obtained from RM01 or RM06 transactions. Up to 14 characters.',
      required: true,
    }),
    customerShortName: Property.ShortText({
      displayName: 'Customer Short Name',
      description: 'Customer short name obtained from RM01 transaction. Up to 20 characters.',
      required: true,
    }),
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch number (0-999). User defined value.',
      required: true,
    }),
    productType: Property.Number({
      displayName: 'Product Type',
      description: 'Account type (0-99). User defined value.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number. Up to 10 characters.',
      required: true,
    }),
    accountExpireDate: Property.ShortText({
      displayName: 'Account Expiration Date',
      description: 'Account expiration date in MMDDYY format.',
      required: true,
    }),
    creditLimit: Property.Number({
      displayName: 'Credit Limit',
      description: 'Credit limit in whole dollars (0-9999999).',
      required: true,
    }),
    yearBaseCode: Property.StaticDropdown({
      displayName: 'Year Base Code',
      description: 'Year base code for interest calculation.',
      required: true,
      options: {
        options: [
          { label: '3 - 360/Actual', value: 3 },
          { label: '4 - 365 or 366/Actual', value: 4 },
        ],
      },
    }),
    generalLedgerType: Property.Number({
      displayName: 'General Ledger Type',
      description: 'General ledger type (0-9999). User defined value.',
      required: true,
    }),
    individualOrJoint: Property.StaticDropdown({
      displayName: 'Individual or Joint',
      description: 'Whether the account is individual or joint.',
      required: true,
      options: {
        options: [
          { label: 'I - Individual', value: 'I' },
          { label: 'J - Joint', value: 'J' },
        ],
      },
    }),
    issueDate: Property.Number({
      displayName: 'Issue Date',
      description: 'Issue date in MMDDYY format (numeric).',
      required: true,
    }),
    paymentSplitCode: Property.StaticDropdown({
      displayName: 'Payment Split Code',
      description: 'Payment split code.',
      required: true,
      options: {
        options: [
          { label: '1 - To Date', value: '1' },
          { label: '2 - As Billed', value: '2' },
        ],
      },
    }),
    primaryOfficer: Property.ShortText({
      displayName: 'Primary Officer',
      description: 'Primary officer. Up to 3 characters.',
      required: true,
    }),
    // Optional fields
    equityLineCode: Property.StaticDropdown({
      displayName: 'Equity Line Code',
      description: 'Equity line code.',
      required: false,
      options: {
        options: [
          { label: 'Blank - Overdraft Protection', value: ' ' },
          { label: 'E - Equity Line', value: 'E' },
        ],
      },
    }),
    variableRateCode: Property.Number({
      displayName: 'Variable Rate Code',
      description: 'Variable rate code (0-99). User defined value.',
      required: false,
    }),
    initialRate: Property.Number({
      displayName: 'Initial Rate',
      description: 'Initial rate to charge. 10000 = 10.0%. Max 99999.',
      required: false,
    }),
    initialRateExpirationDate: Property.ShortText({
      displayName: 'Initial Rate Expiration Date',
      description: 'Initial rate expiration date in MMDDYY format.',
      required: false,
    }),
    specialAmountToChange: Property.Number({
      displayName: 'Special Amount to Change',
      description: 'Special amount to change (0-9999999.99).',
      required: false,
    }),
    specialAmountExpirationDate: Property.ShortText({
      displayName: 'Special Amount Expiration Date',
      description: 'Special amount expiration date in MMDDYY format.',
      required: false,
    }),
    fixedPaymentAmount: Property.Number({
      displayName: 'Fixed Payment Amount',
      description: 'Fixed payment amount (0-99999.99).',
      required: false,
    }),
    paymentPercent: Property.Number({
      displayName: 'Payment Percent',
      description: 'Payment percent (0-9.9999999).',
      required: false,
    }),
    interestRate: Property.Number({
      displayName: 'Interest Rate',
      description: 'Rate of interest. 10000 = 10.0%. Max 99999.',
      required: false,
    }),
    varianceOfInterest: Property.Number({
      displayName: 'Variance of Interest',
      description: 'Variance of interest. Max 99999.',
      required: false,
    }),
    eodCode: Property.StaticDropdown({
      displayName: 'EOD Code',
      description: 'Employee, Officer, Director or Insider code.',
      required: false,
      options: {
        options: [
          { label: 'Blank - Not Applicable', value: ' ' },
          { label: 'E - Employee', value: 'E' },
          { label: 'O - Officer', value: 'O' },
          { label: 'D - Director', value: 'D' },
          { label: 'R - Other Insider', value: 'R' },
        ],
      },
    }),
    vipCode: Property.StaticDropdown({
      displayName: 'VIP Code',
      description: 'VIP code.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No', value: ' ' },
          { label: 'V - Yes', value: 'V' },
        ],
      },
    }),
    insuranceCode: Property.StaticDropdown({
      displayName: 'Insurance Code',
      description: 'Insurance code.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No Insurance Coverage', value: ' ' },
          { label: 'I - Individual Insurance Coverage', value: 'I' },
          { label: 'J - Joint Insurance Coverage', value: 'J' },
        ],
      },
    }),
    manualPaymentsOnly: Property.StaticDropdown({
      displayName: 'Manual Payments Only',
      description: 'Manual payments only indicator.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No', value: ' ' },
          { label: '* - Yes', value: '*' },
        ],
      },
    }),
    insuranceExpiration: Property.Number({
      displayName: 'Insurance Expiration',
      description: 'Insurance expiration date in MMYY format (numeric, 0-1299).',
      required: false,
    }),
    overCreditLimitPercent: Property.Number({
      displayName: 'Over Credit Limit Percent',
      description: 'Over credit limit percent. Max 99999.',
      required: false,
    }),
    billOverLimitAmount: Property.StaticDropdown({
      displayName: 'Bill Over Limit Amount',
      description: 'Bill over limit amount indicator.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No', value: ' ' },
          { label: 'Y - Yes', value: 'Y' },
        ],
      },
    }),
    atsTransfer: Property.StaticDropdown({
      displayName: 'ATS Transfer',
      description: 'Automatic Transfer Service (ATS) transfer indicator.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No', value: ' ' },
          { label: 'A - Yes', value: 'A' },
        ],
      },
    }),
    atsApplicationType: Property.StaticDropdown({
      displayName: 'ATS Application Type',
      description: 'ATS application type. Required when ATS Transfer is A.',
      required: false,
      options: {
        options: [
          { label: 'DD - Checking Account', value: 'DD' },
          { label: 'SV - Savings Account', value: 'SV' },
        ],
      },
    }),
    atsAccountNumber: Property.ShortText({
      displayName: 'ATS Account Number',
      description: 'ATS account number. Required when ATS Transfer is A. Up to 10 characters.',
      required: false,
    }),
    firstOrSecondMortgage: Property.StaticDropdown({
      displayName: 'First or Second Mortgage',
      description: 'First or second mortgage indicator.',
      required: false,
      options: {
        options: [
          { label: '1 - 1098 is generated', value: 1 },
          { label: '2 - 1098 is generated', value: 2 },
          { label: '3 - 1098 is not generated', value: 3 },
        ],
      },
    }),
    firstMortgageHolder: Property.ShortText({
      displayName: 'First Mortgage Holder',
      description: '1st mortgage holder. Up to 30 characters.',
      required: false,
    }),
    serviceChargeAmount: Property.Number({
      displayName: 'Service Charge Amount',
      description: 'Service charge amount (0-9999999.99).',
      required: false,
    }),
    serviceChargeFrequency: Property.StaticDropdown({
      displayName: 'Service Charge Frequency',
      description: 'Service charge frequency. Required if Service Charge Amount is not 0.',
      required: false,
      options: {
        options: [
          { label: 'M - Monthly', value: 'M' },
          { label: 'Q - Quarterly', value: 'Q' },
          { label: 'S - Semi-Annually', value: 'S' },
          { label: 'A - Annually', value: 'A' },
        ],
      },
    }),
    serviceChargeDueDate: Property.Number({
      displayName: 'Service Charge Due Date',
      description: 'Service charge due date in MMDDYY format (numeric). Required if Service Charge Amount is not 0.',
      required: false,
    }),
    ahOrClInsuranceExpiration: Property.Number({
      displayName: 'AH/CL Insurance Expiration',
      description: 'Accident and Health/Credit Life insurance expiration date in MMDDYY format (numeric).',
      required: false,
    }),
    overLimitAmount: Property.Number({
      displayName: 'Over Limit Amount',
      description: 'Over limit amount (0-999999999.99).',
      required: false,
    }),
    secured: Property.StaticDropdown({
      displayName: 'Secured',
      description: 'Secured indicator.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No', value: ' ' },
          { label: 'Y - Yes', value: 'Y' },
        ],
      },
    }),
    collateralCode: Property.ShortText({
      displayName: 'Collateral Code',
      description: 'Collateral code. User defined. Up to 3 characters.',
      required: false,
    }),
    purposeCode: Property.ShortText({
      displayName: 'Purpose Code',
      description: 'Purpose code. User defined. Up to 5 characters.',
      required: false,
    }),
    censusTrackNumber: Property.ShortText({
      displayName: 'Census Track Number',
      description: 'Census track number. User defined. Up to 8 characters.',
      required: false,
    }),
    callCode: Property.ShortText({
      displayName: 'Call Code',
      description: 'Call code. User defined. Up to 5 characters.',
      required: false,
    }),
    riskCode: Property.ShortText({
      displayName: 'Risk Code',
      description: 'Risk code. User defined. Up to 3 characters.',
      required: false,
    }),
    smsaCode: Property.ShortText({
      displayName: 'SMSA Code',
      description: 'Standard Metropolitan Statistical Area code. User defined. Up to 8 characters.',
      required: false,
    }),
    classCode: Property.ShortText({
      displayName: 'Class Code',
      description: 'Class code. User defined. Up to 2 characters.',
      required: false,
    }),
    feeType: Property.Number({
      displayName: 'Fee Type',
      description: 'Fee type (0-99). User defined.',
      required: false,
    }),
    minimumPaymentAmount: Property.Number({
      displayName: 'Minimum Payment Amount',
      description: 'Minimum payment amount (0-999.99).',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
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

    // Build request body with required fields
    const body: Record<string, unknown> = {
      customerId: props.customerId,
      customerShortName: props.customerShortName,
      branchNumber: props.branchNumber,
      productType: props.productType,
      accountNumber: props.accountNumber,
      accountExpireDate: props.accountExpireDate,
      creditLimit: props.creditLimit,
      yearBaseCode: props.yearBaseCode,
      generalLedgerType: props.generalLedgerType,
      individualOrJoint: props.individualOrJoint,
      issueDate: props.issueDate,
      paymentSplitCode: props.paymentSplitCode,
      primaryOfficer: props.primaryOfficer,
    };

    // Add optional fields if provided
    if (props.equityLineCode !== undefined && props.equityLineCode !== null) {
      body['equityLineCode'] = props.equityLineCode;
    }
    if (props.variableRateCode !== undefined && props.variableRateCode !== null) {
      body['variableRateCode'] = props.variableRateCode;
    }
    if (props.initialRate !== undefined && props.initialRate !== null) {
      body['initialRate'] = props.initialRate;
    }
    if (props.initialRateExpirationDate) {
      body['initialRateExpirationDate'] = props.initialRateExpirationDate;
    }
    if (props.specialAmountToChange !== undefined && props.specialAmountToChange !== null) {
      body['specialAmountToChange'] = props.specialAmountToChange;
    }
    if (props.specialAmountExpirationDate) {
      body['specialAmountExpirationDate'] = props.specialAmountExpirationDate;
    }
    if (props.fixedPaymentAmount !== undefined && props.fixedPaymentAmount !== null) {
      body['fixedPaymentAmount'] = props.fixedPaymentAmount;
    }
    if (props.paymentPercent !== undefined && props.paymentPercent !== null) {
      body['paymentPercent'] = props.paymentPercent;
    }
    if (props.interestRate !== undefined && props.interestRate !== null) {
      body['interestRate'] = props.interestRate;
    }
    if (props.varianceOfInterest !== undefined && props.varianceOfInterest !== null) {
      body['varianceOfInterest'] = props.varianceOfInterest;
    }
    if (props.eodCode !== undefined && props.eodCode !== null) {
      body['eodCode'] = props.eodCode;
    }
    if (props.vipCode !== undefined && props.vipCode !== null) {
      body['vipCode'] = props.vipCode;
    }
    if (props.insuranceCode !== undefined && props.insuranceCode !== null) {
      body['insuranceCode'] = props.insuranceCode;
    }
    if (props.manualPaymentsOnly !== undefined && props.manualPaymentsOnly !== null) {
      body['manualPaymentsOnly'] = props.manualPaymentsOnly;
    }
    if (props.insuranceExpiration !== undefined && props.insuranceExpiration !== null) {
      body['insuranceExpiration'] = props.insuranceExpiration;
    }
    if (props.overCreditLimitPercent !== undefined && props.overCreditLimitPercent !== null) {
      body['overCreditLimitPercent'] = props.overCreditLimitPercent;
    }
    if (props.billOverLimitAmount !== undefined && props.billOverLimitAmount !== null) {
      body['billOverLimitAmount'] = props.billOverLimitAmount;
    }
    if (props.atsTransfer !== undefined && props.atsTransfer !== null) {
      body['atsTransfer'] = props.atsTransfer;
    }
    if (props.atsApplicationType) {
      body['atsApplicationType'] = props.atsApplicationType;
    }
    if (props.atsAccountNumber) {
      body['atsAccountNumber'] = props.atsAccountNumber;
    }
    if (props.firstOrSecondMortgage !== undefined && props.firstOrSecondMortgage !== null) {
      body['firstOrSecondMortgage'] = props.firstOrSecondMortgage;
    }
    if (props.firstMortgageHolder) {
      body['firstMortgageHolder'] = props.firstMortgageHolder;
    }
    if (props.serviceChargeAmount !== undefined && props.serviceChargeAmount !== null) {
      body['serviceChargeAmount'] = props.serviceChargeAmount;
    }
    if (props.serviceChargeFrequency) {
      body['serviceChargeFrequency'] = props.serviceChargeFrequency;
    }
    if (props.serviceChargeDueDate !== undefined && props.serviceChargeDueDate !== null) {
      body['serviceChargeDueDate'] = props.serviceChargeDueDate;
    }
    if (props.ahOrClInsuranceExpiration !== undefined && props.ahOrClInsuranceExpiration !== null) {
      body['ahOrClInsuranceExpiration'] = props.ahOrClInsuranceExpiration;
    }
    if (props.overLimitAmount !== undefined && props.overLimitAmount !== null) {
      body['overLimitAmount'] = props.overLimitAmount;
    }
    if (props.secured !== undefined && props.secured !== null) {
      body['secured'] = props.secured;
    }
    if (props.collateralCode) {
      body['collateralCode'] = props.collateralCode;
    }
    if (props.purposeCode) {
      body['purposeCode'] = props.purposeCode;
    }
    if (props.censusTrackNumber) {
      body['censusTrackNumber'] = props.censusTrackNumber;
    }
    if (props.callCode) {
      body['callCode'] = props.callCode;
    }
    if (props.riskCode) {
      body['riskCode'] = props.riskCode;
    }
    if (props.smsaCode) {
      body['smsaCode'] = props.smsaCode;
    }
    if (props.classCode) {
      body['classCode'] = props.classCode;
    }
    if (props.feeType !== undefined && props.feeType !== null) {
      body['feeType'] = props.feeType;
    }
    if (props.minimumPaymentAmount !== undefined && props.minimumPaymentAmount !== null) {
      body['minimumPaymentAmount'] = props.minimumPaymentAmount;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/ready-reserve`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Ready Reserve - Account Inquiry
 * GET /accounts/{applicationCode}/{accountNumber}
 * Retrieve basic information relating to a ready reserve account
 */
export const ready_reserve_account_inquiry = createAction({
  name: 'ready_reserve_account_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Ready Reserve - Account Inquiry',
  description: 'Retrieve basic information relating to a ready reserve account',
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
      description: 'Application code. Valid value: RR = Ready Reserve',
      required: true,
      options: {
        options: [
          { label: 'RR - Ready Reserve', value: 'RR' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero-filled account number.',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Optional: Unique identifier associated with a customer. Right-justified, zero filled, up to 14 digits.',
      required: false,
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Return response in uppercase.',
      required: false,
      options: {
        options: [
          { label: 'Y - Yes', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
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
 * Ready Reserve - Transaction Inquiry
 * GET /accounts/{applicationCode}/{accountNumber}/transactions
 * Retrieve a list of historic transactions relating to an account
 */
export const ready_reserve_transaction_inquiry = createAction({
  name: 'ready_reserve_transaction_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Ready Reserve - Transaction Inquiry',
  description: 'Retrieve a list of historic transactions relating to a ready reserve account',
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
      description: 'Application code. Valid value: RR = Ready Reserve',
      required: true,
      options: {
        options: [
          { label: 'RR - Ready Reserve', value: 'RR' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero-filled account number.',
      required: true,
    }),
    dateSelectOption: Property.StaticDropdown({
      displayName: 'Date Select Option',
      description: 'Date selection option for filtering transactions.',
      required: true,
      options: {
        options: [
          { label: 'M - Return only today\'s memo posted transactions', value: 'M' },
          { label: 'P - All transactions posted during last BOSS processing run', value: 'P' },
          { label: 'R - User specified date range (Effective Dates)', value: 'R' },
          { label: 'S - All transactions since last statement date', value: 'S' },
          { label: 'T - User specified date range (Transaction Dates)', value: 'T' },
        ],
      },
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First or next request indicator.',
      required: true,
      options: {
        options: [
          { label: 'F - First request', value: 'F' },
          { label: 'N - Next request for additional transactions', value: 'N' },
        ],
      },
    }),
    numberToReturn: Property.Number({
      displayName: 'Number to Return',
      description: 'Number of transactions to return at a time. Max 999. A value of 999 returns as many as can fit in the buffer.',
      required: true,
    }),
    beginDate: Property.Number({
      displayName: 'Begin Date',
      description: 'Begin date in CCYYMMDD format (numeric). Required when Date Select Option is R, T, or M.',
      required: false,
    }),
    endDate: Property.Number({
      displayName: 'End Date',
      description: 'End date in CCYYMMDD format (numeric). Only valid when Date Select Option is R or T. Defaults to 99999999 if zero.',
      required: false,
    }),
    returnMemoPostTransaction: Property.StaticDropdown({
      displayName: 'Return Memo Post Transaction',
      description: 'Return memo post transaction indicator.',
      required: false,
      options: {
        options: [
          { label: 'A - Return all of today\'s memo post transactions', value: 'A' },
          { label: 'Y - Return memo post transactions excluding those not affecting available balance', value: 'Y' },
          { label: 'N - Do not return memo post transactions', value: 'N' },
          { label: 'Blank - Do not return memo post transactions', value: '' },
        ],
      },
    }),
    returnPackagePostItems: Property.StaticDropdown({
      displayName: 'Return Package Post Items',
      description: 'Return package post items indicator.',
      required: false,
      options: {
        options: [
          { label: 'A - Return all items (including PKPST)', value: 'A' },
          { label: 'P - Return history items and package posted check', value: 'P' },
          { label: 'Blank - Not used', value: '' },
        ],
      },
    }),
    returnScheduledExternalTransfers: Property.StaticDropdown({
      displayName: 'Return Scheduled External Transfers',
      description: 'Return scheduled external transfers indicator. Note: Only works for LN and ML Internal Credit Auto Transfers.',
      required: false,
      options: {
        options: [
          { label: 'Y - Return scheduled Auto Transfers', value: 'Y' },
          { label: 'N - Do not return scheduled Auto Transfers', value: 'N' },
          { label: 'Blank - Do not return scheduled Auto Transfers', value: '' },
        ],
      },
    }),
    sequenceOption: Property.StaticDropdown({
      displayName: 'Sequence Option',
      description: 'Sequence option for ordering results.',
      required: false,
      options: {
        options: [
          { label: 'A - Ascending order (default)', value: 'A' },
          { label: 'D - Descending order', value: 'D' },
        ],
      },
    }),
    searchToken: Property.ShortText({
      displayName: 'Search Token',
      description: 'Search token for stateless middleware processing. Up to 20 characters.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
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
      dateSelectOption: props.dateSelectOption,
      firstNext: props.firstNext,
      numberToReturn: String(props.numberToReturn),
    };

    if (props.beginDate !== undefined && props.beginDate !== null) {
      queryParams['beginDate'] = String(props.beginDate);
    }
    if (props.endDate !== undefined && props.endDate !== null) {
      queryParams['endDate'] = String(props.endDate);
    }
    if (props.returnMemoPostTransaction !== undefined && props.returnMemoPostTransaction !== null) {
      queryParams['returnMemoPostTransaction'] = props.returnMemoPostTransaction;
    }
    if (props.returnPackagePostItems !== undefined && props.returnPackagePostItems !== null) {
      queryParams['returnPackagePostItems'] = props.returnPackagePostItems;
    }
    if (props.returnScheduledExternalTransfers !== undefined && props.returnScheduledExternalTransfers !== null) {
      queryParams['returnScheduledExternalTransfers'] = props.returnScheduledExternalTransfers;
    }
    if (props.sequenceOption) {
      queryParams['sequenceOption'] = props.sequenceOption;
    }
    if (props.searchToken) {
      queryParams['searchToken'] = props.searchToken;
    }

    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}${API_PATH}/accounts/${props.applicationCode}/${props.accountNumber}/transactions${queryString}`,
      headers,
    });

    return response.body;
  },
});
