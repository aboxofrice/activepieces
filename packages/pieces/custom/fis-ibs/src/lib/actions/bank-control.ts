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
// IBS-Bank-Control.json - Bank Control Functions
// ============================================

export const bank_control_get_branch_detail = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_branch_detail',
  displayName: 'Bank Control - Get Branch Detail',
  description: 'Retrieve detail information about specified branch (Segment 105)',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch number to retrieve details for',
      required: true,
    }),
    effectiveDate: Property.ShortText({
      displayName: 'Effective Date',
      description: 'Effective date (MM/DD/YY) - optional, used to view past/future segments',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.effectiveDate) {
      params.append('effDte', context.propsValue.effectiveDate);
    }

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSBC/v4/branches/${context.propsValue.branchNumber}/detail${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_branch_info = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_branch_info',
  displayName: 'Bank Control - Get Branch Info',
  description: 'Retrieve basic information about specified branch',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    branchNumber: Property.Number({
      displayName: 'Branch Number',
      description: 'Branch number to retrieve information for',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSBC/v4/branches/${context.propsValue.branchNumber}`,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_processing_date = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_processing_date',
  displayName: 'Bank Control - Get Processing Date',
  description: 'Retrieve current processing date information for the bank',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSBC/v4/processing-date`,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_holiday_calendar = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_holiday_calendar',
  displayName: 'Bank Control - Get Holiday Calendar',
  description: 'Retrieve bank holiday calendar information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    year: Property.Number({
      displayName: 'Year',
      description: 'Year to retrieve holidays for (optional)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.year) {
      params.append('year', context.propsValue.year.toString());
    }

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSBC/v4/holiday-calendar${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_gl_account = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_gl_account',
  displayName: 'Bank Control - Get GL Account',
  description: 'Retrieve general ledger account information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    glAccountNumber: Property.ShortText({
      displayName: 'GL Account Number',
      description: 'General ledger account number',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSBC/v4/gl-accounts/${context.propsValue.glAccountNumber}`,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_institution_info = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_institution_info',
  displayName: 'Bank Control - Get Institution Info',
  description: 'Retrieve institution information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    institutionNumber: Property.Number({
      displayName: 'Institution Number',
      description: 'Institution number (optional - defaults to current institution)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.institutionNumber) {
      params.append('instNbr', context.propsValue.institutionNumber.toString());
    }

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSBC/v4/institution${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_officer = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_officer',
  displayName: 'Bank Control - Get Officer',
  description: 'Retrieve officer information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    officerId: Property.ShortText({
      displayName: 'Officer ID',
      description: 'Officer identifier',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSBC/v4/officers/${context.propsValue.officerId}`,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_product_codes = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_product_codes',
  displayName: 'Bank Control - Get Product Codes',
  description: 'Retrieve product codes and their descriptions',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    productType: Property.StaticDropdown({
      displayName: 'Product Type',
      description: 'Type of product to retrieve codes for',
      required: false,
      options: {
        options: [
          { label: 'Deposit', value: 'D' },
          { label: 'Loan', value: 'L' },
          { label: 'Card', value: 'C' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.productType) {
      params.append('prodType', context.propsValue.productType);
    }

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSBC/v4/product-codes${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_transaction_codes = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_transaction_codes',
  displayName: 'Bank Control - Get Transaction Codes',
  description: 'Retrieve transaction codes and their descriptions',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    transactionType: Property.StaticDropdown({
      displayName: 'Transaction Type',
      description: 'Type of transaction codes to retrieve',
      required: false,
      options: {
        options: [
          { label: 'Deposit', value: 'D' },
          { label: 'Loan', value: 'L' },
          { label: 'Card', value: 'C' },
          { label: 'GL', value: 'G' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.transactionType) {
      params.append('tranType', context.propsValue.transactionType);
    }

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSBC/v4/transaction-codes${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});

export const bank_control_get_routing_number = createAction({
  auth: fisIbsAuth,
  name: 'bank_control_get_routing_number',
  displayName: 'Bank Control - Get Routing Number',
  description: 'Retrieve routing number information',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    routingNumber: Property.ShortText({
      displayName: 'Routing Number',
      description: 'ABA routing number to look up',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSBC/v4/routing-numbers/${context.propsValue.routingNumber}`,
      headers,
    });
    return response.body;
  },
});
