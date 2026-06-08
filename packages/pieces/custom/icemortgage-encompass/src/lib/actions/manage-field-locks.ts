import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { icemortgageEncompassAuth } from '../common/auth';
import { getAccessToken, getAuthProps } from '../common/helpers';

export const manageFieldLocks = createAction({
  name: 'loan_manage_field_locks',
  auth: icemortgageEncompassAuth,
  displayName: 'Loan - Manage Field Locks',
  description: 'Add, remove, or replace field locks on a loan',
  props: {
    loanId: Property.ShortText({
      displayName: 'Loan ID',
      description: 'The ID of the loan to manage field locks for',
      required: true,
    }),
    action: Property.StaticDropdown({
      displayName: 'Action',
      description: 'The action to perform on field locks',
      required: true,
      options: {
        options: [
          { label: 'Add', value: 'add' },
          { label: 'Remove', value: 'remove' },
          { label: 'Replace', value: 'replace' },
        ],
      },
    }),
    fields: Property.Array({
      displayName: 'Fields',
      description: 'Array of field names to lock/unlock (e.g., ["loan.secondSubordinateAmount", "loan.BorrowerPaidFHAVAClosingCostsAmount"])',
      required: true,
    }),
  },
  async run(context) {
    const authProps = getAuthProps(context.auth);
    const { loanId, action, fields } = context.propsValue;

    const accessToken = await getAccessToken(authProps);

    const response = await httpClient.sendRequest({
      method: HttpMethod.PATCH,
      url: `${authProps.baseUrl}/encompass/v3/loans/${loanId}/fieldLockData?action=${action}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: fields,
    });

    return {
      success: true,
      action,
      fields,
      statusCode: response.status,
    };
  },
});
