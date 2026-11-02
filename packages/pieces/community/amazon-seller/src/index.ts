import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { cancelOrder } from './lib/actions/cancel-order';
import { checkPartFitment } from './lib/actions/check-part-fitment';
import { confirmShipment } from './lib/actions/confirm-shipment';
import { getCatalogItem } from './lib/actions/get-catalog-item';
import { getFeedStatus } from './lib/actions/get-feed-status';
import { getOrderFinancials } from './lib/actions/get-order-financials';
import { getProductTypeDefinition } from './lib/actions/get-product-type-definition';
import { getReturns } from './lib/actions/get-returns';
import { searchCatalog } from './lib/actions/search-catalog';
import { updateListingPrice } from './lib/actions/update-listing-price';
import { getBuyerAttributes } from './lib/actions/get-buyer-attributes';
import { getFbaInventory } from './lib/actions/get-fba-inventory';
import { getListing } from './lib/actions/get-listing';
import { getMessageTypes } from './lib/actions/get-message-types';
import { getOrder } from './lib/actions/get-order';
import { getOrderItems } from './lib/actions/get-order-items';
import { listOrders } from './lib/actions/list-orders';
import { sendMessage } from './lib/actions/send-message';
import { updateListingQuantity } from './lib/actions/update-listing-quantity';
import { amazonSellerAuth, amazonSellerAuthProps } from './lib/auth';
import { spApiClient } from './lib/common/client';
import { newOrder } from './lib/triggers/new-order';

export const amazonSeller = createPiece({
    displayName: 'Amazon Seller Central',
    description: 'Orders, shipping, inventory, pricing, catalog/fitment and buyer messaging through the Amazon Selling Partner API.',
    minimumSupportedRelease: '0.36.1',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Amazon_icon.svg',
    categories: [PieceCategory.COMMERCE],
    auth: amazonSellerAuth,
    authors: ['vqnguyen1'],
    actions: [
        listOrders,
        getOrder,
        getOrderItems,
        getOrderFinancials,
        confirmShipment,
        cancelOrder,
        getFeedStatus,
        getReturns,
        getFbaInventory,
        getListing,
        updateListingQuantity,
        updateListingPrice,
        getCatalogItem,
        searchCatalog,
        checkPartFitment,
        getProductTypeDefinition,
        getMessageTypes,
        getBuyerAttributes,
        sendMessage,
        createCustomApiCallAction({
            auth: amazonSellerAuth,
            baseUrl: (auth) => (auth ? spApiClient.apiBase({ auth: amazonSellerAuthProps(auth) }) : ''),
            authMapping: async (auth) => ({
                'x-amz-access-token': await spApiClient.getAccessToken({ auth: amazonSellerAuthProps(auth) }),
            }),
        }),
    ],
    triggers: [newOrder],
});
