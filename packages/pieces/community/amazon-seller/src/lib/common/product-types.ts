import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { REQUEST_TIMEOUT_MS } from './retry';
import { AmazonSellerAuthProps, spApiClient } from './client';

async function searchProductTypes({ auth, marketplaceId, keywords, itemName }: SearchParams): Promise<{ name: string; display_name: string | null }[]> {
    const response = await spApiClient.request<{ productTypes?: { name: string; displayName?: string }[] }>({
        auth,
        method: HttpMethod.GET,
        path: '/definitions/2020-09-01/productTypes',
        queryParams: { marketplaceIds: [marketplaceId], keywords, itemName, locale: 'en_US', searchLocale: 'en_US' },
    });
    return (response.productTypes ?? []).map((type) => ({ name: type.name, display_name: type.displayName ?? null }));
}

async function getDefinition({ auth, marketplaceId, productType, requirements, includeAttributes }: GetDefinitionParams): Promise<ProductTypeSummary> {
    const definition = await spApiClient.request<ProductTypeDefinition>({
        auth,
        method: HttpMethod.GET,
        path: `/definitions/2020-09-01/productTypes/${encodeURIComponent(productType.trim().toUpperCase())}`,
        queryParams: { marketplaceIds: [marketplaceId], requirements, requirementsEnforced: 'ENFORCED', locale: 'en_US' },
    });
    const summary: ProductTypeSummary = {
        product_type: definition.productType,
        display_name: definition.displayName ?? null,
        version: definition.productTypeVersion?.version ?? null,
        requirements: definition.requirements ?? requirements,
        schema_url: definition.schema?.link?.resource ?? null,
        property_groups: Object.entries(definition.propertyGroups ?? {}).map(([group, value]) => ({
            group,
            title: value.title ?? null,
            property_names: (value.propertyNames ?? []).join(', '),
        })),
        required_attributes: null,
        attributes: null,
    };
    if (!includeAttributes || !summary.schema_url) {
        return summary;
    }
    // The schema lives behind a short-lived pre-signed S3 link that Amazon returns above.
    const schema = (await httpClient.sendRequest<JsonSchema>({ method: HttpMethod.GET, url: summary.schema_url, timeout: REQUEST_TIMEOUT_MS })).body;
    const required = schema.required ?? [];
    return {
        ...summary,
        required_attributes: required.join(', '),
        attributes: Object.entries(schema.properties ?? {}).map(([name, property]) => ({
            name,
            title: property.title ?? null,
            description: property.description ?? null,
            required: required.includes(name),
        })),
    };
}

export const productTypes = { searchProductTypes, getDefinition };

export const REQUIREMENT_SETS = [
    { label: 'Full listing (product + offer)', value: 'LISTING' },
    { label: 'Offer only (selling an existing ASIN)', value: 'LISTING_OFFER_ONLY' },
    { label: 'Product only (no offer)', value: 'LISTING_PRODUCT_ONLY' },
];

export type ProductTypeSummary = {
    product_type: string;
    display_name: string | null;
    version: string | null;
    requirements: string;
    schema_url: string | null;
    property_groups: { group: string; title: string | null; property_names: string }[];
    required_attributes: string | null;
    attributes: { name: string; title: string | null; description: string | null; required: boolean }[] | null;
};

type ProductTypeDefinition = {
    productType: string;
    displayName?: string;
    requirements?: string;
    productTypeVersion?: { version?: string };
    schema?: { link?: { resource?: string } };
    propertyGroups?: Record<string, { title?: string; propertyNames?: string[] }>;
};

type JsonSchema = {
    required?: string[];
    properties?: Record<string, { title?: string; description?: string }>;
};

type SearchParams = {
    auth: AmazonSellerAuthProps;
    marketplaceId: string;
    keywords?: string[];
    itemName?: string;
};

type GetDefinitionParams = {
    auth: AmazonSellerAuthProps;
    marketplaceId: string;
    productType: string;
    requirements: string;
    includeAttributes: boolean;
};
