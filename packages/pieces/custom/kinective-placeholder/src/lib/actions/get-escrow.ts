import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const getEscrow = createAction({
  name: 'escrow_get',
  auth: kinectivePlaceholderAuth,
  displayName: 'Escrow - Get',
  description: 'Retrieve escrow information',
  props: {
    escrowId: Property.ShortText({
      displayName: 'Escrow ID',
      description: 'The ID of the escrow to retrieve',
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
    const { escrowId, loanId } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      EscrowKeys: {
        EscrowId: escrowId,
      },
    };

    if (loanId) {
      requestBody.LoanKeys = {
        LoanId: loanId,
      };
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/banking/efx/v1/loanservice/escrow/secured`,
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
