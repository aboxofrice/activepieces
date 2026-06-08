import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// ============================================================================
// HOLDS
// ============================================================================

export const account_restrictions_holds_get = createAction({
  name: 'account_restrictions_holds_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Holds - Get',
  description: 'Retrieve DD, SV, or LN hold records for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings, LN - Loans)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: true,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, firstNext, returnNumber, sourceId } = context.propsValue;
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
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/holds`,
      headers,
      queryParams: {
        firstNext: firstNext,
        returnNumber: String(returnNumber),
      },
    });

    return response.body;
  },
});

export const account_restrictions_holds_add = createAction({
  name: 'account_restrictions_holds_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Holds - Add',
  description: 'Add a Hold to a given DD/SV/LN account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings, LN - Loans)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Hold amount (up to 13 digits)',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format (e.g., 20211231)',
      required: true,
    }),
    description: Property.ShortText({
      displayName: 'Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    holdType: Property.Number({
      displayName: 'Hold Type',
      description: 'Hold Type (00-09)',
      required: false,
      defaultValue: 0,
    }),
    elementSource: Property.ShortText({
      displayName: 'Element Source',
      description: 'Element Source (e.g., ALK)',
      required: false,
    }),
    subSource: Property.ShortText({
      displayName: 'Sub Source',
      description: 'User defined value that identifies transmitting vendor',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, expirationDate, description, holdType, elementSource, subSource, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      amount: amount,
      expirationDate: expirationDate,
    };

    if (description) {
      body['description'] = description;
    }
    if (holdType !== undefined && holdType !== null) {
      body['holdType'] = holdType;
    }
    if (elementSource) {
      body['elementSource'] = elementSource;
    }
    if (subSource) {
      body['subSource'] = subSource;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/holds`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_holds_delete = createAction({
  name: 'account_restrictions_holds_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Holds - Delete',
  description: 'Delete a Hold for a given DD/SV/LN account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings, LN - Loans)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Hold amount to delete (up to 13 digits)',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format',
      required: false,
    }),
    description: Property.ShortText({
      displayName: 'Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    holdType: Property.Number({
      displayName: 'Hold Type',
      description: 'Hold Type (00-09)',
      required: false,
    }),
    elementSource: Property.ShortText({
      displayName: 'Element Source',
      description: 'Element Source (e.g., ALK)',
      required: false,
    }),
    subSource: Property.ShortText({
      displayName: 'Sub Source',
      description: 'User defined value that identifies transmitting vendor',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, expirationDate, description, holdType, elementSource, subSource, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      amount: amount,
    };

    if (expirationDate) {
      body['expirationDate'] = expirationDate;
    }
    if (description) {
      body['description'] = description;
    }
    if (holdType !== undefined && holdType !== null) {
      body['holdType'] = holdType;
    }
    if (elementSource) {
      body['elementSource'] = elementSource;
    }
    if (subSource) {
      body['subSource'] = subSource;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/delete-holds`,
      headers,
      body,
    });

    return response.body;
  },
});

// ============================================================================
// STOPS
// ============================================================================

export const account_restrictions_stops_get = createAction({
  name: 'account_restrictions_stops_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Stops - Get',
  description: 'Retrieve DD, SV, or LN stop records for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings, LN - Loans)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: false,
      defaultValue: 'F',
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: false,
      defaultValue: 1,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, firstNext, returnNumber, sourceId } = context.propsValue;
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
    if (firstNext) {
      queryParams['firstNext'] = firstNext;
    }
    if (returnNumber) {
      queryParams['returnNumber'] = String(returnNumber);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/stops`,
      headers,
      queryParams,
    });

    return response.body;
  },
});

