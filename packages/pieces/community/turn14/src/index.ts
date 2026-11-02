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
import { turn14CustomCall } from './lib/common/custom-call';
import { inventoryChanged } from './lib/triggers/inventory-changed';
import { newInvoice } from './lib/triggers/new-invoice';
import { orderShipped } from './lib/triggers/order-shipped';
import { priceChanged } from './lib/triggers/price-changed';

export const turn14 = createPiece({
    displayName: 'Turn 14 Distribution',
    description: 'Performance auto-parts distributor: catalog, fitment, warehouse inventory, dealer pricing, quotes, orders, invoices and tracking.',
    minimumSupportedRelease: '0.36.1',
    logoUrl: 'data:image/webp;base64,UklGRpQEAABXRUJQVlA4WAoAAAAQAAAAfwAAfwAAQUxQSBQAAAABD/Co/4iIICBJ7P/+IKL/EQDg91ZQOCBaBAAAUBwAnQEqgACAAD5RJpBFI6IhlUkkYDgFBKANalzP4B2oEOulfkV+S3Ska491f4n+xOZv8Nf5n7dPoX+mfsA8wD9WfRz6JPMB+qv+k/jvszfrN7p/0z9gD9SesP9AD9hPSt9lz9nfSK1Z1f/9oroqx3Y8RpXcPWko9/QM0Nq0yDhsQ3mbA9lWxcgdYkIemolD/SisaF8z3kIXLfTisyuYJBN3Pny7EiwvTPxj4sGIpy6ppC9jBWUJgm4bd+NDPeusDLdqvKBRq6yaqjPNdgaF2syI4hFUPW9dXVkoKY4XUqDlnb2J9zlYuAVC4AD+3FH+wMREz28f4a14a14a1wv4ADv+r7n4FjlkkPWLaFmN5qM+h+423IDZiN2E4/StLT8ecpF8QhwWTn49WewTrYL7ZMGH9K/o0qgEt5gekFG+pYzaDjZRioca1RkZlEoTGm7iAT89r7y9AiuCNzUDAx8gGWQFYhlKgkKuDDGCWmBsOPud8FuvvS37F0pk2kjjudEdkBpLM+QpJNeHAHpKLq3D32IDNEwAsFaD3rwnvl50oSjjsawGe/QZARq8fhd3Sg7hdb1Ey6ndR74ZrzqEREZ+QwzPIoA+Ipb2/dDl24h/xDMYOLn7rPnuOp4L38XFrgNtZ9U4iQnR0sPS/+3DM6X0Fvv/Ges6MbuePIe3P+9fM808ZcRXP+zl1pAueX6dCO7zuJRzcA9n9xjyQVdNJmQPA6wZi/ElDHRaS90WWRrd5LJPU4wr5E4QvYLRv6laZ5QySkWLCf2E5A3ozfFVGrp745MWHJETgRidgj+E55z0Bz+bO+kmH4aZTaom+14gQEK6O38t6vx8bXDau1lz09heGxP4h16l5je0F5bV30POozJrXa+qCJ9E9HZa1pAgY/vHHjbLqJGgzygOwudWlOT6QquFjsoFxOOUM309v+0Z90qHLKD/9WlMEW9vIRsx+nEjrnp3U8AFT9Lhp0cR++PnPqaP32/kPsHrcWDRMoY641YGl3mv/P9qTLadCC312OF4zKoHC5b6DF5lAJYLmQ+x5X1vszXioyrOWi/UAEsMwMQwKfuQIfy/oiDQIHxzN311tE8UXZ6rzZ62DFkoZTzFushBglfpjsfIrC4A82cU/T/TMtMuABU2lh6zaI3WpMaCB90aJorbqHfAdbdq92c9gFWNfHnZcQuS6Nr4aqnN/MvgBM9uPZS8NQNi951sdSj9/R6eZFi72SuIB9rSJMhDh5ZajvB1BLTOCr0pMsfXd4k60aYATS4hN5tyKgzSjyAlFtOWl8dQG44ke2UuIOH2rBYlUZsreAxbN+EyLWGSu59vErQvBpLgR1xVSg+xPcJQgwMnCZP5f5kyqyWUf9u+s427w7C1yUAIm1js8zVuVFNRVER5hfqZQFJ8GwewwdaxeJKEowEc7s9Xl58GpLfFPIo1U78RlGenOwy5wBPKEwC++H/nq+0HdFhbtypbeZCRgUEZmAAAAAAAAA==',
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
            // Runs before the request is sent, so a refused call never reaches Turn14.
            authMapping: async (auth, propsValue) => {
                turn14CustomCall.assertAllowed({ propsValue });
                return { Authorization: `Bearer ${await turn14Client.getToken({ auth: turn14AuthProps(auth) })}` };
            },
            description: 'Call any Turn14 endpoint, e.g. GET /items/data/brand/{brand_id}. The path is relative to /v1. Read-only: only GET is sent; every other method is refused. Use Create Shipping Quote / Place Order From Quote for quotes and orders, which carry the Testing/Production guard, the live-order confirmation and the duplicate-order checks.',
        }),
    ],
    triggers: [inventoryChanged, priceChanged, newInvoice, orderShipped],
});
