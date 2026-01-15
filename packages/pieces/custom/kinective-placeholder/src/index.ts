import { createPiece, PieceAuth, Property } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { createCustomApiCallAction } from '@activepieces/pieces-common';

// Party actions
import { getParty } from './lib/actions/get-party';
import { getPartyList } from './lib/actions/get-party-list';
import { addParty } from './lib/actions/add-party';
import { updateParty } from './lib/actions/update-party';

// Account actions
import { createAccount } from './lib/actions/create-account';
import { getAccount } from './lib/actions/get-account';
import { updateAccount } from './lib/actions/update-account';

// Collateral actions
import { addCollateral } from './lib/actions/add-collateral';
import { getCollateral } from './lib/actions/get-collateral';
import { updateCollateral } from './lib/actions/update-collateral';
import { deleteCollateral } from './lib/actions/delete-collateral';

// Escrow actions
import { addEscrow } from './lib/actions/add-escrow';
import { getEscrow } from './lib/actions/get-escrow';
import { updateEscrow } from './lib/actions/update-escrow';
import { deleteEscrow } from './lib/actions/delete-escrow';

export const kinectivePlaceholderAuth = PieceAuth.CustomAuth({
  description: 'Kinective Placeholder API credentials',
  required: true,
  props: {
    baseUrl: Property.ShortText({
      displayName: 'Base URL',
      description: 'The base URL for the Kinective API (e.g., https://api.kinective.com)',
      required: true,
    }),
    organizationId: Property.ShortText({
      displayName: 'Organization ID',
      description: 'Your Kinective Organization ID',
      required: true,
    }),
  },
});

export const kinectivePlaceholder = createPiece({
  displayName: 'Kinective Placeholder',
  auth: kinectivePlaceholderAuth,
  minimumSupportedRelease: '0.20.0',
  logoUrl: 'https://cdn.activepieces.com/pieces/kinective.png',
  authors: ['vqnguyen1'],
  categories: [PieceCategory.BUSINESS_INTELLIGENCE],
  actions: [
    // Party actions (4)
    getParty,
    getPartyList,
    addParty,
    updateParty,

    // Account actions (3)
    createAccount,
    getAccount,
    updateAccount,

    // Collateral actions (4)
    addCollateral,
    getCollateral,
    updateCollateral,
    deleteCollateral,

    // Escrow actions (4)
    addEscrow,
    getEscrow,
    updateEscrow,
    deleteEscrow,

    // Custom API Call
    createCustomApiCallAction({
      baseUrl: (auth) => (auth as any).baseUrl || 'https://api.kinective.com',
      auth: kinectivePlaceholderAuth,
      authMapping: async (auth) => {
        const organizationId = (auth as any).organizationId;
        const trnId = crypto.randomUUID();
        return {
          'EFXHeader': JSON.stringify({
            OrganizationId: organizationId,
            TrnId: trnId,
          }),
        };
      },
    }),
  ],
  triggers: [],
});
