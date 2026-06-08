import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisIbsAuth } from '../..';

export const searchCustomers = createAction({
  name: 'customer_search',
  auth: fisIbsAuth,
  displayName: 'Customer - Search',
  description: 'Search for customers using various criteria.',
  props: {
    searchType: Property.StaticDropdown({
      displayName: 'Search Type',
      description: 'Type of search to perform',
      required: true,
      options: {
        options: [
          { label: 'By Name', value: 'name' },
          { label: 'By TIN (Tax ID)', value: 'tin' },
          { label: 'By Phone', value: 'phone' },
          { label: 'By Account Number', value: 'account' },
        ],
      },
      defaultValue: 'name',
    }),
    lastName: Property.ShortText({
      displayName: 'Last Name',
      description: 'Customer last name (for name search)',
      required: false,
    }),
    firstName: Property.ShortText({
      displayName: 'First Name',
      description: 'Customer first name (for name search)',
      required: false,
    }),
    tin: Property.ShortText({
      displayName: 'TIN (Tax ID)',
      description: 'Tax Identification Number (for TIN search)',
      required: false,
    }),
    phoneNumber: Property.ShortText({
      displayName: 'Phone Number',
      description: 'Phone number (for phone search)',
      required: false,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number (for account search)',
      required: false,
    }),
    maxRecords: Property.Number({
      displayName: 'Max Records',
      description: 'Maximum number of records to return',
      required: false,
      defaultValue: 25,
    }),
    effectiveUserId: Property.ShortText({
      displayName: 'Effective User ID',
      description: 'Optional: User ID for audit purposes',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const {
      searchType,
      lastName,
      firstName,
      tin,
      phoneNumber,
      accountNumber,
      maxRecords,
      effectiveUserId,
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': auth.organizationId,
      'source-id': auth.sourceId,
      'application-id': auth.applicationId,
      'uuid': uuid,
      'ibs-authorization': auth.ibsAuthorization,
    };

    if (auth.securityTokenType) {
      headers['security-token-type'] = auth.securityTokenType;
    }

    if (effectiveUserId) {
      headers['effective-user-id'] = effectiveUserId;
    }

    // Build query parameters based on search type
    const queryParams: Record<string, string> = {};

    if (maxRecords) {
      queryParams['maxRecs'] = String(maxRecords);
    }

    switch (searchType) {
      case 'name':
        if (lastName) {
          queryParams['lastName'] = lastName;
        }
        if (firstName) {
          queryParams['firstName'] = firstName;
        }
        break;
      case 'tin':
        if (tin) {
          queryParams['tin'] = tin;
        }
        break;
      case 'phone':
        if (phoneNumber) {
          queryParams['phone'] = phoneNumber;
        }
        break;
      case 'account':
        if (accountNumber) {
          queryParams['acctNbr'] = accountNumber;
        }
        break;
    }

    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${baseUrl}/IBSCISRCH/v4/customers${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });

    return response.body;
  },
});
