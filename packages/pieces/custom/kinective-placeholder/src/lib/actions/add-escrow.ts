import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const addEscrow = createAction({
  name: 'escrow_add',
  auth: kinectivePlaceholderAuth,
  displayName: 'Escrow - Add',
  description: 'Add escrow to a loan',
  props: {
    loanId: Property.ShortText({
      displayName: 'Loan ID',
      description: 'The ID of the loan to add escrow to',
      required: true,
    }),
    escrowType: Property.StaticDropdown({
      displayName: 'Escrow Type',
      description: 'Type of escrow',
      required: true,
      options: {
        options: [
          { label: 'Property Tax', value: 'PropertyTax' },
          { label: 'Insurance', value: 'Insurance' },
          { label: 'PMI', value: 'PMI' },
          { label: 'HOA', value: 'HOA' },
          { label: 'Other', value: 'Other' },
        ],
      },
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Escrow amount',
      required: true,
    }),
    frequency: Property.StaticDropdown({
      displayName: 'Payment Frequency',
      description: 'How often escrow payments are made',
      required: false,
      options: {
        options: [
          { label: 'Monthly', value: 'Monthly' },
          { label: 'Quarterly', value: 'Quarterly' },
          { label: 'Semi-Annual', value: 'SemiAnnual' },
          { label: 'Annual', value: 'Annual' },
        ],
      },
      defaultValue: 'Monthly',
    }),
    description: Property.ShortText({
      displayName: 'Description',
      description: 'Description of the escrow',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { loanId, escrowType, amount, frequency, description } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      LoanKeys: {
        LoanId: loanId,
      },
      EscrowInfo: {
        EscrowType: escrowType,
        Amount: amount,
        Frequency: frequency || 'Monthly',
      },
    };

    if (description) {
      requestBody.EscrowInfo.Description = description;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
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
