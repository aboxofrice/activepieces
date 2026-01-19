import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

export const searchCustomerRelationshipSummary = createAction({
  name: 'customer_search_relationship_summary',
  auth: fisHorizonAuth,
  displayName: 'Customer - Search Relationship Summary',
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
    const {
      xAuthorization,
      customerId,
      tin,
      interfaceFlag,
      ownershipType,
      numberOfAccountsToReturn,
      viewUndisplayedRelationships,
      sourceId,
    } = context.propsValue;

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

    const body: Record<string, unknown> = {};

    if (customerId) {
      body['customerId'] = customerId;
    }

    if (tin) {
      body['tin'] = tin;
    }

    if (interfaceFlag) {
      body['interfaceFlag'] = interfaceFlag;
    }

    if (ownershipType) {
      body['ownershipType'] = ownershipType;
    }

    if (numberOfAccountsToReturn) {
      body['numberOfAccountsToReturn'] = numberOfAccountsToReturn;
    }

    if (viewUndisplayedRelationships) {
      body['viewUndisplayedRelationships'] = viewUndisplayedRelationships;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/customer/v2/customers/relationship-summary/account-details/search`,
      headers,
      body,
    });

    return response.body;
  },
});
