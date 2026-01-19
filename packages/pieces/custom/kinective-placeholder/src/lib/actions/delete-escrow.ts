import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const deleteEscrow = createAction({
  name: 'escrow_delete',
  auth: kinectivePlaceholderAuth,
  displayName: 'Escrow - Delete',
  description: 'Delete escrow from a loan',
  props: {
    escrowId: Property.ShortText({
      displayName: 'Escrow ID',
      description: 'The ID of the escrow to delete',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { escrowId } = context.propsValue;

    const trnId = crypto.randomUUID();

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
      body: {
        EscrowKeys: {
          EscrowId: escrowId,
        },
      },
    });

    return response.body;
  },
});
