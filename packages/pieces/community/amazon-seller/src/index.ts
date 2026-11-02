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
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIyLjE2NyAuNDM4IDI1MS4wMzggMjU5Ljk2OSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Im0yMjEuNTAzIDIxMC4zMjRjLTEwNS4yMzUgNTAuMDgzLTE3MC41NDUgOC4xOC0yMTIuMzUyLTE3LjI3MS0yLjU4Ny0xLjYwNC02Ljk4NC4zNzUtMy4xNjkgNC43NTcgMTMuOTI4IDE2Ljg4OCA1OS41NzMgNTcuNTkzIDExOS4xNTMgNTcuNTkzIDU5LjYyMSAwIDk1LjA5LTMyLjUzMiA5OS41MjctMzguMjA3IDQuNDA3LTUuNjI3IDEuMjk0LTguNzMxLTMuMTYtNi44NzJ6bTI5LjU1NS0xNi4zMjJjLTIuODI2LTMuNjgtMTcuMTg0LTQuMzY2LTI2LjIyLTMuMjU2LTkuMDUgMS4wNzgtMjIuNjM0IDYuNjA5LTIxLjQ1MyA5LjkzLjYwNiAxLjI0NCAxLjg0My42ODYgOC4wNi4xMjcgNi4yMzQtLjYyMiAyMy42OTgtMi44MjYgMjcuMzM3IDEuOTMxIDMuNjU2IDQuNzktNS41NyAyNy42MDgtNy4yNTUgMzEuMjg4LTEuNjI4IDMuNjguNjIyIDQuNjI5IDMuNjggMi4xNzggMy4wMTYtMi40NSA4LjQ3Ni04Ljc5NSAxMi4xNC0xNy43NzQgMy42MzktOS4wMjggNS44NTgtMjEuNjIyIDMuNzEtMjQuNDI0eiIgZmlsbD0iI2Y5MCIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0ibTE1MC43NDQgMTA4LjEzYzAgMTMuMTQxLjMzMiAyNC4xLTYuMzEgMzUuNzctNS4zNjEgOS40ODktMTMuODUzIDE1LjMyNC0yMy4zNDEgMTUuMzI0LTEyLjk1MiAwLTIwLjQ5NS05Ljg2OC0yMC40OTUtMjQuNDMyIDAtMjguNzUgMjUuNzYtMzMuOTY4IDUwLjE0Ni0zMy45Njh6bTM0LjAxNSA4Mi4yMTZjLTIuMjMgMS45OTItNS40NTYgMi4xMzUtNy45Ny44MDYtMTEuMTk2LTkuMjk4LTEzLjE4OS0xMy42MTUtMTkuMzU2LTIyLjQ4Ny0xOC41MDIgMTguODgyLTMxLjU5NiAyNC41MjctNTUuNjAxIDI0LjUyNy0yOC4zNyAwLTUwLjQ3OC0xNy41MDYtNTAuNDc4LTUyLjU2NSAwLTI3LjM3MyAxNC44NS00Ni4wMTggMzUuOTYtNTUuMTI2IDE4LjMxMy04LjA2NiA0My44ODQtOS40ODkgNjMuNDMtMTEuNzE4di00LjM2NWMwLTguMDE4LjYxNi0xNy41MDYtNC4wOC0yNC40MzItNC4xMjgtNi4yMTUtMTIuMDAzLTguNzc3LTE4LjkzLTguNzc3LTEyLjg1NiAwLTI0LjMzNyA2LjU5NC0yNy4xMzYgMjAuMjU3LS41NyAzLjAzNy0yLjc5OSA2LjAyNi01LjgzNSA2LjE2OGwtMzIuNzM1LTMuNTFjLTIuNzUxLS42MTgtNS43ODctMi44NDctNS4wMjgtNy4wNyA3LjU0My0zOS42NiA0My4zNi01MS42MTYgNzUuNDMtNTEuNjE2IDE2LjQxNSAwIDM3Ljg1OCA0LjM2NSA1MC44MSAxNi43OTUgMTYuNDE1IDE1LjMyMyAxNC44NDkgMzUuNzcgMTQuODQ5IDU4LjAydjUyLjU2NWMwIDE1Ljc5OCA2LjU0NyAyMi43MjQgMTIuNzE0IDMxLjI2NCAyLjE4MiAzLjAzNiAyLjY1NyA2LjY5LS4wOTUgOC45NjYtNi44NzkgNS43NC0xOS4xMTkgMTYuNDE1LTI1Ljg1NSAyMi4zOTNsLS4wOTUtLjA5NSIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Im0yMjEuNTAzIDIxMC4zMjRjLTEwNS4yMzUgNTAuMDgzLTE3MC41NDUgOC4xOC0yMTIuMzUyLTE3LjI3MS0yLjU4Ny0xLjYwNC02Ljk4NC4zNzUtMy4xNjkgNC43NTcgMTMuOTI4IDE2Ljg4OCA1OS41NzMgNTcuNTkzIDExOS4xNTMgNTcuNTkzIDU5LjYyMSAwIDk1LjA5LTMyLjUzMiA5OS41MjctMzguMjA3IDQuNDA3LTUuNjI3IDEuMjk0LTguNzMxLTMuMTYtNi44NzJ6bTI5LjU1NS0xNi4zMjJjLTIuODI2LTMuNjgtMTcuMTg0LTQuMzY2LTI2LjIyLTMuMjU2LTkuMDUgMS4wNzgtMjIuNjM0IDYuNjA5LTIxLjQ1MyA5LjkzLjYwNiAxLjI0NCAxLjg0My42ODYgOC4wNi4xMjcgNi4yMzQtLjYyMiAyMy42OTgtMi44MjYgMjcuMzM3IDEuOTMxIDMuNjU2IDQuNzktNS41NyAyNy42MDgtNy4yNTUgMzEuMjg4LTEuNjI4IDMuNjguNjIyIDQuNjI5IDMuNjggMi4xNzggMy4wMTYtMi40NSA4LjQ3Ni04Ljc5NSAxMi4xNC0xNy43NzQgMy42MzktOS4wMjggNS44NTgtMjEuNjIyIDMuNzEtMjQuNDI0eiIgZmlsbD0iI2Y5MCIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0ibTE1MC43NDQgMTA4LjEzYzAgMTMuMTQxLjMzMiAyNC4xLTYuMzEgMzUuNzctNS4zNjEgOS40ODktMTMuODUzIDE1LjMyNC0yMy4zNDEgMTUuMzI0LTEyLjk1MiAwLTIwLjQ5NS05Ljg2OC0yMC40OTUtMjQuNDMyIDAtMjguNzUgMjUuNzYtMzMuOTY4IDUwLjE0Ni0zMy45Njh6bTM0LjAxNSA4Mi4yMTZjLTIuMjMgMS45OTItNS40NTYgMi4xMzUtNy45Ny44MDYtMTEuMTk2LTkuMjk4LTEzLjE4OS0xMy42MTUtMTkuMzU2LTIyLjQ4Ny0xOC41MDIgMTguODgyLTMxLjU5NiAyNC41MjctNTUuNjAxIDI0LjUyNy0yOC4zNyAwLTUwLjQ3OC0xNy41MDYtNTAuNDc4LTUyLjU2NSAwLTI3LjM3MyAxNC44NS00Ni4wMTggMzUuOTYtNTUuMTI2IDE4LjMxMy04LjA2NiA0My44ODQtOS40ODkgNjMuNDMtMTEuNzE4di00LjM2NWMwLTguMDE4LjYxNi0xNy41MDYtNC4wOC0yNC40MzItNC4xMjgtNi4yMTUtMTIuMDAzLTguNzc3LTE4LjkzLTguNzc3LTEyLjg1NiAwLTI0LjMzNyA2LjU5NC0yNy4xMzYgMjAuMjU3LS41NyAzLjAzNy0yLjc5OSA2LjAyNi01LjgzNSA2LjE2OGwtMzIuNzM1LTMuNTFjLTIuNzUxLS42MTgtNS43ODctMi44NDctNS4wMjgtNy4wNyA3LjU0My0zOS42NiA0My4zNi01MS42MTYgNzUuNDMtNTEuNjE2IDE2LjQxNSAwIDM3Ljg1OCA0LjM2NSA1MC44MSAxNi43OTUgMTYuNDE1IDE1LjMyMyAxNC44NDkgMzUuNzcgMTQuODQ5IDU4LjAydjUyLjU2NWMwIDE1Ljc5OCA2LjU0NyAyMi43MjQgMTIuNzE0IDMxLjI2NCAyLjE4MiAzLjAzNiAyLjY1NyA2LjY5LS4wOTUgOC45NjYtNi44NzkgNS43NC0xOS4xMTkgMTYuNDE1LTI1Ljg1NSAyMi4zOTNsLS4wOTUtLjA5NSIgZmlsbD0iIzAwMCIvPjwvZz48L3N2Zz4=',
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