export const account_restrictions_stops_add = createAction({
  name: 'account_restrictions_stops_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Stops - Add',
  description: 'Add a Stop to a given DD/SV/LN account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings, LN - Loans)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Stop amount',
      required: true,
    }),
    amountLimit: Property.Number({
      displayName: 'Amount Limit',
      description: 'Amount/Limit (up to 11 digits)',
      required: true,
    }),
    checkNumber: Property.Number({
      displayName: 'Check Number',
      description: 'Check Number of the Transaction',
      required: true,
    }),
    checkDate: Property.Number({
      displayName: 'Check Date',
      description: 'Check/Request Date in YYYYMMDD format',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    description: Property.ShortText({
      displayName: 'Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    lowRangeCheckNumber: Property.Number({
      displayName: 'Low Range Check Number',
      description: 'Check number Low range',
      required: false,
    }),
    highRangeCheckNumber: Property.Number({
      displayName: 'High Range Check Number',
      description: 'Check number High range',
      required: false,
    }),
    deleteMatchCode: Property.StaticDropdown({
      displayName: 'Delete Match Code',
      description: 'Delete match code for stop deletion',
      required: false,
      options: {
        options: [
          { label: '1 - Delete 1st match on Acct/Check', value: '1' },
          { label: '2 - Delete 1st match on Acct/Amount', value: '2' },
          { label: '3 - Delete 1st match on Acct/Chk#/Amount', value: '3' },
          { label: 'Blank - Add', value: '' },
        ],
      },
    }),
    individualId: Property.ShortText({
      displayName: 'Individual ID',
      description: 'Individual ID (max 22 characters)',
      required: false,
    }),
    returnReason: Property.StaticDropdown({
      displayName: 'Return Reason',
      description: 'Return Reason',
      required: false,
      options: {
        options: [
          { label: 'R02', value: 'R02' },
          { label: 'R07', value: 'R07' },
          { label: 'R08', value: 'R08' },
          { label: 'R10', value: 'R10' },
          { label: 'R14', value: 'R14' },
          { label: 'R15', value: 'R15' },
          { label: 'R16', value: 'R16' },
          { label: 'R29', value: 'R29' },
        ],
      },
    }),
    dateOfDeath: Property.Number({
      displayName: 'Date of Death',
      description: 'Date of Death in YYYYMMDD format',
      required: false,
    }),
    companyId: Property.StaticDropdown({
      displayName: 'Company ID',
      description: 'Company ID',
      required: false,
      options: {
        options: [
          { label: 'STPALLACH', value: 'STPALLACH' },
          { label: 'STPACHCR', value: 'STPACHCR' },
          { label: 'STPACHDR', value: 'STPACHDR' },
          { label: 'SUSALLACH', value: 'SUSALLACH' },
          { label: 'SUSACHCR', value: 'SUSACHCR' },
          { label: 'SUSACHDR', value: 'SUSACHDR' },
        ],
      },
    }),
    stopType: Property.Number({
      displayName: 'Stop Type',
      description: 'Stop Payment Type (0-9)',
      required: false,
    }),
    elementSource: Property.ShortText({
      displayName: 'Element Source',
      description: 'Element Source (e.g., ALK)',
      required: false,
    }),
    subSource: Property.ShortText({
      displayName: 'Sub Source',
      description: 'User defined value that identifies transmitting vendor',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, amountLimit, checkNumber, checkDate, expirationDate, userId, description, lowRangeCheckNumber, highRangeCheckNumber, deleteMatchCode, individualId, returnReason, dateOfDeath, companyId, stopType, elementSource, subSource, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      amount: amount,
      amountLimit: amountLimit,
      checkNumber: checkNumber,
      checkDate: checkDate,
      expirationDate: expirationDate,
      userId: userId,
    };

    if (description) {
      body['description'] = description;
    }
    if (lowRangeCheckNumber !== undefined && lowRangeCheckNumber !== null) {
      body['lowRangeCheckNumber'] = lowRangeCheckNumber;
    }
    if (highRangeCheckNumber !== undefined && highRangeCheckNumber !== null) {
      body['highRangeCheckNumber'] = highRangeCheckNumber;
    }
    if (deleteMatchCode) {
      body['deleteMatchCode'] = deleteMatchCode;
    }
    if (individualId) {
      body['individualId'] = individualId;
    }
    if (returnReason) {
      body['returnReason'] = returnReason;
    }
    if (dateOfDeath !== undefined && dateOfDeath !== null) {
      body['dateOfDeath'] = dateOfDeath;
    }
    if (companyId) {
      body['companyId'] = companyId;
    }
    if (stopType !== undefined && stopType !== null) {
      body['stopType'] = stopType;
    }
    if (elementSource) {
      body['elementSource'] = elementSource;
    }
    if (subSource) {
      body['subSource'] = subSource;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/stops`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_stops_delete = createAction({
  name: 'account_restrictions_stops_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Stops - Delete',
  description: 'Delete a Stop for a given DD/SV/LN account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings, LN - Loans)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Stop amount',
      required: true,
    }),
    amountLimit: Property.Number({
      displayName: 'Amount Limit',
      description: 'Amount/Limit (up to 11 digits)',
      required: true,
    }),
    checkNumber: Property.Number({
      displayName: 'Check Number',
      description: 'Check Number of the Transaction',
      required: true,
    }),
    checkDate: Property.Number({
      displayName: 'Check Date',
      description: 'Check/Request Date in YYYYMMDD format',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    deleteMatchCode: Property.StaticDropdown({
      displayName: 'Delete Match Code',
      description: 'Delete match code',
      required: false,
      defaultValue: '2',
      options: {
        options: [
          { label: '1 - Delete 1st match on Acct/Check', value: '1' },
          { label: '2 - Delete 1st match on Acct/Amount', value: '2' },
          { label: '3 - Delete 1st match on Acct/Chk#/Amount', value: '3' },
        ],
      },
    }),
    description: Property.ShortText({
      displayName: 'Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    lowRangeCheckNumber: Property.Number({
      displayName: 'Low Range Check Number',
      description: 'Check number Low range',
      required: false,
    }),
    highRangeCheckNumber: Property.Number({
      displayName: 'High Range Check Number',
      description: 'Check number High range',
      required: false,
    }),
    individualId: Property.ShortText({
      displayName: 'Individual ID',
      description: 'Individual ID (max 22 characters)',
      required: false,
    }),
    returnReason: Property.StaticDropdown({
      displayName: 'Return Reason',
      description: 'Return Reason',
      required: false,
      options: {
        options: [
          { label: 'R02', value: 'R02' },
          { label: 'R07', value: 'R07' },
          { label: 'R08', value: 'R08' },
          { label: 'R10', value: 'R10' },
          { label: 'R14', value: 'R14' },
          { label: 'R15', value: 'R15' },
          { label: 'R16', value: 'R16' },
          { label: 'R29', value: 'R29' },
        ],
      },
    }),
    dateOfDeath: Property.Number({
      displayName: 'Date of Death',
      description: 'Date of Death in YYYYMMDD format',
      required: false,
    }),
    companyId: Property.StaticDropdown({
      displayName: 'Company ID',
      description: 'Company ID',
      required: false,
      options: {
        options: [
          { label: 'STPALLACH', value: 'STPALLACH' },
          { label: 'STPACHCR', value: 'STPACHCR' },
          { label: 'STPACHDR', value: 'STPACHDR' },
          { label: 'SUSALLACH', value: 'SUSALLACH' },
          { label: 'SUSACHCR', value: 'SUSACHCR' },
          { label: 'SUSACHDR', value: 'SUSACHDR' },
        ],
      },
    }),
    stopType: Property.Number({
      displayName: 'Stop Type',
      description: 'Stop Payment Type (0-9)',
      required: false,
    }),
    elementSource: Property.ShortText({
      displayName: 'Element Source',
      description: 'Element Source (e.g., ALK)',
      required: false,
    }),
    subSource: Property.ShortText({
      displayName: 'Sub Source',
      description: 'User defined value that identifies transmitting vendor',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, amountLimit, checkNumber, checkDate, expirationDate, userId, deleteMatchCode, description, lowRangeCheckNumber, highRangeCheckNumber, individualId, returnReason, dateOfDeath, companyId, stopType, elementSource, subSource, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      amount: amount,
      amountLimit: amountLimit,
      checkNumber: checkNumber,
      checkDate: checkDate,
      expirationDate: expirationDate,
      userId: userId,
    };

    if (deleteMatchCode) {
      body['deleteMatchCode'] = deleteMatchCode;
    }
    if (description) {
      body['description'] = description;
    }
    if (lowRangeCheckNumber !== undefined && lowRangeCheckNumber !== null) {
      body['lowRangeCheckNumber'] = lowRangeCheckNumber;
    }
    if (highRangeCheckNumber !== undefined && highRangeCheckNumber !== null) {
      body['highRangeCheckNumber'] = highRangeCheckNumber;
    }
    if (individualId) {
      body['individualId'] = individualId;
    }
    if (returnReason) {
      body['returnReason'] = returnReason;
    }
    if (dateOfDeath !== undefined && dateOfDeath !== null) {
      body['dateOfDeath'] = dateOfDeath;
    }
    if (companyId) {
      body['companyId'] = companyId;
    }
    if (stopType !== undefined && stopType !== null) {
      body['stopType'] = stopType;
    }
    if (elementSource) {
      body['elementSource'] = elementSource;
    }
    if (subSource) {
      body['subSource'] = subSource;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/delete-stops`,
      headers,
      body,
    });

    return response.body;
  },
});

