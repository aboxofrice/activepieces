import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// Helper function to create common headers
function createHeaders(
  organizationId: string,
  xAuthorization: string,
  sourceId?: string
): Record<string, string> {
  const uuid = crypto.randomUUID();
  const headers: Record<string, string> = {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'organization-id': organizationId,
    'uuid': uuid,
    'x-authorization': xAuthorization,
  };

  if (sourceId) {
    headers['source-id'] = sourceId;
  }

  return headers;
}

// ==================== CUSTOMER CREATE ====================

export const customer_create = createAction({
  name: 'customer_create',
  auth: fisHorizonAuth,
  displayName: 'Customer - Create',
  description: 'Creates a new customer record in the Relationship Management database.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerData: Property.Json({
      displayName: 'Customer Data',
      description: 'JSON object containing customer information to create',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers`,
      headers,
      body: customerData,
    });

    return response.body;
  },
});

// ==================== PORTFOLIO INQUIRY ====================

export const customer_portfolio_inquiry = createAction({
  name: 'customer_portfolio_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Portfolio - Inquiry',
  description: 'Retrieve a list of customer portfolio details based on tax ID number or customer key.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    taxId: Property.ShortText({
      displayName: 'Tax ID',
      description: 'Tax Identification Number',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: false,
    }),
    tinAggregation: Property.StaticDropdown({
      displayName: 'TIN Aggregation',
      description: 'Whether to aggregate by TIN',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    interfaceFlag: Property.StaticDropdown({
      displayName: 'Interface Flag',
      description: 'Interface flag for the request',
      required: false,
      options: {
        options: [
          { label: 'IN - Internal', value: 'IN' },
          { label: 'EX - External', value: 'EX' },
        ],
      },
    }),
    ownershipType: Property.StaticDropdown({
      displayName: 'Ownership Type',
      description: 'The ownership type to filter by',
      required: false,
      options: {
        options: [
          { label: 'D - Direct', value: 'D' },
          { label: 'I - Indirect', value: 'I' },
          { label: 'S - Signer', value: 'S' },
        ],
      },
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Return data in uppercase',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    viewUndisplayedRelationships: Property.StaticDropdown({
      displayName: 'View Undisplayed Relationships',
      description: 'Whether to include undisplayed relationships',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    searchDirection: Property.StaticDropdown({
      displayName: 'Search Direction',
      description: 'Direction for searching',
      required: false,
      options: {
        options: [
          { label: 'B - Both', value: 'B' },
          { label: 'F - Forward', value: 'F' },
          { label: 'R - Reverse', value: 'R' },
        ],
      },
    }),
    numberOfAccountsToReturn: Property.Number({
      displayName: 'Number of Accounts to Return',
      description: 'Maximum number of accounts to return',
      required: false,
      defaultValue: 10,
    }),
    numberOfPhoneNumbersToReturn: Property.Number({
      displayName: 'Number of Phone Numbers to Return',
      description: 'Maximum number of phone numbers to return',
      required: false,
      defaultValue: 10,
    }),
    numberOfEmailAddressesToReturn: Property.Number({
      displayName: 'Number of Email Addresses to Return',
      description: 'Maximum number of email addresses to return',
      required: false,
      defaultValue: 10,
    }),
    returnCustomerInformation: Property.Checkbox({
      displayName: 'Return Customer Information',
      description: 'Whether to return customer information',
      required: false,
      defaultValue: true,
    }),
    includeReadyReserveOD: Property.Checkbox({
      displayName: 'Include Ready Reserve Overdraft',
      description: 'Whether to include ready reserve overdraft',
      required: false,
      defaultValue: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization,
      taxId,
      customerId,
      tinAggregation,
      interfaceFlag,
      ownershipType,
      returnUppercase,
      viewUndisplayedRelationships,
      searchDirection,
      numberOfAccountsToReturn,
      numberOfPhoneNumbersToReturn,
      numberOfEmailAddressesToReturn,
      returnCustomerInformation,
      includeReadyReserveOD,
      sourceId,
    } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const body: Record<string, unknown> = {};

    if (taxId) body['taxId'] = taxId;
    if (customerId) body['customerId'] = customerId;
    if (tinAggregation) body['tinAggregation'] = tinAggregation;
    if (interfaceFlag) body['interfaceFlag'] = interfaceFlag;
    if (ownershipType) body['ownershipType'] = ownershipType;
    if (returnUppercase) body['returnUppercase'] = returnUppercase;
    if (viewUndisplayedRelationships) body['viewUndisplayedRelationships'] = viewUndisplayedRelationships;
    if (searchDirection) body['searchDirection'] = searchDirection;
    if (numberOfAccountsToReturn) body['numberOfAccountsToReturn'] = numberOfAccountsToReturn;
    if (numberOfPhoneNumbersToReturn) body['numberOfPhoneNumbersToReturn'] = numberOfPhoneNumbersToReturn;
    if (numberOfEmailAddressesToReturn) body['numberOfEmailAddressesToReturn'] = numberOfEmailAddressesToReturn;
    if (returnCustomerInformation !== undefined) body['returnCustomerInformation'] = returnCustomerInformation;
    if (includeReadyReserveOD !== undefined) body['includeReadyReserveOD'] = includeReadyReserveOD;

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/portfolio-inquiry`,
      headers,
      body,
    });

    return response.body;
  },
});

