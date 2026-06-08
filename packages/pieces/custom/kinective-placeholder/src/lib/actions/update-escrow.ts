import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const updateEscrow = createAction({
  name: 'escrow_update',
  auth: kinectivePlaceholderAuth,
  displayName: 'Escrow - Update',
  description: 'Update escrow information',
  props: {
    escrowId: Property.ShortText({
      displayName: 'Escrow ID',
      description: 'The ID of the escrow to update',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Updated escrow amount',
      required: false,
    }),
    frequency: Property.StaticDropdown({
      displayName: 'Payment Frequency',
      description: 'Updated payment frequency',
      required: false,
      options: {
        options: [
          { label: 'Monthly', value: 'Monthly' },
          { label: 'Quarterly', value: 'Quarterly' },
          { label: 'Semi-Annual', value: 'SemiAnnual' },
          { label: 'Annual', value: 'Annual' },
        ],
      },
    }),
    description: Property.ShortText({
      displayName: 'Description',
      description: 'Updated description',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { escrowId, amount, frequency, description } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      EscrowKeys: {
        EscrowId: escrowId,
      },
      EscrowInfo: {},
    };

    if (amount !== undefined && amount !== null) requestBody.EscrowInfo.Amount = amount;
    if (frequency) requestBody.EscrowInfo.Frequency = frequency;
    if (description) requestBody.EscrowInfo.Description = description;

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/banking/efx/v1/loanservice/escrow`,
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
