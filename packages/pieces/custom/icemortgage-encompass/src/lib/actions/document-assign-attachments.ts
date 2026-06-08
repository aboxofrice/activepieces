import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { icemortgageEncompassAuth } from '../common/auth';
import { getAccessToken, getAuthProps } from '../common/helpers';

export const assignDocumentAttachments = createAction({
  name: 'document_assign_attachments',
  auth: icemortgageEncompassAuth,
  displayName: 'Document - Assign Attachments',
  description: 'Assign attachments to a document',
  props: {
    loanId: Property.ShortText({
      displayName: 'Loan ID',
      description: 'The ID of the loan',
      required: true,
    }),
    documentId: Property.ShortText({
      displayName: 'Document ID',
      description: 'The ID of the document to assign attachments to',
      required: true,
    }),
    attachments: Property.Array({
      displayName: 'Attachments',
      description: 'Array of attachment objects (with entityId and entityType fields)',
      required: true,
    }),
  },
  async run(context) {
    const authProps = getAuthProps(context.auth);
    const { loanId, documentId, attachments } = context.propsValue;

    const accessToken = await getAccessToken(authProps);

    const queryParams = new URLSearchParams();
    queryParams.append('action', 'add');

    const response = await httpClient.sendRequest({
      method: HttpMethod.PATCH,
      url: `${authProps.baseUrl}/encompass/v3/loans/${loanId}/documents/${documentId}/attachments?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: attachments,
    });

    return response.body;
  },
});
