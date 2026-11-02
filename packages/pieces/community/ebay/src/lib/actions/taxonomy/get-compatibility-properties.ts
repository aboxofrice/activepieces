import { HttpMethod } from '@activepieces/pieces-common';
import { createAction } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { taxonomyCommon } from '../../common/taxonomy';

export const getCompatibilityProperties = createAction({
    auth: ebayAuth,
    name: 'taxonomy_get_compatibility_properties',
    displayName: 'Fitment · Get Compatibility Properties',
    description: 'List the vehicle properties (e.g. Year, Make, Model, Trim, Engine) a category uses for its compatibility table.',
    props: {
        categoryTreeId: taxonomyCommon.categoryTreeProp(),
        categoryId: taxonomyCommon.categoryIdProp(),
    },
    async run(context) {
        const { categoryTreeId, categoryId } = context.propsValue;
        const response = await ebayClient.request<{ compatibilityProperties?: { name?: string; localizedName?: string }[] }>({
            auth: context.auth.props,
            tokenType: 'application',
            method: HttpMethod.GET,
            path: `${taxonomyCommon.basePath}/${encodeURIComponent(categoryTreeId)}/get_compatibility_properties`,
            queryParams: { category_id: categoryId.trim() },
        });
        return {
            category_id: categoryId.trim(),
            properties: (response.compatibilityProperties ?? []).map((property) => ({
                name: property.name ?? null,
                localized_name: property.localizedName ?? null,
            })),
        };
    },
});
