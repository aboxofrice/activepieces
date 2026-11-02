import { createAction, Property } from '@activepieces/pieces-framework';
import { isNil } from '@activepieces/shared';
import { sellercloudAuth, sellercloudAuthProps } from '../auth';
import { sellercloudClient } from '../common/client';
import { sellercloudDropdowns } from '../common/dropdowns';
import { sellercloudListing } from '../common/listing';
import { SellercloudCatalogProduct, sellercloudRecords } from '../common/records';

export const findProducts = createAction({
    auth: sellercloudAuth,
    name: 'find_products',
    displayName: 'Find Products',
    description: 'Search the SellerCloud catalog by SKU, manufacturer part number or keyword, optionally limited to a brand or company.',
    props: {
        searchBy: Property.StaticDropdown({
            displayName: 'Search By',
            required: true,
            defaultValue: 'KEYWORD',
            options: {
                options: [
                    { label: 'Keyword (name, SKU, part number…)', value: 'KEYWORD' },
                    { label: 'SKU (exact)', value: 'SKU' },
                    { label: 'Manufacturer Part Number', value: 'MPN' },
                    { label: 'Brand only (no search text)', value: 'BRAND' },
                ],
            },
        }),
        query: Property.ShortText({
            displayName: 'Search Text',
            description: 'The keyword, SKU or part number to look for. Not needed for "Brand only".',
            required: false,
        }),
        brand: sellercloudDropdowns.brand,
        companies: sellercloudDropdowns.companies({ required: false, description: 'Only return products of these companies (stores). Leave empty for all.' }),
        otherCompanyIds: sellercloudDropdowns.otherCompanyIds,
        activeOnly: Property.Checkbox({
            displayName: 'Active Products Only',
            required: false,
            defaultValue: false,
        }),
        limit: Property.Number({
            displayName: 'Max Results',
            description: 'At most 200.',
            required: false,
            defaultValue: 25,
        }),
    },
    async run(context) {
        const { searchBy, query, brand, companies, otherCompanyIds, activeOnly, limit } = context.propsValue;
        const text = (query ?? '').trim();
        if (searchBy !== 'BRAND' && text === '') {
            throw new Error('SellerCloud: enter the search text.');
        }
        if (searchBy === 'BRAND' && isNil(brand)) {
            throw new Error('SellerCloud: pick a brand for a brand-only search.');
        }
        const max = Math.min(MAX_RESULTS, Math.max(1, limit ?? 25));
        const auth = sellercloudAuthProps(context.auth);
        const token = await sellercloudClient.getToken({ auth, store: context.store });
        const { items, total, truncated } = await sellercloudListing.listPages<SellercloudCatalogProduct>({
            auth,
            token,
            path: '/Catalog',
            query: {
                // Keyword search covers the manufacturer part number; exact matching on it is done below.
                'model.keyword': searchBy === 'KEYWORD' || searchBy === 'MPN' ? text : undefined,
                'model.sKU': searchBy === 'SKU' ? text : undefined,
                'model.activeStatus': activeOnly ? 1 : undefined,
            },
            arrayQuery: {
                'model.brandIds': isNil(brand) ? undefined : [Number(brand)],
                'model.companyID': sellercloudDropdowns.resolveCompanyIds({ selected: companies, other: otherCompanyIds }),
            },
            // A part-number search filters keyword matches afterwards, so the exact ones can sit
            // past the first pages; read further than the result count needs.
            maxPages: searchBy === 'MPN' ? Math.max(MPN_SCAN_PAGES, Math.ceil(max / sellercloudListing.PAGE_SIZE)) : Math.ceil(max / sellercloudListing.PAGE_SIZE),
        });
        const matched = searchBy === 'MPN' ? items.filter((product) => mpnMatches({ candidate: product.ManufacturerSKU, query: text })) : items;
        const products = matched.slice(0, max).map((product) => sellercloudRecords.flattenProduct({ product }));
        return {
            count: products.length,
            total_matches: searchBy === 'MPN' ? matched.length : total,
            // For a part-number search: more keyword matches existed than were scanned, so
            // further exact matches (or the only one) may exist.
            search_truncated: searchBy === 'MPN' ? truncated : matched.length > max || total > items.length,
            products,
        };
    },
});

// Part numbers are stored inconsistently (dashes, spaces, a leading 0), so compare the
// alphanumerics and accept a match that only differs by leading zeros.
function mpnMatches({ candidate, query }: { candidate: string | null | undefined; query: string }): boolean {
    const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
    return !isNil(candidate) && candidate !== '' && normalize(candidate) === normalize(query);
}

const MAX_RESULTS = 200;
const MPN_SCAN_PAGES = 10;