// ==================== RELATIONSHIP SUMMARY ====================

export const customer_relationship_summary_search = createAction({
  name: 'customer_relationship_summary_search',
  auth: fisHorizonAuth,
  displayName: 'Customer - Relationship Summary - Search',
  description: 'Retrieve a list of accounts for a specific customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    interfaceFlag: Property.StaticDropdown({
      displayName: 'Interface Flag',
      description: 'Interface flag for the request',
      required: false,
      options: {
        options: [
          { label: 'IN - Internal', value: 'IN' },
          { label: 'EX - External', value: 'EX' },
        ],
      },
    }),
    ownershipType: Property.StaticDropdown({
      displayName: 'Ownership Type',
      description: 'The ownership type to filter by',
      required: false,
      options: {
        options: [
          { label: 'D - Direct', value: 'D' },
          { label: 'I - Indirect', value: 'I' },
          { label: 'S - Signer', value: 'S' },
        ],
      },
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Return data in uppercase',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    viewUndisplayedRelationships: Property.StaticDropdown({
      displayName: 'View Undisplayed Relationships',
      description: 'Whether to include undisplayed relationships',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    searchDirection: Property.StaticDropdown({
      displayName: 'Search Direction',
      description: 'Direction for searching',
      required: false,
      options: {
        options: [
          { label: 'B - Both', value: 'B' },
          { label: 'F - Forward', value: 'F' },
          { label: 'R - Reverse', value: 'R' },
        ],
      },
    }),
    searchFromApplication: Property.ShortText({
      displayName: 'Search From Application',
      description: 'Application code to search from (e.g., LN, DD)',
      required: false,
    }),
    searchFromAccountNumber: Property.ShortText({
      displayName: 'Search From Account Number',
      description: 'Account number to search from',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization,
      customerId,
      interfaceFlag,
      ownershipType,
      returnUppercase,
      viewUndisplayedRelationships,
      searchDirection,
      searchFromApplication,
      searchFromAccountNumber,
      sourceId,
    } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    // Build query params
    let url = `${baseUrl}/customer/v2/customers/${customerId}/relationship-summary/search`;
    const queryParams: string[] = [];
    if (interfaceFlag) queryParams.push(`interfaceFlag=${interfaceFlag}`);
    if (ownershipType) queryParams.push(`ownershipType=${ownershipType}`);
    if (returnUppercase) queryParams.push(`returnUppercase=${returnUppercase}`);
    if (viewUndisplayedRelationships) queryParams.push(`viewUndisplayedRelationships=${viewUndisplayedRelationships}`);
    if (searchDirection) queryParams.push(`searchDirection=${searchDirection}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    const body: Record<string, unknown> = {};
    if (searchFromApplication) body['searchFromApplication'] = searchFromApplication;
    if (searchFromAccountNumber) {
      body['searchFromAccountNumber'] = {
        plainText: searchFromAccountNumber,
        cipherText: '',
        alias: '',
      };
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url,
      headers,
      body,
    });

    return response.body;
  },
});

// ==================== PHONES ====================

export const customer_phones_inquiry = createAction({
  name: 'customer_phones_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Phones - Inquiry',
  description: 'Retrieve a customer\'s phone number records.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    numberOfRecords: Property.Number({
      displayName: 'Number of Records',
      description: 'Number of records to return (1-999)',
      required: false,
      defaultValue: 999,
    }),
    phoneType: Property.ShortText({
      displayName: 'Phone Type',
      description: 'Type of phone to filter by',
      required: false,
    }),
    firstNextDefault: Property.StaticDropdown({
      displayName: 'First/Next/Default',
      description: 'Pagination control',
      required: false,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
          { label: 'D - Default', value: 'D' },
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, numberOfRecords, phoneType, firstNextDefault, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    let url = `${baseUrl}/customer/v2/customers/${customerId}/contact-info/phone-numbers`;
    const queryParams: string[] = [];
    if (numberOfRecords) queryParams.push(`numberOfRecords=${numberOfRecords}`);
    if (phoneType) queryParams.push(`phoneType=${phoneType}`);
    if (firstNextDefault) queryParams.push(`firstNextDefault=${firstNextDefault}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});

export const customer_phones_add = createAction({
  name: 'customer_phones_add',
  auth: fisHorizonAuth,
  displayName: 'Customer - Phones - Add',
  description: 'Add a phone number record for a given customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    phoneData: Property.Json({
      displayName: 'Phone Data',
      description: 'JSON object containing phone number information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, phoneData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/${customerId}/contact-info/phone-numbers`,
      headers,
      body: phoneData,
    });

    return response.body;
  },
});

