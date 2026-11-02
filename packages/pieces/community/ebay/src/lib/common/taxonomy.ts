import { Property } from '@activepieces/pieces-framework';

function categoryTreeProp() {
    return Property.StaticDropdown({
        displayName: 'Marketplace Category Tree',
        description: 'Parts & Accessories compatibility lives in the eBay Motors US tree (100).',
        required: true,
        defaultValue: '100',
        options: {
            options: [
                { label: 'eBay Motors US (100)', value: '100' },
                { label: 'eBay US (0)', value: '0' },
                { label: 'eBay UK (3)', value: '3' },
                { label: 'eBay Germany (77)', value: '77' },
                { label: 'eBay Australia (15)', value: '15' },
                { label: 'eBay Canada (2)', value: '2' },
            ],
        },
    });
}

function categoryIdProp() {
    return Property.ShortText({
        displayName: 'Category ID',
        description: 'A leaf category that supports compatibility, e.g. 33567 (Car & Truck Brake Pads). Listing · Get Listing Details returns a listing\'s category_id.',
        required: true,
    });
}

export const taxonomyCommon = {
    basePath: '/commerce/taxonomy/v1/category_tree',
    categoryTreeProp,
    categoryIdProp,
};
