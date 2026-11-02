import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { taxonomyCommon } from '../../common/taxonomy';

export const getCompatibilityPropertyValues = createAction({
    auth: ebayAuth,
    name: 'taxonomy_get_compatibility_property_values',
    displayName: 'Fitment · Get Compatibility Property Values',
    description: 'List eBay\'s exact values for one vehicle property, narrowed by the others — e.g. every Model eBay has for a 2019 Ram. Use these values when building a fitment table.',
    props: {
        categoryTreeId: taxonomyCommon.categoryTreeProp(),
        categoryId: taxonomyCommon.categoryIdProp(),
        property: Property.ShortText({
            displayName: 'Property to List',
            description: 'The property whose values you want, exactly as Get Compatibility Properties names it, e.g. Make, Model, Trim, Engine.',
            required: true,
        }),
        year: Property.ShortText({ displayName: 'Year', required: false }),
        make: Property.ShortText({ displayName: 'Make', required: false }),
        model: Property.ShortText({ displayName: 'Model', required: false }),
        trim: Property.ShortText({ displayName: 'Trim', required: false }),
        extraFilters: Property.Object({
            displayName: 'Other Filters',
            description: 'Any other property → value pairs to narrow by, e.g. Submodel.',
            required: false,
        }),
    },
    async run(context) {
        const { categoryTreeId, categoryId, property, year, make, model, trim, extraFilters } = context.propsValue;
        const filters = [
            ['Year', year],
            ['Make', make],
            ['Model', model],
            ['Trim', trim],
            ...Object.entries(extraFilters ?? {}).map(([name, value]) => [name, typeof value === 'string' || typeof value === 'number' ? String(value) : undefined]),
        ].filter((pair): pair is [string, string] => typeof pair[1] === 'string' && pair[1].trim() !== '' && pair[0] !== property);
        const response = await ebayClient.request<{ compatibilityPropertyValues?: { value?: string }[] }>({
            auth: context.auth.props,
            tokenType: 'application',
            method: HttpMethod.GET,
            path: `${taxonomyCommon.basePath}/${encodeURIComponent(categoryTreeId)}/get_compatibility_property_values`,
            queryParams: {
                category_id: categoryId.trim(),
                compatibility_property: property.trim(),
                // eBay expects commas inside a value to be escaped with a backslash.
                filter: filters.map(([name, value]) => `${name}:${value.trim().replace(/,/g, '\\,')}`).join(',') || undefined,
            },
        });
        const values = (response.compatibilityPropertyValues ?? []).map((entry) => entry.value).filter((value): value is string => typeof value === 'string');
        return { property: property.trim(), count: values.length, values };
    },
});
