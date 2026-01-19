import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const updateCollateral = createAction({
  name: 'collateral_update',
  auth: kinectivePlaceholderAuth,
  displayName: 'Collateral - Update',
  description: 'Update collateral information',
  props: {
    collateralId: Property.ShortText({
      displayName: 'Collateral ID',
      description: 'The ID of the collateral to update',
      required: true,
    }),
    description: Property.LongText({
      displayName: 'Description',
      description: 'Updated description of the collateral',
      required: false,
    }),
    estimatedValue: Property.Number({
      displayName: 'Estimated Value',
      description: 'Updated estimated value',
      required: false,
    }),
    customFields: Property.Json({
      displayName: 'Custom Fields (JSON)',
      description: 'Additional fields to update',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { collateralId, description, estimatedValue, customFields } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      CollateralKeys: {
        CollateralId: collateralId,
      },
      CollateralInfo: {},
    };

    if (description) requestBody.CollateralInfo.Description = description;
    if (estimatedValue !== undefined && estimatedValue !== null) {
      requestBody.CollateralInfo.EstimatedValue = estimatedValue;
    }

    if (customFields) {
      Object.assign(requestBody.CollateralInfo, customFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/banking/efx/v1/loanservice/collateral`,
      headers: {
        'accept': 'application/json',
        'EFXHeader': JSON.stringify({
          OrganizationId: organizationId,
          TrnId: trnId,
        }),
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    return response.body;
  },
});