export const customer_phones_update = createAction({
  name: 'customer_phones_update',
  auth: fisHorizonAuth,
  displayName: 'Customer - Phones - Update',
  description: 'Maintain a phone number record for a given customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    preferenceSequence: Property.ShortText({
      displayName: 'Preference Sequence',
      description: 'The preference sequence number of the phone record to update',
      required: true,
    }),
    phoneData: Property.Json({
      displayName: 'Phone Data',
      description: 'JSON object containing updated phone number information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, preferenceSequence, phoneData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/customer/v2/customers/${customerId}/contact-info/phone-numbers/${preferenceSequence}`,
      headers,
      body: phoneData,
    });

    return response.body;
  },
});

export const customer_phones_delete = createAction({
  name: 'customer_phones_delete',
  auth: fisHorizonAuth,
  displayName: 'Customer - Phones - Delete',
  description: 'Delete a phone number record for a given customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    preferenceSequence: Property.ShortText({
      displayName: 'Preference Sequence',
      description: 'The preference sequence number of the phone record to delete',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, preferenceSequence, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/customer/v2/customers/${customerId}/contact-info/phone-numbers/${preferenceSequence}`,
      headers,
    });

    return response.body;
  },
});

// ==================== ADDRESSES ====================

export const customer_addresses_inquiry = createAction({
  name: 'customer_addresses_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Addresses - Inquiry',
  description: 'Retrieve a list of customer address records.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    addressSequence: Property.Number({
      displayName: 'Address Sequence',
      description: 'Address sequence number to start from',
      required: false,
    }),
    maxNumberOfRecords: Property.Number({
      displayName: 'Max Number of Records',
      description: 'Maximum number of records to return',
      required: false,
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, addressSequence, maxNumberOfRecords, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    let url = `${baseUrl}/customer/v2/customers/${customerId}/contact-info/addresses`;
    const queryParams: string[] = [];
    if (addressSequence) queryParams.push(`addressSequence=${addressSequence}`);
    if (maxNumberOfRecords) queryParams.push(`maxNumberOfRecords=${maxNumberOfRecords}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});

export const customer_addresses_add = createAction({
  name: 'customer_addresses_add',
  auth: fisHorizonAuth,
  displayName: 'Customer - Addresses - Add',
  description: 'Add an address record for a given customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    addressData: Property.Json({
      displayName: 'Address Data',
      description: 'JSON object containing address information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, addressData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/${customerId}/contact-info/addresses`,
      headers,
      body: addressData,
    });

    return response.body;
  },
});

export const customer_addresses_update = createAction({
  name: 'customer_addresses_update',
  auth: fisHorizonAuth,
  displayName: 'Customer - Addresses - Update',
  description: 'Update an address record for a given customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    addressSequenceNumber: Property.ShortText({
      displayName: 'Address Sequence Number',
      description: 'The sequence number of the address to update',
      required: true,
    }),
    addressData: Property.Json({
      displayName: 'Address Data',
      description: 'JSON object containing updated address information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, addressSequenceNumber, addressData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/customer/v2/customers/${customerId}/contact-info/addresses/${addressSequenceNumber}`,
      headers,
      body: addressData,
    });

    return response.body;
  },
});

