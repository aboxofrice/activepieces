import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const deleteCollateral = createAction({
  name: 'collateral_delete',
  auth: kinectivePlaceholderAuth,
  displayName: 'Collateral - Delete',
  description: 'Delete collateral from a loan',
  props: {
    collateralId: Property.ShortText({
      displayName: 'Collateral ID',
      description: 'The ID of the collateral to delete',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { collateralId } = context.propsValue;

    const trnId = crypto.randomUUID();

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/banking/efx/v1/loanservice/collateral/secured`,
      headers: {
        'accept': 'application/json',
        'EFXHeader': JSON.stringify({
          OrganizationId: organizationId,
          TrnId: trnId,
        }),
        'Content-Type': 'application/json',
      },
      body: {
        CollateralKeys: {
          CollateralId: collateralId,
        },
      },
    });

    return response.body;
  },
});