// ============================================================================
// RESTRICTIONS
// ============================================================================

export const account_restrictions_restrictions_get = createAction({
  name: 'account_restrictions_restrictions_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Restrictions - Get',
  description: 'Retrieve DD and SV restriction records for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: false,
      defaultValue: 'F',
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, returnNumber, firstNext, sourceId } = context.propsValue;
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
      returnNumber: String(returnNumber),
    };
    if (firstNext) {
      queryParams['firstNext'] = firstNext;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/restriction`,
      headers,
      queryParams,
    });

    return response.body;
  },
});

export const account_restrictions_restrictions_add = createAction({
  name: 'account_restrictions_restrictions_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Restrictions - Add',
  description: 'Add a Restriction to a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    payeeDescription: Property.ShortText({
      displayName: 'Payee/Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    returnReason: Property.StaticDropdown({
      displayName: 'Return Reason',
      description: 'Return Reason',
      required: false,
      options: {
        options: [
          { label: 'R02', value: 'R02' },
          { label: 'R07', value: 'R07' },
          { label: 'R08', value: 'R08' },
          { label: 'R10', value: 'R10' },
          { label: 'R14', value: 'R14' },
          { label: 'R15', value: 'R15' },
          { label: 'R16', value: 'R16' },
          { label: 'R29', value: 'R29' },
        ],
      },
    }),
    dateOfDeath: Property.Number({
      displayName: 'Date of Death',
      description: 'Date of Death in YYYYMMDD format',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, expirationDate, userId, payeeDescription, returnReason, dateOfDeath, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      expirationDate: expirationDate,
      userId: userId,
    };

    if (payeeDescription) {
      body['payeeDescription'] = payeeDescription;
    }
    if (returnReason) {
      body['returnReason'] = returnReason;
    }
    if (dateOfDeath !== undefined && dateOfDeath !== null) {
      body['dateOfDeath'] = dateOfDeath;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/restriction`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_restrictions_delete = createAction({
  name: 'account_restrictions_restrictions_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Restrictions - Delete',
  description: 'Delete a Restriction for a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, userId, sourceId } = context.propsValue;
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
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/restriction`,
      headers,
      queryParams: {
        userId: userId,
      },
    });

    return response.body;
  },
});

// ============================================================================
// WATCH
// ============================================================================

export const account_restrictions_watch_get = createAction({
  name: 'account_restrictions_watch_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Watch - Get',
  description: 'Retrieve a DD or SV watch instruction for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: true,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, firstNext, returnNumber, sourceId } = context.propsValue;
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
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/watch`,
      headers,
      queryParams: {
        firstNext: firstNext,
        returnNumber: String(returnNumber),
      },
    });

    return response.body;
  },
});

