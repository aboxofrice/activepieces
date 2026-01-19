import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

/**
 * Account Aggregation - Inquiry
 * GET /accounts/{applicationCode}/{accountNumber}
 * Fetch basic information for an account
 */
export const accountAggregationInquiry = createAction({
  name: 'account_aggregation_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Account Aggregation - Inquiry',
  description: 'Fetch basic information for an account. This inquiry is designed to retrieve basic information relating to an account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'JWT Bearer token for authorization (e.g., Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...)',
      required: true,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'Any Application beginning with X, Y or Z, excluding YE. Valid Values: Xx, Yx, Zx (where x = 0-9 or A-Z except YE). Max 2 characters.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number.',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Optional: Specifies the unique identifier associated with a customer. Right-justified, zero filled, up to 14 digits.',
      required: false,
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Optional: Whether to return data in uppercase.',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, customerId, returnUppercase, sourceId } = context.propsValue;

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

    let url = `${baseUrl}/account-aggregation/v1/accounts/${encodeURIComponent(applicationCode)}/${encodeURIComponent(accountNumber)}`;

    const queryParams: string[] = [];
    if (customerId) {
      queryParams.push(`customerId=${encodeURIComponent(customerId)}`);
    }
    if (returnUppercase) {
      queryParams.push(`returnUppercase=${encodeURIComponent(returnUppercase)}`);
    }
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});

/**
 * Account Aggregation - Get
 * GET /accounts/{applicationCode}/{accountNumber}/aggregation
 * Retrieve aggregate account data
 */
export const accountAggregationGet = createAction({
  name: 'account_aggregation_get',
  auth: fisHorizonAuth,
  displayName: 'Account Aggregation - Get',
  description: 'Retrieve aggregate account data. This transaction is designed to retrieve aggregate account data.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'JWT Bearer token for authorization (e.g., Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...)',
      required: true,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'Any Application beginning with X, Y or Z, excluding YE. Valid Values: Xx, Yx, Zx (where x = 0-9 or A-Z except YE). Max 2 characters.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number. To be able to find both numeric and alpha-numeric account number, do not zero fill with leading or trailing zeroes. Max 20 characters.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { xAuthorization, applicationCode, accountNumber, sourceId } = context.propsValue;

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

    const url = `${baseUrl}/account-aggregation/v1/accounts/${encodeURIComponent(applicationCode)}/${encodeURIComponent(accountNumber)}/aggregation`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});

/**
 * Account Aggregation - Transactions
 * GET /accounts/{applicationCode}/{accountNumber}/transactions
 * Fetch a list of historic transactions
 */
export const accountAggregationTransactions = createAction({
  name: 'account_aggregation_transactions',
  auth: fisHorizonAuth,
  displayName: 'Account Aggregation - Transactions',
  description: 'Fetch a list of historic transactions. This inquiry is designed to retrieve a list of transactions from history for a specific application and account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'JWT Bearer token for authorization (e.g., Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...)',
      required: true,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'Any Application beginning with X, Y or Z, excluding YE. Valid Values: Xx, Yx, Zx (where x = 0-9 or A-Z except YE). Max 2 characters.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number.',
      required: true,
    }),
    dateSelectOption: Property.StaticDropdown({
      displayName: 'Date Select Option',
      description: 'Specifies how to select transactions by date.',
      required: true,
      options: {
        options: [
          { label: 'M - Return only Today\'s memo posted transactions', value: 'M' },
          { label: 'P - All transactions posted during the last BOSS processing run', value: 'P' },
          { label: 'R - User specified date range (Effective Dates)', value: 'R' },
          { label: 'S - All transactions since the last statement date', value: 'S' },
          { label: 'T - User specified date range (Transaction Dates)', value: 'T' },
        ],
      },
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'Indicates if this is the first request or a subsequent request for more data.',
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
      description: 'Number of transactions to return at a time. A value of 999 returns as many records as can fit in the buffer.',
      required: true,
      defaultValue: 999,
    }),
    beginDate: Property.Number({
      displayName: 'Begin Date',
      description: 'Optional: Only valid when Date Select Option is R, T, or M. Retrieves all history transactions greater than or equal to this date. Format YYYYMMDD.',
      required: false,
    }),
    endDate: Property.Number({
      displayName: 'End Date',
      description: 'Optional: Only valid when Date Select Option is R or T. Retrieves all history transactions ending with this date. Format YYYYMMDD. If zero, defaults to 99999999.',
      required: false,
    }),
    sequenceOption: Property.StaticDropdown({
      displayName: 'Sequence Option',
      description: 'Optional: Order of returned transactions.',
      required: false,
      options: {
        options: [
          { label: 'A - Ascending order', value: 'A' },
          { label: 'D - Descending order', value: 'D' },
        ],
      },
    }),
    returnMemoPostTransaction: Property.StaticDropdown({
      displayName: 'Return Memo Post Transaction',
      description: 'Optional: Whether to return memo post transactions.',
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
      description: 'Optional: Whether to return package post items.',
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
      description: 'Optional: Whether to return scheduled Auto Transfers. Only works for LN and ML Internal Credit Auto Transfers.',
      required: false,
      options: {
        options: [
          { label: 'Y - Return scheduled Auto Transfers', value: 'Y' },
          { label: 'N - Do not return scheduled Auto Transfers', value: 'N' },
        ],
      },
    }),
    searchToken: Property.ShortText({
      displayName: 'Search Token',
      description: 'Optional: Search Token for stateless middleware processing. Max 20 characters.',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const {
      xAuthorization,
      applicationCode,
      accountNumber,
      dateSelectOption,
      firstNext,
      numberToReturn,
      beginDate,
      endDate,
      sequenceOption,
      returnMemoPostTransaction,
      returnPackagePostItems,
      returnScheduledExternalTransfers,
      searchToken,
      sourceId,
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

    let url = `${baseUrl}/account-aggregation/v1/accounts/${encodeURIComponent(applicationCode)}/${encodeURIComponent(accountNumber)}/transactions`;

    const queryParams: string[] = [];
    queryParams.push(`dateSelectOption=${encodeURIComponent(dateSelectOption)}`);
    queryParams.push(`firstNext=${encodeURIComponent(firstNext)}`);
    queryParams.push(`numberToReturn=${encodeURIComponent(String(numberToReturn))}`);

    if (beginDate !== undefined && beginDate !== null) {
      queryParams.push(`beginDate=${encodeURIComponent(String(beginDate))}`);
    }
    if (endDate !== undefined && endDate !== null) {
      queryParams.push(`endDate=${encodeURIComponent(String(endDate))}`);
    }
    if (sequenceOption) {
      queryParams.push(`sequenceOption=${encodeURIComponent(sequenceOption)}`);
    }
    if (returnMemoPostTransaction) {
      queryParams.push(`returnMemoPostTransaction=${encodeURIComponent(returnMemoPostTransaction)}`);
    }
    if (returnPackagePostItems) {
      queryParams.push(`returnPackagePostItems=${encodeURIComponent(returnPackagePostItems)}`);
    }
    if (returnScheduledExternalTransfers) {
      queryParams.push(`returnScheduledExternalTransfers=${encodeURIComponent(returnScheduledExternalTransfers)}`);
    }
    if (searchToken) {
      queryParams.push(`searchToken=${encodeURIComponent(searchToken)}`);
    }

    url += '?' + queryParams.join('&');

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});
