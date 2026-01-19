import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const updateAccount = createAction({
  name: 'account_update',
  auth: kinectivePlaceholderAuth,
  displayName: 'Account - Update',
  description: 'Update account information',
  props: {
    accountId: Property.ShortText({
      displayName: 'Account ID',
      description: 'The ID of the account to update',
      required: true,
    }),
    accountStatus: Property.StaticDropdown({
      displayName: 'Account Status',
      description: 'Update account status',
      required: false,
      options: {
        options: [
          { label: 'Active', value: 'Active' },
          { label: 'Inactive', value: 'Inactive' },
          { label: 'Closed', value: 'Closed' },
          { label: 'Dormant', value: 'Dormant' },
        ],
      },
    }),
    interestRate: Property.Number({
      displayName: 'Interest Rate',
      description: 'Updated interest rate percentage',
      required: false,
    }),
    creditLimit: Property.Number({
      displayName: 'Credit Limit',
      description: 'Updated credit limit (for credit accounts)',
      required: false,
    }),
    nickname: Property.ShortText({
      displayName: 'Account Nickname',
      description: 'Friendly name for the account',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { accountId, accountStatus, interestRate, creditLimit, nickname } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      AcctKeys: {
        AcctId: accountId,
      },
    };

    const updateFields: any = {};
    if (accountStatus) updateFields.AcctStatus = accountStatus;
    if (interestRate !== undefined && interestRate !== null) updateFields.Rate = interestRate;
    if (creditLimit !== undefined && creditLimit !== null) updateFields.CreditLimit = creditLimit;
    if (nickname) updateFields.Nickname = nickname;

    if (Object.keys(updateFields).length > 0) {
      requestBody.AcctInfo = updateFields;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/banking/efx/v1/acctservice/accounts`,
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
