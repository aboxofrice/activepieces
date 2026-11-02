import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { productTypes, REQUIREMENT_SETS } from '../common/product-types';
import { amazonProps } from '../common/props';

export const getProductTypeDefinition = createAction({
    auth: amazonSellerAuth,
    name: 'get_product_type_definition',
    displayName: 'Get Product Type Requirements',
    description: 'Get what Amazon requires to list a product type (e.g. AUTO_PART): attribute groups, required attributes and the JSON schema link. Search by item name if you do not know the type.',
    props: {
        productType: Property.ShortText({
            displayName: 'Product Type',
            description: 'e.g. AUTO_PART, VEHICLE_EMBLEM. Leave empty and fill Item Name to find matching types instead.',
            required: false,
        }),
        itemName: Property.ShortText({
            displayName: 'Item Name (to find the type)',
            description: 'A product title, e.g. "Ford oil separator assembly". Returns suggested product types.',
            required: false,
        }),
        requirements: Property.StaticDropdown({
            displayName: 'Requirements',
            required: false,
            defaultValue: 'LISTING',
            options: { options: REQUIREMENT_SETS },
        }),
        includeAttributes: Property.Checkbox({
            displayName: 'Include Attribute List',
            description: 'Downloads the schema and lists every attribute with its title, description and whether it is required.',
            required: false,
            defaultValue: true,
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const marketplaceId = amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId });
        const productType = context.propsValue.productType?.trim();
        if (!productType) {
            const itemName = context.propsValue.itemName?.trim();
            if (!itemName) {
                throw new Error('Give a Product Type, or an Item Name to search for one.');
            }
            return { suggestions: await productTypes.searchProductTypes({ auth, marketplaceId, itemName }) };
        }
        return productTypes.getDefinition({
            auth,
            marketplaceId,
            productType,
            requirements: context.propsValue.requirements ?? 'LISTING',
            includeAttributes: context.propsValue.includeAttributes ?? true,
        });
    },
});
