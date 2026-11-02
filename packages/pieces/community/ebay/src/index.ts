import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { checkVehicleFitment } from './lib/actions/fitment/check-vehicle-fitment';
import { getConversation } from './lib/actions/message/get-conversation';
import { getConversations } from './lib/actions/message/get-conversations';
import { sendMessage } from './lib/actions/message/send-message';
import { updateConversation } from './lib/actions/message/update-conversation';
import { ebayAuth } from './lib/auth';
import { ebayClient } from './lib/common/client';
import { newMessage } from './lib/triggers/message/new-message';

export const ebay = createPiece({
    displayName: 'eBay',
    description: 'eBay seller REST APIs — buyer messaging and listing fitment checks, with more domains (fulfillment, inventory, …) to follow.',
    minimumSupportedRelease: '0.36.1',
    logoUrl: 'data:image/webp;base64,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',
    categories: [PieceCategory.COMMERCE],
    auth: ebayAuth,
    authors: ['vqnguyen1'],
    actions: [
        getConversations,
        getConversation,
        sendMessage,
        updateConversation,
        checkVehicleFitment,
        createCustomApiCallAction({
            auth: ebayAuth,
            baseUrl: (auth) => (auth ? ebayClient.baseUrl({ auth: auth.props }) : ''),
            authMapping: async (auth) => ({
                Authorization: `Bearer ${await ebayClient.getAccessToken({ auth: auth.props })}`,
            }),
        }),
    ],
    triggers: [newMessage],
});
