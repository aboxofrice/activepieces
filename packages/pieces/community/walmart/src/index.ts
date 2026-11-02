import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { acknowledgeOrder } from './lib/actions/acknowledge-order';
import { bulkUpdatePrice } from './lib/actions/bulk-update-price';
import { bulkUpdateInventory } from './lib/actions/bulk-update-inventory';
import { cancelOrderLines } from './lib/actions/cancel-order-lines';
import { getFeedStatus } from './lib/actions/get-feed-status';
import { getInventory } from './lib/actions/get-inventory';
import { getItem } from './lib/actions/get-item';
import { getOrder } from './lib/actions/get-order';
import { getReportStatus } from './lib/actions/get-report-status';
import { getReturn } from './lib/actions/get-return';
import { getSellerResponseRate } from './lib/actions/get-seller-response-rate';
import { listItems } from './lib/actions/list-items';
import { listOrders } from './lib/actions/list-orders';
import { listReturns } from './lib/actions/list-returns';
import { refundOrderLines } from './lib/actions/refund-order-lines';
import { requestReport } from './lib/actions/request-report';
import { searchCatalog } from './lib/actions/search-catalog';
import { shipOrderLines } from './lib/actions/ship-order-lines';
import { updateInventory } from './lib/actions/update-inventory';
import { updatePrice } from './lib/actions/update-price';
import { walmartAuth, walmartAuthProps } from './lib/auth';
import { walmartClient } from './lib/common/client';
import { newOrder } from './lib/triggers/new-order';

export const walmart = createPiece({
    displayName: 'Walmart Marketplace',
    description: 'Walmart Marketplace seller API: orders, fulfillment, refunds, returns, listings, prices and inventory.',
    minimumSupportedRelease: '0.36.1',
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI0IiBmaWxsPSIjMDA3MURDIi8+PGcgZmlsbD0iI0ZGQzIyMCI+PHJlY3QgeD0iNTYiIHk9IjEwIiB3aWR0aD0iMTYiIGhlaWdodD0iNDAiIHJ4PSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgwIDY0IDY0KSIvPjxyZWN0IHg9IjU2IiB5PSIxMCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjQwIiByeD0iOCIgdHJhbnNmb3JtPSJyb3RhdGUoNjAgNjQgNjQpIi8+PHJlY3QgeD0iNTYiIHk9IjEwIiB3aWR0aD0iMTYiIGhlaWdodD0iNDAiIHJ4PSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgxMjAgNjQgNjQpIi8+PHJlY3QgeD0iNTYiIHk9IjEwIiB3aWR0aD0iMTYiIGhlaWdodD0iNDAiIHJ4PSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgNjQgNjQpIi8+PHJlY3QgeD0iNTYiIHk9IjEwIiB3aWR0aD0iMTYiIGhlaWdodD0iNDAiIHJ4PSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgyNDAgNjQgNjQpIi8+PHJlY3QgeD0iNTYiIHk9IjEwIiB3aWR0aD0iMTYiIGhlaWdodD0iNDAiIHJ4PSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgzMDAgNjQgNjQpIi8+PC9nPjwvc3ZnPg==',
    categories: [PieceCategory.COMMERCE],
    auth: walmartAuth,
    authors: ['vqnguyen1'],
    actions: [
        listOrders,
        getOrder,
        acknowledgeOrder,
        shipOrderLines,
        cancelOrderLines,
        refundOrderLines,
        listReturns,
        getReturn,
        listItems,
        getItem,
        searchCatalog,
        updatePrice,
        bulkUpdatePrice,
        getInventory,
        updateInventory,
        bulkUpdateInventory,
        getFeedStatus,
        requestReport,
        getReportStatus,
        getSellerResponseRate,
        createCustomApiCallAction({
            auth: walmartAuth,
            baseUrl: (auth) => (auth ? walmartClient.apiBase({ auth: walmartAuthProps(auth) }) : ''),
            authMapping: async (auth) => ({
                ...walmartClient.baseHeaders(),
                'WM_SEC.ACCESS_TOKEN': await walmartClient.getToken({ auth: walmartAuthProps(auth) }),
            }),
        }),
    ],
    triggers: [newOrder],
});
