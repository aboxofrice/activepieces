import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonCatalog, IDENTIFIER_TYPES } from '../common/catalog';
import { amazonProps } from '../common/props';

export const searchCatalog = createAction({
    auth: amazonSellerAuth,
    name: 'search_catalog_items',
    displayName: 'Search Catalog',
    description: 'Find catalog items by keywords (e.g. an OEM part number) or by identifiers (ASIN, UPC, EAN, your SKU...).',
    props: {
        keywords: Property.ShortText({
            displayName: 'Keywords',
            description: 'Words or a part number, e.g. "FC3Z-6A785-C". Use either Keywords or Identifiers.',
            required: false,
        }),
        identifiers: Property.Array({
            displayName: 'Identifiers',
            description: 'Up to 20 values of the type below.',
            required: false,
        }),
        identifiersType: Property.StaticDropdown({
            displayName: 'Identifier Type',
            required: false,
            defaultValue: 'ASIN',
            options: { options: IDENTIFIER_TYPES },
        }),
        brandNames: Property.Array({
            displayName: 'Brands',
            description: 'Optional brand filter for keyword searches, e.g. Ford, Mopar.',
            required: false,
        }),
        maxResults: Property.Number({ displayName: 'Maximum Results', required: false, defaultValue: 20 }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const marketplaceId = amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId });
        const keywords = context.propsValue.keywords?.trim();
        const identifiers = toStrings({ values: context.propsValue.identifiers });
        if (!keywords && identifiers.length === 0) {
            throw new Error('Give Keywords or at least one Identifier.');
        }
        if (keywords && identifiers.length > 0) {
            throw new Error('Amazon searches by Keywords or by Identifiers, not both.');
        }
        const identifiersType = context.propsValue.identifiersType ?? 'ASIN';
        const items = await amazonCatalog.searchCatalogItems({
            auth,
            marketplaceId,
            keywords: keywords ? [keywords] : undefined,
            identifiers: identifiers.length > 0 ? identifiers : undefined,
            identifiersType,
            brandNames: keywords ? toStrings({ values: context.propsValue.brandNames }) : undefined,
            sellerId: identifiersType === 'SKU' ? amazonProps.requireSellerId({ auth }) : undefined,
            maxRows: context.propsValue.maxResults ?? 20,
        });
        return items.map((item) => amazonCatalog.flattenCatalogItem({ item, marketplaceId }));
    },
});

function toStrings({ values }: { values: unknown[] | undefined | null }): string[] {
    return (values ?? []).map((value) => String(value).trim()).filter((value) => value.length > 0);
}