export const account_restrictions_watch_add = createAction({
  name: 'account_restrictions_watch_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Watch - Add',
  description: 'Add a Watch to a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    payeeDescription: Property.ShortText({
      displayName: 'Payee/Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, expirationDate, userId, payeeDescription, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      expirationDate: expirationDate,
      userId: userId,
    };

    if (payeeDescription) {
      body['payeeDescription'] = payeeDescription;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/watch`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_watch_delete = createAction({
  name: 'account_restrictions_watch_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Watch - Delete',
  description: 'Delete a Watch for a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, userId, sourceId } = context.propsValue;
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
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/watch`,
      headers,
      queryParams: {
        userId: userId,
      },
    });

    return response.body;
  },
});

// ============================================================================
// CREDITS ONLY
// ============================================================================

export const account_restrictions_credits_only_get = createAction({
  name: 'account_restrictions_credits_only_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Credits Only - Get',
  description: 'Retrieve a DD or SV credits only instruction for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: true,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, firstNext, returnNumber, sourceId } = context.propsValue;
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
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/credits-only`,
      headers,
      queryParams: {
        firstNext: firstNext,
        returnNumber: String(returnNumber),
      },
    });

    return response.body;
  },
});

export const account_restrictions_credits_only_add = createAction({
  name: 'account_restrictions_credits_only_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Credits Only - Add',
  description: 'Add a Credits Only instruction to a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    payeeDescription: Property.ShortText({
      displayName: 'Payee/Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, expirationDate, userId, payeeDescription, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      expirationDate: expirationDate,
      userId: userId,
    };

    if (payeeDescription) {
      body['payeeDescription'] = payeeDescription;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/credits-only`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_credits_only_delete = createAction({
  name: 'account_restrictions_credits_only_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Credits Only - Delete',
  description: 'Delete a Credit Only instruction for a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, userId, sourceId } = context.propsValue;
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
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/credits-only`,
      headers,
      queryParams: {
        userId: userId,
      },
    });

    return response.body;
  },
});

// ============================================================================
// BANK FLOAT
// ============================================================================

export const account_restrictions_bank_float_get = createAction({
  name: 'account_restrictions_bank_float_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Bank Float - Get',
  description: 'Retrieve DD or SV bank float records for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: true,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, firstNext, returnNumber, sourceId } = context.propsValue;
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
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/bank-float`,
      headers,
      queryParams: {
        firstNext: firstNext,
        returnNumber: String(returnNumber),
      },
    });

    return response.body;
  },
});