export const customer_addresses_delete = createAction({
  name: 'customer_addresses_delete',
  auth: fisHorizonAuth,
  displayName: 'Customer - Addresses - Delete',
  description: 'Delete an address record for a given customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    addressSequenceNumber: Property.ShortText({
      displayName: 'Address Sequence Number',
      description: 'The sequence number of the address to delete',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, addressSequenceNumber, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/customer/v2/customers/${customerId}/contact-info/addresses/${addressSequenceNumber}`,
      headers,
    });

    return response.body;
  },
});

// ==================== INTERNET ADDRESSES ====================

export const customer_internet_addresses_inquiry = createAction({
  name: 'customer_internet_addresses_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Internet Addresses - Inquiry',
  description: 'Retrieve a customer\'s Internet Address records.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    addressType: Property.ShortText({
      displayName: 'Address Type',
      description: 'Type of internet address to filter by',
      required: false,
    }),
    numberOfRecords: Property.Number({
      displayName: 'Number of Records',
      description: 'Number of records to return (1-999)',
      required: false,
      defaultValue: 999,
    }),
    firstNextDefault: Property.StaticDropdown({
      displayName: 'First/Next/Default',
      description: 'Pagination control',
      required: false,
      options: {
        options: [
          { label: 'F - First', value: 'F' },
          { label: 'N - Next', value: 'N' },
          { label: 'D - Default', value: 'D' },
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, addressType, numberOfRecords, firstNextDefault, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    let url = `${baseUrl}/customer/v2/customers/${customerId}/contact-info/internet-addresses`;
    const queryParams: string[] = [];
    if (addressType) queryParams.push(`addressType=${addressType}`);
    if (numberOfRecords) queryParams.push(`numberOfRecords=${numberOfRecords}`);
    if (firstNextDefault) queryParams.push(`firstNextDefault=${firstNextDefault}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});

export const customer_internet_addresses_add = createAction({
  name: 'customer_internet_addresses_add',
  auth: fisHorizonAuth,
  displayName: 'Customer - Internet Addresses - Add',
  description: 'Add an internet address record for a given customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    internetAddressData: Property.Json({
      displayName: 'Internet Address Data',
      description: 'JSON object containing internet address information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, internetAddressData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/${customerId}/contact-info/internet-addresses`,
      headers,
      body: internetAddressData,
    });

    return response.body;
  },
});

// ==================== DUE DILIGENCE - NON-PERSONAL ====================

export const customer_due_diligence_non_personal_inquiry = createAction({
  name: 'customer_due_diligence_non_personal_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Non-Personal - Inquiry',
  description: 'Retrieve a list of enhanced due diligence records for a given non-personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/non-personal`,
      headers,
    });

    return response.body;
  },
});

export const customer_due_diligence_non_personal_add = createAction({
  name: 'customer_due_diligence_non_personal_add',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Non-Personal - Add',
  description: 'Add an enhanced due diligence record for a given non-personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    dueDiligenceData: Property.Json({
      displayName: 'Due Diligence Data',
      description: 'JSON object containing due diligence information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, dueDiligenceData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/non-personal`,
      headers,
      body: dueDiligenceData,
    });

    return response.body;
  },
});

export const customer_due_diligence_non_personal_update = createAction({
  name: 'customer_due_diligence_non_personal_update',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Non-Personal - Update',
  description: 'Maintain an enhanced due diligence record for a given non-personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    dueDiligenceData: Property.Json({
      displayName: 'Due Diligence Data',
      description: 'JSON object containing updated due diligence information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, dueDiligenceData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/non-personal`,
      headers,
      body: dueDiligenceData,
    });

    return response.body;
  },
});

export const customer_due_diligence_non_personal_delete = createAction({
  name: 'customer_due_diligence_non_personal_delete',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Non-Personal - Delete',
  description: 'Delete an enhanced due diligence record for a given non-personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/non-personal`,
      headers,
    });

    return response.body;
  },
});

// ==================== DUE DILIGENCE - PERSONAL ====================

export const customer_due_diligence_personal_inquiry = createAction({
  name: 'customer_due_diligence_personal_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Personal - Inquiry',
  description: 'Retrieve a list of enhanced due diligence records for a given personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/personal`,
      headers,
    });

    return response.body;
  },
});

