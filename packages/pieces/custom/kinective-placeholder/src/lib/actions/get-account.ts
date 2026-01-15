import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const getAccount = createAction({
  name: 'account_get',
  auth: kinectivePlaceholderAuth,
  displayName: 'Account - Get',
  description: 'Retrieve account information',
  props: {
    accountId: Property.ShortText({
      displayName: 'Account ID',
      description: 'The ID of the account to retrieve',
      required: true,
    }),
    includeBalance: Property.Checkbox({
      displayName: 'Include Balance',
      description: 'Include current balance information',
      required: false,
      defaultValue: true,
    }),
    includeTransactions: Property.Checkbox({
      displayName: 'Include Recent Transactions',
      description: 'Include recent transaction history',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { accountId, includeBalance, includeTransactions } = context.propsValue;

    const trnId = crypto.randomUUID();

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/banking/efx/v1/acctservice/accounts/secured`,
      headers: {
        'accept': 'application/json',
        'EFXHeader': JSON.stringify({
          OrganizationId: organizationId,
          TrnId: trnId,
        }),
        'Content-Type': 'application/json',
      },
      body: {
        AcctKeys: {
          AcctId: accountId,
        },
        IncludeBalance: includeBalance,
        IncludeTransactions: includeTransactions,
      },
    });

    return response.body;
  },
});