export const account_restrictions_bank_float_add = createAction({
  name: 'account_restrictions_bank_float_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Bank Float - Add',
  description: 'Add a Bank Float to a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Amount (up to 13 digits with 2 decimal places)',
      required: true,
    }),
    floatDays: Property.Number({
      displayName: 'Float Days',
      description: 'Number of float days (0-99)',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, floatDays, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      amount: amount,
      floatDays: floatDays,
    };

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/bank-float`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_bank_float_delete = createAction({
  name: 'account_restrictions_bank_float_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Bank Float - Delete',
  description: 'Delete a Bank Float for a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Amount (up to 13 digits with 2 decimal places)',
      required: true,
    }),
    floatDays: Property.Number({
      displayName: 'Float Days',
      description: 'Number of float days (0-99)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, floatDays, sourceId } = context.propsValue;
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
      amount: String(amount),
    };
    if (floatDays !== undefined && floatDays !== null) {
      queryParams['floatDays'] = String(floatDays);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/bank-float`,
      headers,
      queryParams,
    });

    return response.body;
  },
});

// ============================================================================
// CUSTOMER FLOAT
// ============================================================================

export const account_restrictions_customer_float_get = createAction({
  name: 'account_restrictions_customer_float_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Customer Float - Get',
  description: 'Retrieve DD or SV customer float records for a given account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: true,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, firstNext, returnNumber, sourceId } = context.propsValue;
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
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/customer-float`,
      headers,
      queryParams: {
        firstNext: firstNext,
        returnNumber: String(returnNumber),
      },
    });

    return response.body;
  },
});

export const account_restrictions_customer_float_add = createAction({
  name: 'account_restrictions_customer_float_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Customer Float - Add',
  description: 'Add a Customer Float to a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Amount (up to 13 digits with 2 decimal places)',
      required: true,
    }),
    floatDays: Property.Number({
      displayName: 'Float Days',
      description: 'Number of float days (0-99)',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, floatDays, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      amount: amount,
      floatDays: floatDays,
    };

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/customer-float`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_customer_float_delete = createAction({
  name: 'account_restrictions_customer_float_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - Customer Float - Delete',
  description: 'Delete a Customer Float for a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Amount (up to 13 digits with 2 decimal places)',
      required: true,
    }),
    floatDays: Property.Number({
      displayName: 'Float Days',
      description: 'Number of float days (0-99)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, amount, floatDays, sourceId } = context.propsValue;
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
      amount: String(amount),
    };
    if (floatDays !== undefined && floatDays !== null) {
      queryParams['floatDays'] = String(floatDays);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/customer-float`,
      headers,
      queryParams,
    });

    return response.body;
  },
});

// ============================================================================
// NO CHECKS
// ============================================================================

export const account_restrictions_no_checks_get = createAction({
  name: 'account_restrictions_no_checks_get',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - No Checks - Get',
  description: 'Retrieve a no checks restriction for a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'F - First request, N - Next request for additional records',
      required: true,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, firstNext, returnNumber, sourceId } = context.propsValue;
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
      method: HttpMethod.GET,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/no-checks`,
      headers,
      queryParams: {
        firstNext: firstNext,
        returnNumber: String(returnNumber),
      },
    });

    return response.body;
  },
});

