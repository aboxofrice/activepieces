import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { generatedActions } from './lib/actions/generated';
import { getProductInventory } from './lib/actions/get-product-inventory';
import { getQueuedJob } from './lib/actions/get-queued-job';
import { importInventoryFromCsv } from './lib/actions/import-inventory-from-csv';
import { importPhysicalInventory } from './lib/actions/import-physical-inventory';
import { listWarehouses } from './lib/actions/list-warehouses';
import { sellercloudAuth, sellercloudAuthProps } from './lib/auth';
import { sellercloudClient } from './lib/common/client';

export const sellercloud = createPiece({
    displayName: 'SellerCloud',
    description: 'Multichannel inventory and order management: import physical inventory, check stock and track queued jobs.',
    minimumSupportedRelease: '0.36.1',
    logoUrl: 'data:image/webp;base64,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',
    categories: [PieceCategory.COMMERCE],
    auth: sellercloudAuth,
    authors: ['vqnguyen1'],
    actions: [
        importInventoryFromCsv,
        importPhysicalInventory,
        getQueuedJob,
        getProductInventory,
        listWarehouses,
        ...generatedActions,
        createCustomApiCallAction({
            auth: sellercloudAuth,
            baseUrl: (auth) => (auth ? sellercloudClient.apiBase({ auth: sellercloudAuthProps(auth) }) : ''),
            authMapping: async (auth) => ({
                Authorization: `Bearer ${await sellercloudClient.getToken({ auth: sellercloudAuthProps(auth) })}`,
            }),
        }),
    ],
    triggers: [],
});
