import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildHeaders(auth: any, xAuthorization: string, sourceId?: string): Record<string, string> {
  const uuid = crypto.randomUUID();
  const headers: Record<string, string> = {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'organization-id': auth.organizationId,
    'uuid': uuid,
    'horizon-authorization': xAuthorization,
  };
  if (sourceId) {
    headers['source-id'] = sourceId;
  }
  return headers;
}

// ============================================================================
// CUSTOMER ID ENDPOINTS
// ============================================================================

export const bank_controls_customer_id_personal_identifiers_list = createAction({
  name: 'bank_controls_customer_id_personal_identifiers_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Customer ID - Personal Identifiers List',
  description: 'Retrieve a list of valid Identification Types defined for the customer Personal Identifiers.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization (Bearer token from Get Token action)',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number from 1-99 that indicates how many records to return at one time',
      required: true,
      defaultValue: 99,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First or Next request flag',
      required: true,
      defaultValue: 'F',
      options: {
        options: [
          { label: 'First Request', value: 'F' },
          { label: 'Next Request', value: 'N' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, returnNumber, firstNext } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/personal-identifiers-list`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams: {
        returnNumber: String(returnNumber),
        firstNext: firstNext,
      },
    });

    return response.body;
  },
});

// ============================================================================
// DEMAND DEPOSIT DOWNLOADS
// ============================================================================

export const bank_controls_demand_deposits_fee_table = createAction({
  name: 'bank_controls_demand_deposits_fee_table',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Fee Table',
  description: 'Retrieve Demand Deposit cycle based recurring fees.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    miscellaneousFeeTable: Property.ShortText({
      displayName: 'Miscellaneous Fee Table',
      description: 'Either the miscellaneousFeeTable or the ProductType is required',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Either the miscellaneousFeeTable or the ProductType is required',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, miscellaneousFeeTable, productType } = context.propsValue;

    const queryParams: Record<string, string> = {};
    if (miscellaneousFeeTable) queryParams['miscellaneousFeeTable'] = miscellaneousFeeTable;
    if (productType) queryParams['productType'] = productType;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/fee-table`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams,
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_promotional_rates_detail = createAction({
  name: 'bank_controls_demand_deposits_promotional_rates_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Promotional Rates Detail',
  description: 'Retrieve the details for a demand deposits promotional rate.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch Number (up to 4 numeric digits)',
      required: true,
    }),
    promotionalCode: Property.ShortText({
      displayName: 'Promotional Code',
      description: 'Promotional code (up to 5 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, branchNumber, promotionalCode } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/promotional-rates/${branchNumber}/${promotionalCode}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_promotional_codes_list = createAction({
  name: 'bank_controls_demand_deposits_promotional_codes_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Promotional Codes List',
  description: 'Retrieve a list of promotional rates for a demand deposits product type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch Number (up to 4 numeric digits)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code',
      required: true,
      options: {
        options: [
          { label: 'Demand Deposit', value: 'DD' },
          { label: 'Certificate of Deposit', value: 'CD' },
          { label: 'Collections', value: 'CO' },
          { label: 'Collateral Tracking', value: 'CT' },
          { label: 'Individual Retirement', value: 'IR' },
          { label: 'Loan System', value: 'LN' },
          { label: 'Mortgage Loans', value: 'ML' },
          { label: 'Relationship Management', value: 'RM' },
          { label: 'Savings', value: 'SV' },
        ],
      },
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, branchNumber, applicationCode, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/promotional-codes/${branchNumber}/${applicationCode}/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_product_types_detail = createAction({
  name: 'bank_controls_demand_deposits_product_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Product Types Detail',
  description: 'Retrieve details of demand deposit product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/product-types/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_product_types_list = createAction({
  name: 'bank_controls_demand_deposits_product_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Product Types List',
  description: 'Retrieve a list of demand deposit product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/product-types/list`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_interest_types_detail = createAction({
  name: 'bank_controls_demand_deposits_interest_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Interest Types Detail',
  description: 'Retrieve details of a demand deposit interest types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    interestType: Property.Number({
      displayName: 'Interest Type',
      description: 'Interest Rate Type (up to 2 numeric digits)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, interestType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/interest-types/${interestType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_interest_types_list = createAction({
  name: 'bank_controls_demand_deposits_interest_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Interest Types List',
  description: 'Retrieve a list of demand deposit interest types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/interest-types/list`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_service_charge_types_detail = createAction({
  name: 'bank_controls_demand_deposits_service_charge_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Service Charge Types Detail',
  description: 'Retrieve details of demand deposit service charge types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    chargeType: Property.ShortText({
      displayName: 'Charge Type',
      description: 'Service Charge Type',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, chargeType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/service-charge-types/${chargeType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_demand_deposits_service_charge_types_list = createAction({
  name: 'bank_controls_demand_deposits_service_charge_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Demand Deposits - Service Charge Types List',
  description: 'Retrieve a list of demand deposit charge types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/demand-deposits/service-charge-types/list`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// SAVINGS DOWNLOADS
// ============================================================================

export const bank_controls_savings_fee_table = createAction({
  name: 'bank_controls_savings_fee_table',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Fee Table',
  description: 'Retrieve savings cycle based recurring fees.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    miscellaneousFeeTable: Property.ShortText({
      displayName: 'Miscellaneous Fee Table',
      description: 'Either the miscellaneousFeeTable or the ProductType is required',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Either the miscellaneousFeeTable or the ProductType is required',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, miscellaneousFeeTable, productType } = context.propsValue;

    const queryParams: Record<string, string> = {};
    if (miscellaneousFeeTable) queryParams['miscellaneousFeeTable'] = miscellaneousFeeTable;
    if (productType) queryParams['productType'] = productType;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/fee-table`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams,
    });

    return response.body;
  },
});

export const bank_controls_savings_promotional_rates_detail = createAction({
  name: 'bank_controls_savings_promotional_rates_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Promotional Rates Detail',
  description: 'Retrieve the details for a savings promotional rate.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch Number (up to 4 numeric digits)',
      required: true,
    }),
    promotionalCode: Property.ShortText({
      displayName: 'Promotional Code',
      description: 'Promotional code (up to 5 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, branchNumber, promotionalCode } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/promotional-rates/${branchNumber}/${promotionalCode}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_savings_promotional_codes_list = createAction({
  name: 'bank_controls_savings_promotional_codes_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Promotional Codes List',
  description: 'Retrieve a list of promotional rates for a savings product type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch Number (up to 4 numeric digits)',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code',
      required: true,
      options: {
        options: [
          { label: 'Demand Deposit', value: 'DD' },
          { label: 'Certificate of Deposit', value: 'CD' },
          { label: 'Collections', value: 'CO' },
          { label: 'Collateral Tracking', value: 'CT' },
          { label: 'Individual Retirement', value: 'IR' },
          { label: 'Loan System', value: 'LN' },
          { label: 'Mortgage Loans', value: 'ML' },
          { label: 'Relationship Management', value: 'RM' },
          { label: 'Savings', value: 'SV' },
        ],
      },
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, branchNumber, applicationCode, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/promotional-codes/${branchNumber}/${applicationCode}/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_savings_product_types_detail = createAction({
  name: 'bank_controls_savings_product_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Product Types Detail',
  description: 'Retrieve details of savings product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Valid Savings Account Type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/product-types/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_savings_product_types_list = createAction({
  name: 'bank_controls_savings_product_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Product Types List',
  description: 'Retrieve a list of savings product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/product-types/list`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_savings_interest_types_detail = createAction({
  name: 'bank_controls_savings_interest_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Interest Types Detail',
  description: 'Retrieve details of savings interest types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    interestType: Property.Number({
      displayName: 'Interest Type',
      description: 'Valid Interest Type (up to 2 numeric digits)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, interestType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/interest-types/${interestType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_savings_interest_types_list = createAction({
  name: 'bank_controls_savings_interest_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Interest Types List',
  description: 'Retrieve a list of savings interest types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/interest-types/list`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_savings_service_charge_types_detail = createAction({
  name: 'bank_controls_savings_service_charge_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Service Charge Types Detail',
  description: 'Retrieve details of savings service charge types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    chargeType: Property.ShortText({
      displayName: 'Charge Type',
      description: 'Valid Savings Service Charge Type',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, chargeType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/service-charge-types/${chargeType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_savings_service_charge_types_list = createAction({
  name: 'bank_controls_savings_service_charge_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Savings - Service Charge Types List',
  description: 'Retrieve a list of savings service charge types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/savings/service-charge-types/list`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// LOAN DOWNLOADS
// ============================================================================

export const bank_controls_loans_product_types_list = createAction({
  name: 'bank_controls_loans_product_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Loans - Product Types List',
  description: 'Retrieve a list of loan product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/loans/product-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_loans_product_types_detail = createAction({
  name: 'bank_controls_loans_product_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Loans - Product Types Detail',
  description: 'Retrieve detailed information for a specific loan product type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Loan product type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/loans/product-types/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// MORTGAGE LOAN DOWNLOADS
// ============================================================================

export const bank_controls_mortgage_loans_product_types_list = createAction({
  name: 'bank_controls_mortgage_loans_product_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Mortgage Loans - Product Types List',
  description: 'Retrieve a list of mortgage loan product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/mortgage-loans/product-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_mortgage_loans_product_types_detail = createAction({
  name: 'bank_controls_mortgage_loans_product_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Mortgage Loans - Product Types Detail',
  description: 'Retrieve detailed information for a specific mortgage loan product type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Mortgage loan product type (up to 10 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/mortgage-loans/product-types/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// READY RESERVE DOWNLOADS
// ============================================================================

export const bank_controls_ready_reserve_rate_types_detail = createAction({
  name: 'bank_controls_ready_reserve_rate_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Ready Reserve - Rate Types Detail',
  description: 'Retrieve details of a ready reserve variable rate type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    rateType: Property.Number({
      displayName: 'Rate Type',
      description: 'Rate Type (up to 99)',
      required: true,
    }),
    effectiveDate: Property.Number({
      displayName: 'Effective Date',
      description: 'Effective Date in CCYYMMDD format',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, rateType, effectiveDate } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/ready-reserve/rate-types/${rateType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams: {
        effectiveDate: String(effectiveDate),
      },
    });

    return response.body;
  },
});

export const bank_controls_ready_reserve_rate_types_list = createAction({
  name: 'bank_controls_ready_reserve_rate_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Ready Reserve - Rate Types List',
  description: 'Retrieve a list of ready reserve variable rate types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/ready-reserve/rate-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_ready_reserve_product_types_detail = createAction({
  name: 'bank_controls_ready_reserve_product_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Ready Reserve - Product Types Detail',
  description: 'Retrieve details of a ready reserve product type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Ready reserve product type (up to 2 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/ready-reserve/product-types/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_ready_reserve_product_types_list = createAction({
  name: 'bank_controls_ready_reserve_product_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Ready Reserve - Product Types List',
  description: 'Retrieve a list of ready reserve product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/ready-reserve/product-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// SAFE DEPOSIT BOX DOWNLOADS
// ============================================================================

export const bank_controls_safe_deposit_box_list = createAction({
  name: 'bank_controls_safe_deposit_box_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Safe Deposit Box - List',
  description: 'Retrieve the list of safe deposit boxes.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    statusAvailable: Property.StaticDropdown({
      displayName: 'Status Available',
      description: 'Include available boxes',
      required: true,
      defaultValue: 'Y',
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    statusPending: Property.StaticDropdown({
      displayName: 'Status Pending',
      description: 'Include pending boxes',
      required: true,
      defaultValue: 'Y',
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    statusRented: Property.StaticDropdown({
      displayName: 'Status Rented',
      description: 'Include rented boxes',
      required: true,
      defaultValue: 'Y',
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    statusDrillPending: Property.StaticDropdown({
      displayName: 'Status Drill Pending',
      description: 'Include drill pending boxes',
      required: true,
      defaultValue: 'Y',
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    statusOutOfService: Property.StaticDropdown({
      displayName: 'Status Out of Service',
      description: 'Include out of service boxes',
      required: true,
      defaultValue: 'Y',
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    numberOfRecords: Property.Number({
      displayName: 'Number of Records',
      description: 'Maximum number of records to return (up to 999)',
      required: true,
      defaultValue: 999,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Optional: Branch number (up to 3 characters)',
      required: false,
    }),
    boxType: Property.ShortText({
      displayName: 'Box Type',
      description: 'Optional: Box type (up to 3 characters)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, statusAvailable, statusPending, statusRented, statusDrillPending, statusOutOfService, numberOfRecords, branchNumber, boxType } = context.propsValue;

    const queryParams: Record<string, string> = {
      statusAvailable: statusAvailable,
      statusPending: statusPending,
      statusRented: statusRented,
      statusDrillPending: statusDrillPending,
      statusOutOfService: statusOutOfService,
      numberOfRecords: String(numberOfRecords),
    };
    if (branchNumber) queryParams['branchNumber'] = branchNumber;
    if (boxType) queryParams['boxType'] = boxType;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/safe-deposit-box`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams,
    });

    return response.body;
  },
});

export const bank_controls_safe_deposit_box_discount_codes = createAction({
  name: 'bank_controls_safe_deposit_box_discount_codes',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Safe Deposit Box - Discount Codes',
  description: 'Retrieve a list of safe deposit box discount codes.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/safe-deposit-box/discount-codes`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// TIME DEPOSIT DOWNLOADS
// ============================================================================

export const bank_controls_time_deposits_service_charge_types_list = createAction({
  name: 'bank_controls_time_deposits_service_charge_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Service Charge Types List',
  description: 'Retrieve a list of time deposit service charge types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/service-charge-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_time_deposits_service_charge_types_detail = createAction({
  name: 'bank_controls_time_deposits_service_charge_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Service Charge Types Detail',
  description: 'Retrieve the details of time deposit service charge type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    chargeType: Property.ShortText({
      displayName: 'Charge Type',
      description: 'Valid Time Deposit Service Charge Type',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, chargeType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/service-charge-types/${chargeType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_time_deposits_product_types_list = createAction({
  name: 'bank_controls_time_deposits_product_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Product Types List',
  description: 'Retrieve a list of time deposit product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/product-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_time_deposits_product_types_detail = createAction({
  name: 'bank_controls_time_deposits_product_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Product Types Detail',
  description: 'Retrieve the details of time deposit product type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Time deposit product type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/product-types/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_time_deposits_penalty_types_list = createAction({
  name: 'bank_controls_time_deposits_penalty_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Penalty Types List',
  description: 'Retrieve a list of time deposit penalty types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/penalty-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_time_deposits_penalty_types_detail = createAction({
  name: 'bank_controls_time_deposits_penalty_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Penalty Types Detail',
  description: 'Retrieve the details of a time deposit penalty type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    penaltyType: Property.ShortText({
      displayName: 'Penalty Type',
      description: 'Time deposit penalty type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, penaltyType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/penalty-types/${penaltyType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_time_deposits_interest_types_list = createAction({
  name: 'bank_controls_time_deposits_interest_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Interest Types List',
  description: 'Retrieve a list of time deposit interest types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/interest-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_time_deposits_interest_types_detail = createAction({
  name: 'bank_controls_time_deposits_interest_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Time Deposits - Interest Types Detail',
  description: 'Retrieve the details of time deposit interest type given a rate type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    rateType: Property.ShortText({
      displayName: 'Rate Type',
      description: 'Time deposit rate type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, rateType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/time-deposits/interest-types/${rateType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// CARD DOWNLOADS
// ============================================================================

export const bank_controls_cards_product_types_list = createAction({
  name: 'bank_controls_cards_product_types_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Cards - Product Types List',
  description: 'Retrieve a list of card product types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/cards/product-types`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_cards_product_types_detail = createAction({
  name: 'bank_controls_cards_product_types_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Cards - Product Types Detail',
  description: 'Retrieve the details for a given card product type.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Card product type (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, productType } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/cards/product-types/${productType}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// MISCELLANEOUS DOWNLOADS
// ============================================================================

export const bank_controls_dynamic_transfer_controls = createAction({
  name: 'bank_controls_dynamic_transfer_controls',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Miscellaneous - Dynamic Transfer Controls',
  description: 'Retrieve dynamic transfers controls and options.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/dynamic-transfer-controls`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_global_index_rates_list = createAction({
  name: 'bank_controls_global_index_rates_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Global Controls - Index Rates List',
  description: 'Retrieve a list of global index rates.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/global-index-rates`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_global_index_rates_detail = createAction({
  name: 'bank_controls_global_index_rates_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Global Controls - Index Rates Detail',
  description: 'Retrieve the details for a global index rate.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    globalIndex: Property.ShortText({
      displayName: 'Global Index',
      description: 'Global index (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, globalIndex } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/global-index-rates/${globalIndex}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_global_rate_tiers_list = createAction({
  name: 'bank_controls_global_rate_tiers_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Global Controls - Rate Tiers List',
  description: 'Retrieve a list of global rate tiers.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/global-rate-tiers`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_global_rate_tiers_detail = createAction({
  name: 'bank_controls_global_rate_tiers_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Global Controls - Rate Tiers Detail',
  description: 'Retrieve the details of a global rate tier.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    globalTier: Property.ShortText({
      displayName: 'Global Tier',
      description: 'Global tier (up to 3 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, globalTier } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/global-rate-tiers/${globalTier}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_user_defined_field_descriptions = createAction({
  name: 'bank_controls_user_defined_field_descriptions',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Miscellaneous - User Defined Field Descriptions',
  description: 'Retrieve a list of user defined field descriptions.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code',
      required: true,
      options: {
        options: [
          { label: 'Demand Deposit', value: 'DD' },
          { label: 'Certificate of Deposit', value: 'CD' },
          { label: 'Collections', value: 'CO' },
          { label: 'Collateral Tracking', value: 'CT' },
          { label: 'Individual Retirement', value: 'IR' },
          { label: 'Loan System', value: 'LN' },
          { label: 'Mortgage Loans', value: 'ML' },
          { label: 'Relationship Management', value: 'RM' },
          { label: 'Savings', value: 'SV' },
          { label: 'Dealer', value: 'DL' },
        ],
      },
    }),
    fromField: Property.Number({
      displayName: 'From Field',
      description: 'Optional: Starting field number (1-9999)',
      required: false,
    }),
    toField: Property.Number({
      displayName: 'To Field',
      description: 'Optional: Ending field number (1-9999)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, applicationCode, fromField, toField } = context.propsValue;

    const queryParams: Record<string, string> = {};
    if (fromField) queryParams['fromField'] = String(fromField);
    if (toField) queryParams['toField'] = String(toField);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/accounts/${applicationCode}/user-defined-field-descriptions`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams,
    });

    return response.body;
  },
});

// ============================================================================
// RATES AND TIERS
// ============================================================================

export const bank_controls_central_lookup_records = createAction({
  name: 'bank_controls_central_lookup_records',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Rates and Tiers - Central Lookup Records',
  description: 'Retrieve a detailed list of central lookup records.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'Central Lookup Application Code (blank is valid when codeType is RMINTYPE)',
      required: true,
    }),
    codeType: Property.ShortText({
      displayName: 'Code Type',
      description: 'Central Lookup Code Type (e.g., PTYP, RMINTYPE)',
      required: true,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First or Next request flag',
      required: true,
      defaultValue: 'F',
      options: {
        options: [
          { label: 'First Request', value: 'F' },
          { label: 'Next Request', value: 'N' },
        ],
      },
    }),
    returnNumber: Property.Number({
      displayName: 'Return Number',
      description: 'Number of records to return (1-999)',
      required: true,
      defaultValue: 999,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, applicationCode, codeType, firstNext, returnNumber } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/central-lookup-records`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams: {
        applicationCode: applicationCode,
        codeType: codeType,
        firstNext: firstNext,
        returnNumber: String(returnNumber),
      },
    });

    return response.body;
  },
});

export const bank_controls_global_interest_rates = createAction({
  name: 'bank_controls_global_interest_rates',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Rates and Tiers - Global Interest Rates',
  description: 'Retrieve the interest rate for a given index or tier.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code',
      required: true,
      options: {
        options: [
          { label: 'Demand Deposit', value: 'DD' },
          { label: 'Loan System', value: 'LN' },
          { label: 'Savings', value: 'SV' },
        ],
      },
    }),
    globalIndex: Property.ShortText({
      displayName: 'Global Index',
      description: 'Conditional: Either globalIndex or globalTier must be provided',
      required: false,
    }),
    globalTier: Property.ShortText({
      displayName: 'Global Tier',
      description: 'Conditional: Either globalIndex or globalTier must be provided',
      required: false,
    }),
    interestType: Property.Number({
      displayName: 'Interest Type',
      description: 'For DD and SV: Either interestType or tierMethod must be provided',
      required: false,
    }),
    tierMethod: Property.StaticDropdown({
      displayName: 'Tier Method',
      description: 'For DD and SV: Either interestType or tierMethod must be provided. Required for Loans.',
      required: false,
      options: {
        options: [
          { label: 'Split Balance', value: 'S' },
          { label: 'Whole Balance', value: 'W' },
        ],
      },
    }),
    balance: Property.Number({
      displayName: 'Balance',
      description: 'Optional: Balance for tier lookup',
      required: false,
    }),
    effectiveDate: Property.Number({
      displayName: 'Effective Date',
      description: 'Optional: Effective date in CCYYMMDD format',
      required: false,
    }),
    backDateRequest: Property.StaticDropdown({
      displayName: 'Back Date Request',
      description: 'Optional: For Loans and Global Tiers only',
      required: false,
      options: {
        options: [
          { label: 'No Back Date Request', value: '' },
          { label: 'Return Back Date for Tier', value: 'B' },
          { label: 'Return Next Effective Date', value: 'N' },
        ],
      },
    }),
    varianceAdjustment: Property.Number({
      displayName: 'Variance Adjustment',
      description: 'Optional: Amount to adjust the returned rate',
      required: false,
    }),
    varianceAdjustmentType: Property.StaticDropdown({
      displayName: 'Variance Adjustment Type',
      description: 'Optional: Add or Subtract the variance adjustment',
      required: false,
      options: {
        options: [
          { label: 'Add', value: 'A' },
          { label: 'Subtract', value: 'S' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, applicationCode, globalIndex, globalTier, interestType, tierMethod, balance, effectiveDate, backDateRequest, varianceAdjustment, varianceAdjustmentType } = context.propsValue;

    const queryParams: Record<string, string> = {};
    if (globalIndex) queryParams['globalIndex'] = globalIndex;
    if (globalTier) queryParams['globalTier'] = globalTier;
    if (interestType !== undefined && interestType !== null) queryParams['interestType'] = String(interestType);
    if (tierMethod) queryParams['tierMethod'] = tierMethod;
    if (balance !== undefined && balance !== null) queryParams['balance'] = String(balance);
    if (effectiveDate) queryParams['effectiveDate'] = String(effectiveDate);
    if (backDateRequest) queryParams['backDateRequest'] = backDateRequest;
    if (varianceAdjustment !== undefined && varianceAdjustment !== null) queryParams['varianceAdjustment'] = String(varianceAdjustment);
    if (varianceAdjustmentType) queryParams['varianceAdjustmentType'] = varianceAdjustmentType;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/global-interest-rates/${applicationCode}`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams,
    });

    return response.body;
  },
});

// ============================================================================
// AGGREGATE ACCOUNT DOWNLOADS
// ============================================================================

export const bank_controls_aggregation_descriptions_detail = createAction({
  name: 'bank_controls_aggregation_descriptions_detail',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Aggregate Accounts - Descriptions Detail',
  description: 'Retrieve the details for an aggregate application description fields.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'External Application Code (up to 2 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, applicationCode } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/accounts/${applicationCode}/aggregation-descriptions`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

export const bank_controls_aggregation_descriptions_list = createAction({
  name: 'bank_controls_aggregation_descriptions_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Aggregate Accounts - Descriptions List',
  description: 'Retrieve a list of aggregate applications.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
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
    const { xAuthorization, sourceId } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/accounts/aggregation-descriptions`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// ACCOUNT NUMBER GENERATION
// ============================================================================

export const bank_controls_account_number_generation = createAction({
  name: 'bank_controls_account_number_generation',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Account - Number Generation',
  description: 'Retrieve an automatically generated account number.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code',
      required: true,
      options: {
        options: [
          { label: 'Demand Deposit', value: 'DD' },
          { label: 'Certificate of Deposit', value: 'CD' },
          { label: 'Individual Retirement', value: 'IR' },
          { label: 'Loan System', value: 'LN' },
          { label: 'Mortgage Loans', value: 'ML' },
          { label: 'Savings', value: 'SV' },
        ],
      },
    }),
    branch: Property.Number({
      displayName: 'Branch',
      description: 'Branch Number (up to 4 numeric digits)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, applicationCode, branch } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/accounts/${applicationCode}/${branch}/account-number`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
    });

    return response.body;
  },
});

// ============================================================================
// COLLATERAL DOWNLOADS
// ============================================================================

export const bank_controls_collateral_type_list = createAction({
  name: 'bank_controls_collateral_type_list',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Collateral - Type List',
  description: 'Retrieve a list of collateral types.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First or Next request flag',
      required: true,
      defaultValue: 'F',
      options: {
        options: [
          { label: 'First Request', value: 'F' },
          { label: 'Next Request', value: 'N' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, firstNext } = context.propsValue;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/collateral-type`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams: {
        firstNext: firstNext,
      },
    });

    return response.body;
  },
});

// ============================================================================
// APY CALCULATION
// ============================================================================

export const bank_controls_apy_calculation = createAction({
  name: 'bank_controls_apy_calculation',
  auth: fisHorizonAuth,
  displayName: 'Bank Controls - Rates and Tiers - APY Calculation',
  description: 'Retrieve the calculated APY (Annual Percentage Yield) of an interest bearing account.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'JWT token for authorization',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code',
      required: true,
      options: {
        options: [
          { label: 'Demand Deposit', value: 'DD' },
          { label: 'Certificate of Deposit', value: 'CD' },
          { label: 'Individual Retirement', value: 'IR' },
          { label: 'Savings', value: 'SV' },
        ],
      },
    }),
    productCode: Property.ShortText({
      displayName: 'Product Code',
      description: 'Product type (up to 10 characters)',
      required: true,
    }),
    branch: Property.Number({
      displayName: 'Branch',
      description: 'Branch Number (up to 4 numeric digits)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Optional: Account number (right justified, padded with zeros)',
      required: false,
    }),
    calledFrom: Property.StaticDropdown({
      displayName: 'Called From',
      description: 'Optional: Specifies the call type',
      required: false,
      options: {
        options: [
          { label: 'Account Level', value: 'A' },
          { label: 'Product Type Level', value: 'P' },
          { label: 'Single APY Account Level (CD/IR only)', value: 'S' },
        ],
      },
    }),
    compoundingFrequency: Property.StaticDropdown({
      displayName: 'Compounding Frequency',
      description: 'Optional: Compounding frequency',
      required: false,
      options: {
        options: [
          { label: 'Simple', value: 'S' },
          { label: 'Daily', value: 'D' },
          { label: 'Monthly', value: 'M' },
        ],
      },
    }),
    effectiveDate: Property.Number({
      displayName: 'Effective Date',
      description: 'Optional: Effective date in CCYYMMDD format',
      required: false,
    }),
    flatRate: Property.Number({
      displayName: 'Flat Rate',
      description: 'Optional: Flat rate value for APY calculation',
      required: false,
    }),
    interestTerm: Property.Number({
      displayName: 'Interest Term',
      description: 'Optional: Interest term',
      required: false,
    }),
    interestType: Property.ShortText({
      displayName: 'Interest Type',
      description: 'Optional: Interest type',
      required: false,
    }),
    maturityTerm: Property.Number({
      displayName: 'Maturity Term',
      description: 'Optional: Maturity term',
      required: false,
    }),
    maturityType: Property.ShortText({
      displayName: 'Maturity Type',
      description: 'Optional: Maturity type',
      required: false,
    }),
    promotionalCode: Property.ShortText({
      displayName: 'Promotional Code',
      description: 'Optional: Promotional code (DD/SV only)',
      required: false,
    }),
    rateIndex: Property.ShortText({
      displayName: 'Rate Index',
      description: 'Optional: Rate index',
      required: false,
    }),
    rateTier: Property.ShortText({
      displayName: 'Rate Tier',
      description: 'Optional: Rate tier',
      required: false,
    }),
    region: Property.ShortText({
      displayName: 'Region',
      description: 'Optional: Region for regional rates',
      required: false,
    }),
    statementCycleCode: Property.ShortText({
      displayName: 'Statement Cycle Code',
      description: 'Optional: Statement cycle code (DD/SV only)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const { xAuthorization, sourceId, applicationCode, productCode, branch, accountNumber, calledFrom, compoundingFrequency, effectiveDate, flatRate, interestTerm, interestType, maturityTerm, maturityType, promotionalCode, rateIndex, rateTier, region, statementCycleCode } = context.propsValue;

    const queryParams: Record<string, string> = {
      branch: String(branch),
    };
    if (accountNumber) queryParams['accountNumber'] = accountNumber;
    if (calledFrom) queryParams['calledFrom'] = calledFrom;
    if (compoundingFrequency) queryParams['compoundingFrequency'] = compoundingFrequency;
    if (effectiveDate) queryParams['effectiveDate'] = String(effectiveDate);
    if (flatRate !== undefined && flatRate !== null) queryParams['flatRate'] = String(flatRate);
    if (interestTerm !== undefined && interestTerm !== null) queryParams['interestTerm'] = String(interestTerm);
    if (interestType) queryParams['interestType'] = interestType;
    if (maturityTerm !== undefined && maturityTerm !== null) queryParams['maturityTerm'] = String(maturityTerm);
    if (maturityType) queryParams['maturityType'] = maturityType;
    if (promotionalCode) queryParams['promotionalCode'] = promotionalCode;
    if (rateIndex) queryParams['rateIndex'] = rateIndex;
    if (rateTier) queryParams['rateTier'] = rateTier;
    if (region) queryParams['region'] = region;
    if (statementCycleCode) queryParams['statementCycleCode'] = statementCycleCode;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/bank-controls/v1/accounts/${applicationCode}/${productCode}/apy-calculation`,
      headers: buildHeaders(auth, xAuthorization, sourceId),
      queryParams,
    });

    return response.body;
  },
});
