import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { createQuote } from './lib/actions/create-quote';
import { getInventory } from './lib/actions/get-inventory';
import { getInvoice } from './lib/actions/get-invoice';
import { getItem } from './lib/actions/get-item';
import { getItemFitment } from './lib/actions/get-item-fitment';
import { getOrder } from './lib/actions/get-order';
import { getPriceChanges } from './lib/actions/get-price-changes';
import { getPricing } from './lib/actions/get-pricing';
import { getTracking } from './lib/actions/get-tracking';
import { listBrands } from './lib/actions/list-brands';
import { listInvoices } from './lib/actions/list-invoices';
import { listLocations } from './lib/actions/list-locations';
import { listOrders } from './lib/actions/list-orders';
import { listShippingMethods } from './lib/actions/list-shipping-methods';
import { placeOrderFromQuote } from './lib/actions/place-order-from-quote';
import { searchItems } from './lib/actions/search-items';
import { turn14Auth, turn14AuthProps } from './lib/auth';
import { turn14Client } from './lib/common/client';
import { inventoryChanged } from './lib/triggers/inventory-changed';
import { newInvoice } from './lib/triggers/new-invoice';
import { orderShipped } from './lib/triggers/order-shipped';
import { priceChanged } from './lib/triggers/price-changed';

export const turn14 = createPiece({
    displayName: 'Turn 14 Distribution',
    description: 'Performance auto-parts distributor: catalog, fitment, warehouse inventory, dealer pricing, quotes, orders, invoices and tracking.',
    minimumSupportedRelease: '0.36.1',
    logoUrl: 'https://d3d64niazt77mx.cloudfront.net/images/apple_icons/apple-touch-icon-152x152.png',
    categories: [PieceCategory.COMMERCE],
    auth: turn14Auth,
    authors: ['vqnguyen1'],
    actions: [
        searchItems,
        getItem,
        getItemFitment,
        getInventory,
        getPricing,
        getPriceChanges,
        listBrands,
        listLocations,
        listShippingMethods,
        listInvoices,
        getInvoice,
        listOrders,
        getOrder,
        getTracking,
        createQuote,
        placeOrderFromQuote,
        createCustomApiCallAction({
            auth: turn14Auth,
            baseUrl: (auth) => (auth ? `${turn14Client.apiBase({ auth: turn14AuthProps(auth) })}/v1` : ''),
            authMapping: async (auth) => ({
                Authorization: `Bearer ${await turn14Client.getToken({ auth: turn14AuthProps(auth) })}`,
            }),
            description: 'Call any Turn14 endpoint, e.g. GET /items/data/brand/{brand_id}. The path is relative to /v1. Warning: do not use this to create quotes or orders - it skips the Testing/Production guard, the live-order confirmation and the duplicate-order checks of Create Shipping Quote / Place Order From Quote, and a failed request may log its body (recipient name, address, phone).',
        }),
    ],
    triggers: [inventoryChanged, priceChanged, newInvoice, orderShipped],
});