export const customer_due_diligence_personal_add = createAction({
  name: 'customer_due_diligence_personal_add',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Personal - Add',
  description: 'Add an enhanced due diligence record for a given personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    dueDiligenceData: Property.Json({
      displayName: 'Due Diligence Data',
      description: 'JSON object containing due diligence information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, dueDiligenceData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/personal`,
      headers,
      body: dueDiligenceData,
    });

    return response.body;
  },
});

export const customer_due_diligence_personal_update = createAction({
  name: 'customer_due_diligence_personal_update',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Personal - Update',
  description: 'Maintain an enhanced due diligence record for a given personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
      required: true,
    }),
    dueDiligenceData: Property.Json({
      displayName: 'Due Diligence Data',
      description: 'JSON object containing updated due diligence information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, dueDiligenceData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/personal`,
      headers,
      body: dueDiligenceData,
    });

    return response.body;
  },
});

export const customer_due_diligence_personal_delete = createAction({
  name: 'customer_due_diligence_personal_delete',
  auth: fisHorizonAuth,
  displayName: 'Customer - Due Diligence Personal - Delete',
  description: 'Delete an enhanced due diligence record for a given personal customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer ID (14 characters)',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, customerId, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/customer/v2/customers/${customerId}/due-diligence/personal`,
      headers,
    });

    return response.body;
  },
});

// ==================== ACCOUNT RELATIONSHIPS ====================

export const customer_account_relationships_add = createAction({
  name: 'customer_account_relationships_add',
  auth: fisHorizonAuth,
  displayName: 'Customer - Account Relationships - Add',
  description: 'Add a customer to account relationships in the customer database.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'Application code (e.g., DD, LN, CD)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number',
      required: true,
    }),
    relationshipData: Property.Json({
      displayName: 'Relationship Data',
      description: 'JSON object containing account relationship information',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, applicationCode, accountNumber, relationshipData, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/accounts/${applicationCode}/${accountNumber}/relationships/accounts`,
      headers,
      body: relationshipData,
    });

    return response.body;
  },
});

// ==================== EMAIL FORMS ====================

export const customer_email_forms_inquiry = createAction({
  name: 'customer_email_forms_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Email Forms - Inquiry',
  description: 'Retrieve the status for each primary document form in alternate delivery that is eligible to be delivered.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'Application code (e.g., DD, LN, CD)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number',
      required: true,
    }),
    formType: Property.ShortText({
      displayName: 'Form Type',
      description: 'Form type to filter by',
      required: false,
    }),
    rmKey: Property.ShortText({
      displayName: 'RM Key',
      description: 'Relationship Management key',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, applicationCode, accountNumber, formType, rmKey, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    let url = `${baseUrl}/customer/v2/accounts/${applicationCode}/${accountNumber}/email-forms`;
    const queryParams: string[] = [];
    if (formType) queryParams.push(`formType=${formType}`);
    if (rmKey) queryParams.push(`rmKey=${rmKey}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});

// ==================== DYNAMIC QUERIES ====================

export const customer_dynamic_signature_create = createAction({
  name: 'customer_dynamic_signature_create',
  auth: fisHorizonAuth,
  displayName: 'Customer - Dynamic Query - Create Signature',
  description: 'Generate a digital signature for the Customer information inquiry.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    signatureRequest: Property.Json({
      displayName: 'Signature Request',
      description: 'JSON object specifying the fields to include in the digital signature',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, signatureRequest, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/dynamic/customers/signature`,
      headers,
      body: signatureRequest,
    });

    return response.body;
  },
});

export const customer_dynamic_fields_inquiry = createAction({
  name: 'customer_dynamic_fields_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Dynamic Query - Fields Inquiry',
  description: 'Return a list of fields for the given digital signature.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    fieldsRequest: Property.Json({
      displayName: 'Fields Request',
      description: 'JSON object containing the digital signature to retrieve fields for',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, fieldsRequest, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/dynamic/customers/fields`,
      headers,
      body: fieldsRequest,
    });

    return response.body;
  },
});

export const customer_dynamic_inquiry = createAction({
  name: 'customer_dynamic_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Customer - Dynamic Query - Inquiry',
  description: 'Return customer information represented by the given digital signature.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    inquiryRequest: Property.Json({
      displayName: 'Inquiry Request',
      description: 'JSON object containing the digital signature and customer ID for the inquiry',
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
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, inquiryRequest, sourceId } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/dynamic/customers/inquiry`,
      headers,
      body: inquiryRequest,
    });

    return response.body;
  },
});

// ==================== RELATIONSHIP SUMMARY WITH ACCOUNT DETAILS ====================

