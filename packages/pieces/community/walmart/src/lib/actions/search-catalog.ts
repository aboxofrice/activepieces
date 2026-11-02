import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartItems } from '../common/items';

export const searchCatalog = createAction({
    auth: walmartAuth,
    name: 'search_catalog',
    displayName: 'Search Walmart Catalog',
    description: 'Search the public Walmart.com catalog by keywords, GTIN or UPC. Returns title, brand, price and the listing description as plain text.',
    props: {
        query: Property.ShortText({
            displayName: 'Keywords',
            description: 'e.g. "Mopar 68079412AE". Leave empty when searching by GTIN or UPC.',
            required: false,
        }),
        gtin: Property.ShortText({
            displayName: 'GTIN',
            required: false,
        }),
        upc: Property.ShortText({
            displayName: 'UPC',
            required: false,
        }),
    },
    async run(context) {
        const query = context.propsValue.query?.trim() || undefined;
        const gtin = context.propsValue.gtin?.trim() || undefined;
        const upc = context.propsValue.upc?.trim() || undefined;
        if (!query && !gtin && !upc) {
            throw new Error('Enter keywords, a GTIN or a UPC.');
        }
        return walmartItems.searchCatalog({ auth: walmartAuthProps(context.auth), query, gtin, upc });
    },
});
