import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// Base URL path for Demand Deposit Savings API
const API_PATH = '/demand-deposit-savings/v2';

/**
 * Add a new demand deposit account
 */
export const demand_deposit_savings_add_demand_deposit = createAction({
  name: 'demand_deposit_savings_add_demand_deposit',
  auth: fisHorizonAuth,
  displayName: 'Demand Deposit Savings - Add Demand Deposit Account',
  description: 'Add a new demand deposit account',
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
    addUpdate: Property.StaticDropdown({
      displayName: 'Add/Update Mode',
      description: 'The mode for adding the account',
      required: true,
      options: {
        options: [
          { label: 'A - Add Account Mode', value: 'A' },
          { label: 'N - Add, default fields from Request Account Type', value: 'N' },
        ],
      },
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Right-justified, zero filled. Up to 14 digits.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 10 numeric digits, no decimal places',
      required: true,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'User defined, up to 3 characters',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Right justified, zero filled, 3 numeric digits',
      required: true,
    }),
    primaryShortName: Property.ShortText({
      displayName: 'Primary Short Name',
      description: 'The primary short name for the account',
      required: true,
    }),
    accountReconciliationCode: Property.StaticDropdown({
      displayName: 'Account Reconciliation Code',
      description: 'Account reconciliation code',
      required: false,
      options: {
        options: [
          { label: 'Blank - No Account Reconciliation', value: '' },
          { label: 'Y - Recon with Auto Issues', value: 'Y' },
          { label: 'M - Recon without Auto Issues', value: 'M' },
          { label: 'X - Recon with Auto Issues', value: 'X' },
        ],
      },
    }),
    censusTrackNumber: Property.Number({
      displayName: 'Census Track Number',
      description: 'Census track number (0-9999999)',
      required: false,
    }),
    confidentialAccount: Property.Checkbox({
      displayName: 'Confidential Account',
      description: 'Whether the account is confidential',
      required: false,
      defaultValue: false,
    }),
    employeeCode: Property.StaticDropdown({
      displayName: 'Employee Code',
      description: 'Employee code',
      required: false,
      options: {
        options: [
          { label: 'Blank - Not Applicable', value: '' },
          { label: 'O - Officer', value: 'O' },
          { label: 'D - Director', value: 'D' },
          { label: 'E - Employee', value: 'E' },
          { label: 'B - Other Bank Official', value: 'B' },
          { label: 'P - Public Official', value: 'P' },
        ],
      },
    }),
    exceptionFeeTable: Property.ShortText({
      displayName: 'Exception Fee Table',
      description: 'User defined, up to 3 characters. Required when addUpdate = A',
      required: false,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'User defined, up to 4 characters. Required when addUpdate = A',
      required: false,
    }),
    homeBankingCode: Property.StaticDropdown({
      displayName: 'Home Banking Code',
      description: 'Home banking code. Required when addUpdate = A',
      required: false,
      options: {
        options: [
          { label: 'C - Charge', value: 'C' },
          { label: 'N - Not Home Banking', value: 'N' },
          { label: 'W - Waive', value: 'W' },
        ],
      },
    }),
    homeBankingFeeStartDate: Property.ShortText({
      displayName: 'Home Banking Fee Start Date',
      description: 'Format: MMDDYY',
      required: false,
    }),
    legalHousingTrust: Property.StaticDropdown({
      displayName: 'Legal Housing Trust',
      description: 'Legal housing trust code',
      required: false,
      options: {
        options: [
          { label: 'Blank - Not Applicable', value: '' },
          { label: '1 - Post only Positive Interest', value: '1' },
          { label: '2 - Post Positive and Negative Interest', value: '2' },
        ],
      },
    }),
    miscellaneousFeeTable: Property.ShortText({
      displayName: 'Miscellaneous Fee Table',
      description: 'User defined, up to 3 characters. Required when addUpdate = A',
      required: false,
    }),
    newProdType: Property.ShortText({
      displayName: 'New Product Type',
      description: 'Must be a valid product type, up to 3 characters',
      required: false,
    }),
    numberOfDaysForAutoClose: Property.Number({
      displayName: 'Number of Days for Auto Close',
      description: '000 = Auto Close, 999 = Do Not Auto Close, 1-998 = Wait Number of Days',
      required: false,
    }),
    officerCode: Property.ShortText({
      displayName: 'Officer Code',
      description: 'User defined, up to 3 characters',
      required: false,
    }),
    openingBalance: Property.Number({
      displayName: 'Opening Balance',
      description: 'Opening balance (0.00 - 99999999999.99)',
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
      'x-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      addUpdate: props.addUpdate,
      customerId: props.customerId,
      accountNumber: props.accountNumber,
      productType: props.productType,
      branchNumber: props.branchNumber,
      primaryShortName: props.primaryShortName,
    };

    if (props.accountReconciliationCode !== undefined && props.accountReconciliationCode !== null) {
      body['accountReconciliationCode'] = props.accountReconciliationCode;
    }
    if (props.censusTrackNumber !== undefined && props.censusTrackNumber !== null) {
      body['censusTrackNumber'] = props.censusTrackNumber;
    }
    if (props.confidentialAccount !== undefined && props.confidentialAccount !== null) {
      body['confidentialAccount'] = props.confidentialAccount;
    }
    if (props.employeeCode !== undefined && props.employeeCode !== null) {
      body['employeeCode'] = props.employeeCode;
    }
    if (props.exceptionFeeTable) {
      body['exceptionFeeTable'] = props.exceptionFeeTable;
    }
    if (props.generalLedgerType) {
      body['generalLedgerType'] = props.generalLedgerType;
    }
    if (props.homeBankingCode) {
      body['homeBankingCode'] = props.homeBankingCode;
    }
    if (props.homeBankingFeeStartDate) {
      body['homeBankingFeeStartDate'] = props.homeBankingFeeStartDate;
    }
    if (props.legalHousingTrust !== undefined && props.legalHousingTrust !== null) {
      body['legalHousingTrust'] = props.legalHousingTrust;
    }
    if (props.miscellaneousFeeTable) {
      body['miscellaneousFeeTable'] = props.miscellaneousFeeTable;
    }
    if (props.newProdType) {
      body['newProdType'] = props.newProdType;
    }
    if (props.numberOfDaysForAutoClose !== undefined && props.numberOfDaysForAutoClose !== null) {
      body['numberOfDaysForAutoClose'] = props.numberOfDaysForAutoClose;
    }
    if (props.officerCode) {
      body['officerCode'] = props.officerCode;
    }
    if (props.openingBalance !== undefined && props.openingBalance !== null) {
      body['openingBalance'] = props.openingBalance;
    }

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/demand-deposits`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Add a new savings account
 */
export const demand_deposit_savings_add_savings = createAction({
  name: 'demand_deposit_savings_add_savings',
  auth: fisHorizonAuth,
  displayName: 'Demand Deposit Savings - Add Savings Account',
  description: 'Add a new savings account',
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
    addUpdate: Property.StaticDropdown({
      displayName: 'Add/Update Mode',
      description: 'The mode for adding the account',
      required: true,
      options: {
        options: [
          { label: 'A - Add Account Mode', value: 'A' },
          { label: 'N - Add, default fields from Request Account Type', value: 'N' },
        ],
      },
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Right-justified, zero filled. Up to 14 digits.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 10 numeric digits, no decimal places',
      required: true,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'User defined, up to 3 characters',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Right justified, zero filled, 3 numeric digits',
      required: true,
    }),
    primaryShortName: Property.ShortText({
      displayName: 'Primary Short Name',
      description: 'The primary short name for the account',
      required: true,
    }),
    accountReconciliationCode: Property.StaticDropdown({
      displayName: 'Account Reconciliation Code',
      description: 'Account reconciliation code',
      required: false,
      options: {
        options: [
          { label: 'Blank - No Account Reconciliation', value: '' },
          { label: 'Y - Recon with Auto Issues', value: 'Y' },
          { label: 'M - Recon without Auto Issues', value: 'M' },
          { label: 'X - Recon with Auto Issues', value: 'X' },
        ],
      },
    }),
    censusTrackNumber: Property.Number({
      displayName: 'Census Track Number',
      description: 'Census track number (0-9999999)',
      required: false,
    }),
    confidentialAccount: Property.Checkbox({
      displayName: 'Confidential Account',
      description: 'Whether the account is confidential',
      required: false,
      defaultValue: false,
    }),
    employeeCode: Property.StaticDropdown({
      displayName: 'Employee Code',
      description: 'Employee code',
      required: false,
      options: {
        options: [
          { label: 'Blank - Not Applicable', value: '' },
          { label: 'O - Officer', value: 'O' },
          { label: 'D - Director', value: 'D' },
          { label: 'E - Employee', value: 'E' },
          { label: 'B - Other Bank Official', value: 'B' },
          { label: 'P - Public Official', value: 'P' },
        ],
      },
    }),
    exceptionFeeTable: Property.ShortText({
      displayName: 'Exception Fee Table',
      description: 'User defined, up to 3 characters. Required when addUpdate = A',
      required: false,
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'User defined, up to 4 characters. Required when addUpdate = A',
      required: false,
    }),
    homeBankingCode: Property.StaticDropdown({
      displayName: 'Home Banking Code',
      description: 'Home banking code. Required when addUpdate = A',
      required: false,
      options: {
        options: [
          { label: 'C - Charge', value: 'C' },
          { label: 'N - Not Home Banking', value: 'N' },
          { label: 'W - Waive', value: 'W' },
        ],
      },
    }),
    homeBankingFeeStartDate: Property.ShortText({
      displayName: 'Home Banking Fee Start Date',
      description: 'Format: MMDDYY',
      required: false,
    }),
    legalHousingTrust: Property.StaticDropdown({
      displayName: 'Legal Housing Trust',
      description: 'Legal housing trust code',
      required: false,
      options: {
        options: [
          { label: 'Blank - Not Applicable', value: '' },
          { label: '1 - Post only Positive Interest', value: '1' },
          { label: '2 - Post Positive and Negative Interest', value: '2' },
        ],
      },
    }),
    miscellaneousFeeTable: Property.ShortText({
      displayName: 'Miscellaneous Fee Table',
      description: 'User defined, up to 3 characters. Required when addUpdate = A',
      required: false,
    }),
    newProdType: Property.ShortText({
      displayName: 'New Product Type',
      description: 'Must be a valid product type, up to 3 characters',
      required: false,
    }),
    numberOfDaysForAutoClose: Property.Number({
      displayName: 'Number of Days for Auto Close',
      description: '000 = Auto Close, 999 = Do Not Auto Close, 1-998 = Wait Number of Days',
      required: false,
    }),
    officerCode: Property.ShortText({
      displayName: 'Officer Code',
      description: 'User defined, up to 3 characters',
      required: false,
    }),
    openingBalance: Property.Number({
      displayName: 'Opening Balance',
      description: 'Opening balance (0.00 - 99999999999.99)',
      required: false,
    }),
    clubAccount: Property.Json({
      displayName: 'Club Account',
      description: 'Club account details as JSON (amount, generateCouponOrder, numberOfCoupons, transferApplicationCode, transferAccount)',
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
      'x-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      addUpdate: props.addUpdate,
      customerId: props.customerId,
      accountNumber: props.accountNumber,
      productType: props.productType,
      branchNumber: props.branchNumber,
      primaryShortName: props.primaryShortName,
    };

    if (props.accountReconciliationCode !== undefined && props.accountReconciliationCode !== null) {
      body['accountReconciliationCode'] = props.accountReconciliationCode;
    }
    if (props.censusTrackNumber !== undefined && props.censusTrackNumber !== null) {
      body['censusTrackNumber'] = props.censusTrackNumber;
    }
    if (props.confidentialAccount !== undefined && props.confidentialAccount !== null) {
      body['confidentialAccount'] = props.confidentialAccount;
    }
    if (props.employeeCode !== undefined && props.employeeCode !== null) {
      body['employeeCode'] = props.employeeCode;
    }
    if (props.exceptionFeeTable) {
      body['exceptionFeeTable'] = props.exceptionFeeTable;
    }
    if (props.generalLedgerType) {
      body['generalLedgerType'] = props.generalLedgerType;
    }
    if (props.homeBankingCode) {
      body['homeBankingCode'] = props.homeBankingCode;
    }
    if (props.homeBankingFeeStartDate) {
      body['homeBankingFeeStartDate'] = props.homeBankingFeeStartDate;
    }
    if (props.legalHousingTrust !== undefined && props.legalHousingTrust !== null) {
      body['legalHousingTrust'] = props.legalHousingTrust;
    }
    if (props.miscellaneousFeeTable) {
      body['miscellaneousFeeTable'] = props.miscellaneousFeeTable;
    }
    if (props.newProdType) {
      body['newProdType'] = props.newProdType;
    }
    if (props.numberOfDaysForAutoClose !== undefined && props.numberOfDaysForAutoClose !== null) {
      body['numberOfDaysForAutoClose'] = props.numberOfDaysForAutoClose;
    }
    if (props.officerCode) {
      body['officerCode'] = props.officerCode;
    }
    if (props.openingBalance !== undefined && props.openingBalance !== null) {
      body['openingBalance'] = props.openingBalance;
    }
    if (props.clubAccount && typeof props.clubAccount === 'object') {
      body['clubAccount'] = props.clubAccount;
    }

    // Merge additional fields if provided
    if (props.additionalFields && typeof props.additionalFields === 'object') {
      Object.assign(body, props.additionalFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/accounts/savings`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Generate a digital signature for the Demand Deposit/Savings dynamic account inquiry
 */
export const demand_deposit_savings_dynamic_signature = createAction({
  name: 'demand_deposit_savings_dynamic_signature',
  auth: fisHorizonAuth,
  displayName: 'Demand Deposit Savings - Generate Dynamic Signature',
  description: 'Generate a digital signature to be used with the dynamic accounts inquiry API. The signature represents which data fields will be requested.',
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
    accountInformation: Property.Json({
      displayName: 'Account Information Fields',
      description: 'JSON object containing arrays of field names to include. Sections: generalInformation, regulatory, waive, statement, cards, serviceCharge, clubAccount, specialAttention, trustAuthorizationTrustCertification, notary, depositInsuranceDeterminationModernizationCodes',
      required: false,
    }),
    accountBalanceSummary: Property.Json({
      displayName: 'Account Balance Summary Fields',
      description: 'JSON object containing arrays of field names to include. Sections: balanceInformation, chargeOff, historicalBalances, preliminaryChargeOffDetails',
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
      'x-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {};

    if (props.accountInformation && typeof props.accountInformation === 'object') {
      body['accountInformation'] = props.accountInformation;
    }
    if (props.accountBalanceSummary && typeof props.accountBalanceSummary === 'object') {
      body['accountBalanceSummary'] = props.accountBalanceSummary;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/dynamic/accounts/signature`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Return a list of fields for the given digital signature
 */
export const demand_deposit_savings_dynamic_fields = createAction({
  name: 'demand_deposit_savings_dynamic_fields',
  auth: fisHorizonAuth,
  displayName: 'Demand Deposit Savings - Get Dynamic Fields',
  description: 'Retrieve a list of fields for the dynamic accounts inquiry. If digitalSignature is empty, returns all available field names. If a valid signature is provided, returns only the fields associated with that signature.',
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
    digitalSignature: Property.ShortText({
      displayName: 'Digital Signature',
      description: 'Optional: Digital signature in hexadecimal format. If empty, returns all available fields.',
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
      'x-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {};

    if (props.digitalSignature) {
      body['digitalSignature'] = props.digitalSignature;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/dynamic/accounts/fields`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Return Demand Deposit/Savings account information represented by the given digital signature
 */
export const demand_deposit_savings_dynamic_inquiry = createAction({
  name: 'demand_deposit_savings_dynamic_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Demand Deposit Savings - Dynamic Account Inquiry',
  description: 'Retrieve account information for a Demand Deposit or Savings account. The digital signature determines which fields are returned.',
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
    digitalSignature: Property.ShortText({
      displayName: 'Digital Signature',
      description: 'Digital signature containing the list of fields in hexadecimal format. Generate using the Dynamic Signature action.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero-filled account number',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application type',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
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
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'x-authorization': props.xAuthorization,
    };

    if (props.sourceId) {
      headers['source-id'] = props.sourceId;
    }

    const body: Record<string, unknown> = {
      digitalSignature: props.digitalSignature,
      accountNumber: props.accountNumber,
      applicationCode: props.applicationCode,
    };

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${API_PATH}/dynamic/accounts/inquiry`,
      headers,
      body,
    });

    return response.body;
  },
});
