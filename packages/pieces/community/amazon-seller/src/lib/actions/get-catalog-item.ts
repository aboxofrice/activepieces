import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonCatalog } from '../common/catalog';
import { amazonProps } from '../common/props';

export const getCatalogItem = createAction({
    auth: amazonSellerAuth,
    name: 'get_catalog_item',
    displayName: 'Get Catalog Item',
    description: 'Look up an ASIN in the Amazon catalog: title, brand, part numbers, product type, automotive fit type and compatibility text, image and sales rank.',
    props: {
        asin: Property.ShortText({ displayName: 'ASIN', required: true }),
        includeAllAttributes: Property.Checkbox({
            displayName: 'Include All Attributes',
            description: 'Adds the full raw attribute set (nested) as `attributes`.',
            required: false,
            defaultValue: false,
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const marketplaceId = amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId });
        const item = await amazonCatalog.getCatalogItem({ auth, asin: context.propsValue.asin, marketplaceId });
        const flat = amazonCatalog.flattenCatalogItem({ item, marketplaceId });
        return context.propsValue.includeAllAttributes ? { ...flat, attributes: item.attributes ?? {} } : flat;
    },
});
