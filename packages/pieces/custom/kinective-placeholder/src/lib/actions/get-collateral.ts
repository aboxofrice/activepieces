import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const getCollateral = createAction({
  name: 'collateral_get',
  auth: kinectivePlaceholderAuth,
  displayName: 'Collateral - Get',
  description: 'Retrieve collateral information',
  props: {
    collateralId: Property.ShortText({
      displayName: 'Collateral ID',
      description: 'The ID of the collateral to retrieve',
      required: true,
    }),
    loanId: Property.ShortText({
      displayName: 'Loan ID',
      description: 'The ID of the associated loan',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { collateralId, loanId } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      CollateralKeys: {
        CollateralId: collateralId,
      },
    };

    if (loanId) {
      requestBody.LoanKeys = {
        LoanId: loanId,
      };
    }

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
      body: requestBody,
    });

    return response.body;
  },
});
