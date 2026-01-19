import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

const MORTGAGE_LOAN_BASE_PATH = '/mortgage-loan/v1';

// ============================================================================
// POST Add MERS Information
// ============================================================================
export const mortgage_loan_add_mers_information = createAction({
  name: 'mortgage_loan_add_mers_information',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add MERS Information',
  description: 'Add MERS (Mortgage Electronic Registry System) information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The MERS information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/mers-information`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Prepaid Insurance Information
// ============================================================================
export const mortgage_loan_add_prepaid_insurance = createAction({
  name: 'mortgage_loan_add_prepaid_insurance',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Prepaid Insurance',
  description: 'Add prepaid insurance information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The prepaid insurance information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/prepaid-insurance`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Additional Loan Master 50-01
// ============================================================================
export const mortgage_loan_add_loan_master_5001 = createAction({
  name: 'mortgage_loan_add_loan_master_5001',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Loan Master 50-01',
  description: 'Add a new additional loan master 50-01 for mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The loan master 50-01 request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/additional-loan-master-5001`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Additional Loan Master 50-02
// ============================================================================
export const mortgage_loan_add_loan_master_5002 = createAction({
  name: 'mortgage_loan_add_loan_master_5002',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Loan Master 50-02',
  description: 'Add a new additional loan master 50-02 for mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The loan master 50-02 request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/additional-loan-master-5002`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add ARM Information
// ============================================================================
export const mortgage_loan_add_arm_information = createAction({
  name: 'mortgage_loan_add_arm_information',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add ARM Information',
  description: 'Add ARM (Adjustable Rate Mortgage) information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The ARM information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/arm`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Additional Loan Master 55-01
// ============================================================================
export const mortgage_loan_add_loan_master_5501 = createAction({
  name: 'mortgage_loan_add_loan_master_5501',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Loan Master 55-01',
  description: 'Add a new additional loan master 55-01 for mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The loan master 55-01 request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/additional-loan-master-5501`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add FHLB Information
// ============================================================================
export const mortgage_loan_add_fhlb_information = createAction({
  name: 'mortgage_loan_add_fhlb_information',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add FHLB Information',
  description: 'Add FHLB (Federal Home Loan Bank) information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The FHLB information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/fhlb-information`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Buydown Schedule
// ============================================================================
export const mortgage_loan_add_buydown_schedule = createAction({
  name: 'mortgage_loan_add_buydown_schedule',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Buydown Schedule',
  description: 'Add a buydown schedule for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The buydown schedule request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/buydown-schedules`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add HECM Disbursements Information
// ============================================================================
export const mortgage_loan_add_hecm_disbursements = createAction({
  name: 'mortgage_loan_add_hecm_disbursements',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add HECM Disbursements',
  description: 'Add HECM (Home Equity Conversion Mortgage) disbursements information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The HECM disbursements information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/hecm-disbursements-information`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Additional Loan Master 55-02
// ============================================================================
export const mortgage_loan_add_loan_master_5502 = createAction({
  name: 'mortgage_loan_add_loan_master_5502',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Loan Master 55-02',
  description: 'Add a new additional loan master 55-02 for mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The loan master 55-02 request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/additional-loan-master-5502`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Additional Loan Master 55-03
// ============================================================================
export const mortgage_loan_add_loan_master_5503 = createAction({
  name: 'mortgage_loan_add_loan_master_5503',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Loan Master 55-03',
  description: 'Add a new additional loan master 55-03 for mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The loan master 55-03 request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/additional-loan-master-5503`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add New Loan Master
// ============================================================================
export const mortgage_loan_add_loan_master = createAction({
  name: 'mortgage_loan_add_loan_master',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Loan Master',
  description: 'Add the loan master for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The loan master request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Prepaid Taxes
// ============================================================================
export const mortgage_loan_add_prepaid_taxes = createAction({
  name: 'mortgage_loan_add_prepaid_taxes',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Prepaid Taxes',
  description: 'Add prepaid taxes information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The prepaid taxes request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/prepaid-taxes`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Deferred Fees
// ============================================================================
export const mortgage_loan_add_deferred_fees = createAction({
  name: 'mortgage_loan_add_deferred_fees',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Deferred Fees',
  description: 'Add deferred fees for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The deferred fees request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/deferred-fees`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Disbursements
// ============================================================================
export const mortgage_loan_add_disbursements = createAction({
  name: 'mortgage_loan_add_disbursements',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Disbursements',
  description: 'Add disbursements information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The disbursements request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/disbursements`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Closing Fees
// ============================================================================
export const mortgage_loan_add_closing_fees = createAction({
  name: 'mortgage_loan_add_closing_fees',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Closing Fees',
  description: 'Add closing fees for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The closing fees request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/closing-fees`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add HECM Information
// ============================================================================
export const mortgage_loan_add_hecm_information = createAction({
  name: 'mortgage_loan_add_hecm_information',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add HECM Information',
  description: 'Add HECM (Home Equity Conversion Mortgage) information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The HECM information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/hecm-information`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Insurance Information
// ============================================================================
export const mortgage_loan_add_insurance = createAction({
  name: 'mortgage_loan_add_insurance',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Insurance',
  description: 'Add insurance information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The insurance information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/insurance`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Taxes Information
// ============================================================================
export const mortgage_loan_add_taxes = createAction({
  name: 'mortgage_loan_add_taxes',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add Taxes',
  description: 'Add taxes information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The taxes information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/taxes`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add FHA VA Information
// ============================================================================
export const mortgage_loan_add_fha_va_information = createAction({
  name: 'mortgage_loan_add_fha_va_information',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Add FHA VA Information',
  description: 'Add FHA (Federal Housing Administration) VA (Veterans Affairs) information for new mortgage loan accounts.',
  props: {
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    requestBody: Property.Json({
      displayName: 'Request Body',
      description: 'The FHA VA information request body as JSON object.',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { horizonAuthorization, sourceId, requestBody } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/mortgage-loans/fha-va-information`,
      headers,
      body: requestBody,
    });

    return response.body;
  },
});

// ============================================================================
// GET Account Inquiry
// ============================================================================
export const mortgage_loan_account_inquiry = createAction({
  name: 'mortgage_loan_account_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Account Inquiry',
  description: 'Retrieve basic information relating to a mortgage loan account.',
  props: {
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application Code. Valid Value: ML = Mortgage Loan',
      required: true,
      options: {
        options: [
          { label: 'Mortgage Loan (ML)', value: 'ML' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number.',
      required: true,
    }),
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Optional: Specifies the unique identifier associated with a customer. Right-justified, zero filled. Up to 14 digits.',
      required: false,
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Optional: Return data in uppercase.',
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
    const {
      applicationCode,
      accountNumber,
      horizonAuthorization,
      sourceId,
      customerId,
      returnUppercase,
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: string[] = [];
    if (customerId !== undefined && customerId !== null && customerId !== '') {
      queryParams.push(`customerId=${encodeURIComponent(customerId)}`);
    }
    if (returnUppercase !== undefined && returnUppercase !== null && returnUppercase !== '') {
      queryParams.push(`returnUppercase=${encodeURIComponent(returnUppercase)}`);
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/${applicationCode}/${accountNumber}${queryString}`,
      headers,
    });

    return response.body;
  },
});

// ============================================================================
// GET Transaction Inquiry
// ============================================================================
export const mortgage_loan_transaction_inquiry = createAction({
  name: 'mortgage_loan_transaction_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Mortgage Loan - Transaction Inquiry',
  description: 'Retrieve a list of historic transactions relating to a mortgage loan account.',
  props: {
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application Code. Valid Value: ML = Mortgage Loan',
      required: true,
      options: {
        options: [
          { label: 'Mortgage Loan (ML)', value: 'ML' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number.',
      required: true,
    }),
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    dateSelectOption: Property.StaticDropdown({
      displayName: 'Date Select Option',
      description: 'Optional: Date selection option.',
      required: false,
      options: {
        options: [
          { label: 'Posting Date (P)', value: 'P' },
          { label: 'Effective Date (E)', value: 'E' },
        ],
      },
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'Optional: First or next indicator for pagination.',
      required: false,
      options: {
        options: [
          { label: 'First (F)', value: 'F' },
          { label: 'Next (N)', value: 'N' },
        ],
      },
    }),
    numberToReturn: Property.Number({
      displayName: 'Number to Return',
      description: 'Optional: Number of records to return.',
      required: false,
    }),
    beginDate: Property.Number({
      displayName: 'Begin Date',
      description: 'Optional: Begin date in CCYYMMDD format (e.g., 20230101).',
      required: false,
    }),
    endDate: Property.Number({
      displayName: 'End Date',
      description: 'Optional: End date in CCYYMMDD format (e.g., 20231231).',
      required: false,
    }),
    returnMemoPostTransaction: Property.StaticDropdown({
      displayName: 'Return Memo Post Transaction',
      description: 'Optional: Return memo post transactions.',
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
      description: 'Optional: Return package post items.',
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
      description: 'Optional: Return scheduled external transfers.',
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
      description: 'Optional: Sequence option for sorting results.',
      required: false,
      options: {
        options: [
          { label: 'Ascending (A)', value: 'A' },
          { label: 'Descending (D)', value: 'D' },
        ],
      },
    }),
    searchToken: Property.ShortText({
      displayName: 'Search Token',
      description: 'Optional: Search token for stateless middleware processing.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const {
      applicationCode,
      accountNumber,
      horizonAuthorization,
      sourceId,
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
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: string[] = [];
    if (dateSelectOption !== undefined && dateSelectOption !== null && dateSelectOption !== '') {
      queryParams.push(`dateSelectOption=${encodeURIComponent(dateSelectOption)}`);
    }
    if (firstNext !== undefined && firstNext !== null && firstNext !== '') {
      queryParams.push(`firstNext=${encodeURIComponent(firstNext)}`);
    }
    if (numberToReturn !== undefined && numberToReturn !== null) {
      queryParams.push(`numberToReturn=${encodeURIComponent(numberToReturn.toString())}`);
    }
    if (beginDate !== undefined && beginDate !== null) {
      queryParams.push(`beginDate=${encodeURIComponent(beginDate.toString())}`);
    }
    if (endDate !== undefined && endDate !== null) {
      queryParams.push(`endDate=${encodeURIComponent(endDate.toString())}`);
    }
    if (returnMemoPostTransaction !== undefined && returnMemoPostTransaction !== null && returnMemoPostTransaction !== '') {
      queryParams.push(`returnMemoPostTransaction=${encodeURIComponent(returnMemoPostTransaction)}`);
    }
    if (returnPackagePostItems !== undefined && returnPackagePostItems !== null && returnPackagePostItems !== '') {
      queryParams.push(`returnPackagePostItems=${encodeURIComponent(returnPackagePostItems)}`);
    }
    if (returnScheduledExternalTransfers !== undefined && returnScheduledExternalTransfers !== null && returnScheduledExternalTransfers !== '') {
      queryParams.push(`returnScheduledExternalTransfers=${encodeURIComponent(returnScheduledExternalTransfers)}`);
    }
    if (sequenceOption !== undefined && sequenceOption !== null && sequenceOption !== '') {
      queryParams.push(`sequenceOption=${encodeURIComponent(sequenceOption)}`);
    }
    if (searchToken !== undefined && searchToken !== null && searchToken !== '') {
      queryParams.push(`searchToken=${encodeURIComponent(searchToken)}`);
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}${MORTGAGE_LOAN_BASE_PATH}/accounts/${applicationCode}/${accountNumber}/transactions${queryString}`,
      headers,
    });

    return response.body;
  },
});
