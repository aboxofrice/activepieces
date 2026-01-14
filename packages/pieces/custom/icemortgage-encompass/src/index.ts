import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { icemortgageEncompassAuth } from './lib/common/auth';
import { createLoan } from './lib/actions/create-loan';
import { retrieveLoan } from './lib/actions/retrieve-loan';
import { updateLoan } from './lib/actions/update-loan';
import { deleteLoan } from './lib/actions/delete-loan';
import { manageFieldLocks } from './lib/actions/manage-field-locks';
import { createDocument } from './lib/actions/document-create';
import { retrieveDocument } from './lib/actions/document-retrieve';
import { listDocuments } from './lib/actions/document-list';
import { updateDocument } from './lib/actions/document-update';
import { addDocumentComments } from './lib/actions/document-add-comments';
import { assignDocumentAttachments } from './lib/actions/document-assign-attachments';

export const icemortgageEncompass = createPiece({
  displayName: 'IceMortgage Encompass',
  auth: icemortgageEncompassAuth,
  minimumSupportedRelease: '0.20.0',
  logoUrl: 'https://media.licdn.com/dms/image/v2/C560BAQENYzaNYtPwTQ/company-logo_200_200/company-logo_200_200/0/1647830587991/icemortgagetechnology_logo?e=1769644800&v=beta&t=sbeBJx6uRlT5Qny-bQGWrUnCB08ezNdqDpXZY-NEtyw',
  authors: ['vqnguyen1'],
  categories: [PieceCategory.BUSINESS_INTELLIGENCE],
  actions: [
    createLoan,
    retrieveLoan,
    updateLoan,
    deleteLoan,
    manageFieldLocks,
    createDocument,
    retrieveDocument,
    listDocuments,
    updateDocument,
    addDocumentComments,
    assignDocumentAttachments,
    createCustomApiCallAction({
      baseUrl: (auth) => (auth as any).baseUrl || 'https://api.elliemae.com',
      auth: icemortgageEncompassAuth,
      authMapping: async (auth) => {
        // Note: Encompass uses OAuth2, this is a simplified version
        // In production, you'd need to handle token refresh
        return {
          'Authorization': `Bearer ${(auth as any).clientSecret}`,
          'Content-Type': 'application/json',
        };
      },
    }),
  ],
  triggers: [],
});

export { icemortgageEncompassAuth };
