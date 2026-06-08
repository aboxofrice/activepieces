import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisIbsAuth } from '../..';

export const getCustomer = createAction({
  name: 'customer_get',
  auth: fisIbsAuth,
  displayName: 'Customer - Get',
  description: 'Retrieve customer information by customer number.',
  props: {
    customerNumber: Property.ShortText({
      displayName: 'Customer Number',
      description: 'The customer number to retrieve',
      required: true,
    }),
    effectiveUserId: Property.ShortText({
      displayName: 'Effective User ID',
      description: 'Optional: User ID for audit purposes',
      required: false,
    }),
    safIndicator: Property.StaticDropdown({
      displayName: 'SAF Indicator',
      description: 'Store and forward indicator',
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
    const { customerNumber, effectiveUserId, safIndicator } = context.propsValue;

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

    if (safIndicator) {
      headers['saf-indicator'] = safIndicator;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/IBSCICUST/v4/customers/${customerNumber}`,
      headers,
    });

    return response.body;
  },
});