export const customer_relationship_summary_account_details_search = createAction({
  name: 'customer_relationship_summary_account_details_search',
  auth: fisHorizonAuth,
  displayName: 'Customer - Relationship Summary Account Details - Search',
  description: 'Retrieve a list of applications/accounts along with account details for a specific customer.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token (JWT)',
      description: 'The JWT token obtained from the Authorization - Get Token action',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'The customer ID to search for',
      required: false,
    }),
    tin: Property.ShortText({
      displayName: 'TIN (Tax ID)',
      description: 'The Tax Identification Number',
      required: false,
    }),
    interfaceFlag: Property.StaticDropdown({
      displayName: 'Interface Flag',
      description: 'Interface flag for the request',
      required: false,
      options: {
        options: [
          { label: 'IN - Internal', value: 'IN' },
          { label: 'EX - External', value: 'EX' },
        ],
      },
    }),
    ownershipType: Property.StaticDropdown({
      displayName: 'Ownership Type',
      description: 'The ownership type to filter by',
      required: false,
      options: {
        options: [
          { label: 'D - Direct', value: 'D' },
          { label: 'I - Indirect', value: 'I' },
          { label: 'S - Signer', value: 'S' },
        ],
      },
    }),
    numberOfAccountsToReturn: Property.Number({
      displayName: 'Number of Accounts to Return',
      description: 'Maximum number of accounts to return',
      required: false,
      defaultValue: 999,
    }),
    viewUndisplayedRelationships: Property.StaticDropdown({
      displayName: 'View Undisplayed Relationships',
      description: 'Whether to include undisplayed relationships',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
      defaultValue: 'Y',
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Return data in uppercase',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    searchDirection: Property.StaticDropdown({
      displayName: 'Search Direction',
      description: 'Direction for searching',
      required: false,
      options: {
        options: [
          { label: 'B - Both', value: 'B' },
          { label: 'F - Forward', value: 'F' },
          { label: 'R - Reverse', value: 'R' },
        ],
      },
    }),
    onlineBankingUserId: Property.ShortText({
      displayName: 'Online Banking User ID',
      description: 'Online banking user ID',
      required: false,
    }),
    availableBalanceDDA: Property.ShortText({
      displayName: 'Available Balance DDA',
      description: 'Available balance calculation type for DDA',
      required: false,
    }),
    savingsAvailableBalance: Property.ShortText({
      displayName: 'Savings Available Balance',
      description: 'Available balance calculation type for Savings',
      required: false,
    }),
    includeReadyReserveOverdraft: Property.Checkbox({
      displayName: 'Include Ready Reserve Overdraft',
      description: 'Whether to include ready reserve overdraft',
      required: false,
      defaultValue: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization,
      customerId,
      tin,
      interfaceFlag,
      ownershipType,
      numberOfAccountsToReturn,
      viewUndisplayedRelationships,
      returnUppercase,
      searchDirection,
      onlineBankingUserId,
      availableBalanceDDA,
      savingsAvailableBalance,
      includeReadyReserveOverdraft,
      sourceId,
    } = context.propsValue;

    const headers = createHeaders(organizationId, xAuthorization, sourceId);

    // Add optional header params
    if (returnUppercase) {
      headers['returnUppercase'] = returnUppercase;
    }
    if (searchDirection) {
      headers['searchDirection'] = searchDirection;
    }

    const body: Record<string, unknown> = {};

    if (customerId) body['customerId'] = customerId;
    if (tin) body['tin'] = tin;
    if (interfaceFlag) body['interfaceFlag'] = interfaceFlag;
    if (ownershipType) body['ownershipType'] = ownershipType;
    if (numberOfAccountsToReturn) body['numberOfAccountsToReturn'] = numberOfAccountsToReturn;
    if (viewUndisplayedRelationships) body['viewUndisplayedRelationships'] = viewUndisplayedRelationships;
    if (onlineBankingUserId) body['onlineBankingUserId'] = onlineBankingUserId;
    if (availableBalanceDDA) body['availableBalanceDDA'] = availableBalanceDDA;
    if (savingsAvailableBalance) body['savingsAvailableBalance'] = savingsAvailableBalance;
    if (includeReadyReserveOverdraft !== undefined) body['includeReadyReserveOverdraft'] = includeReadyReserveOverdraft;

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/relationship-summary/account-details/search`,
      headers,
      body,
    });

    return response.body;
  },
});
