import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { icemortgageEncompassAuth } from '../common/auth';
import { getAccessToken, getAuthProps } from '../common/helpers';

export const retrieveLoan = createAction({
  name: 'loan_retrieve',
  auth: icemortgageEncompassAuth,
  displayName: 'Loan - Retrieve',
  description: 'Get loan details from Encompass by loan ID',
  props: {
    loanId: Property.ShortText({
      displayName: 'Loan ID',
      description: 'The ID of the loan to retrieve',
      required: true,
    }),
  },
  async run(context) {
    const authProps = getAuthProps(context.auth);
    const { loanId } = context.propsValue;

    const accessToken = await getAccessToken(authProps);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${authProps.baseUrl}/encompass/v3/loans/${loanId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response.body;
  },
});