export const account_restrictions_no_checks_add = createAction({
  name: 'account_restrictions_no_checks_add',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - No Checks - Add',
  description: 'Add a no checks restriction to a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in YYYYMMDD format',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: false,
    }),
    payeeDescription: Property.ShortText({
      displayName: 'Payee/Description',
      description: 'Payee/Reason/Description (max 25 characters)',
      required: false,
    }),
    overrideFlag: Property.ShortText({
      displayName: 'Override Flag',
      description: 'Y to override (only works for error 16, 17, or 32)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, expirationDate, userId, payeeDescription, overrideFlag, sourceId } = context.propsValue;
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

    const body: Record<string, any> = {
      expirationDate: expirationDate,
    };

    if (userId) {
      body['userId'] = userId;
    }
    if (payeeDescription) {
      body['payeeDescription'] = payeeDescription;
    }
    if (overrideFlag) {
      body['overrideFlag'] = overrideFlag;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/no-checks`,
      headers,
      body,
    });

    return response.body;
  },
});

export const account_restrictions_no_checks_delete = createAction({
  name: 'account_restrictions_no_checks_delete',
  auth: fisHorizonAuth,
  displayName: 'Account Restrictions - No Checks - Delete',
  description: 'Delete a no checks restriction for a given DD/SV account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token from the authorization endpoint (Bearer token)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application type (DD - Demand Deposits, SV - Savings)',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters)',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, userId, sourceId } = context.propsValue;
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
    if (userId) {
      queryParams['userId'] = userId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/account-restrictions/v1/accounts/${applicationCode}/${accountNumber}/transactions/posting-restrictions/no-checks`,
      headers,
      queryParams,
    });

    return response.body;
  },
});
