import { HttpMethod } from '@activepieces/pieces-common';
import { AmazonSellerAuthProps, spApiClient } from './client';

async function getCatalogItem({ auth, asin, marketplaceId }: { auth: AmazonSellerAuthProps; asin: string; marketplaceId: string }): Promise<CatalogItem> {
    return spApiClient.request<CatalogItem>({
        auth,
        method: HttpMethod.GET,
        path: `/catalog/2022-04-01/items/${encodeURIComponent(asin.trim())}`,
        queryParams: { marketplaceIds: [marketplaceId], includedData: CATALOG_INCLUDED_DATA },
    });
}

async function searchCatalogItems({ auth, marketplaceId, keywords, identifiers, identifiersType, brandNames, sellerId, maxRows }: SearchCatalogParams): Promise<CatalogItem[]> {
    return spApiClient.fetchPages<CatalogSearchPage, CatalogItem>({
        maxRows,
        fetchPage: ({ nextToken }) => spApiClient.request({
            auth,
            method: HttpMethod.GET,
            path: '/catalog/2022-04-01/items',
            queryParams: {
                marketplaceIds: [marketplaceId],
                includedData: CATALOG_INCLUDED_DATA,
                keywords,
                identifiers,
                identifiersType: identifiers && identifiers.length > 0 ? identifiersType : undefined,
                brandNames,
                sellerId: identifiersType === 'SKU' ? sellerId : undefined,
                pageSize: MAX_CATALOG_PAGE_SIZE,
                pageToken: nextToken,
            },
        }),
        rowsOf: ({ page }) => page.items ?? [],
        nextTokenOf: ({ page }) => page.pagination?.nextToken,
    });
}

function flattenCatalogItem({ item, marketplaceId }: { item: CatalogItem; marketplaceId: string }): FlatCatalogItem {
    const summary = item.summaries?.find((entry) => entry.marketplaceId === marketplaceId) ?? item.summaries?.[0];
    const productType = item.productTypes?.find((entry) => entry.marketplaceId === marketplaceId) ?? item.productTypes?.[0];
    const images = item.images?.find((entry) => entry.marketplaceId === marketplaceId) ?? item.images?.[0];
    const mainImage = images?.images?.find((image) => image.variant === 'MAIN') ?? images?.images?.[0];
    const salesRank = (item.salesRanks?.find((entry) => entry.marketplaceId === marketplaceId) ?? item.salesRanks?.[0])?.displayGroupRanks?.[0];
    const attrs = item.attributes ?? {};
    return {
        asin: item.asin,
        item_name: summary?.itemName ?? firstValue({ attrs, key: 'item_name' }),
        brand: summary?.brand ?? firstValue({ attrs, key: 'brand' }),
        manufacturer: summary?.manufacturer ?? firstValue({ attrs, key: 'manufacturer' }),
        product_type: productType?.productType ?? null,
        browse_category: summary?.browseClassification?.displayName ?? null,
        part_number: summary?.partNumber ?? firstValue({ attrs, key: 'part_number' }),
        model_number: summary?.modelNumber ?? firstValue({ attrs, key: 'model_number' }),
        oem_equivalent_part_numbers: allValues({ attrs, key: 'oem_equivalent_part_number' }).join(', '),
        oe_manufacturer: firstValue({ attrs, key: 'oe_manufacturer' }),
        automotive_fit_type: firstValue({ attrs, key: 'automotive_fit_type' }),
        compatibility_options: allValues({ attrs, key: 'compatibility_options' }).join(' | '),
        compatible_vehicle_types: allValues({ attrs, key: 'compatible_with_vehicle_type' }).join(', '),
        main_image_url: mainImage?.link ?? null,
        sales_rank: salesRank?.rank ?? null,
        sales_rank_category: salesRank?.title ?? null,
    };
}

// Amazon attribute values are lists of { value, marketplace_id, language_tag }.
function allValues({ attrs, key }: { attrs: Record<string, unknown>; key: string }): string[] {
    const entries = attrs[key];
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .map((entry) => (spApiClient.isRecord(entry) ? entry['value'] : undefined))
        .filter((value): value is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof value))
        .map((value) => String(value));
}

function firstValue({ attrs, key }: { attrs: Record<string, unknown>; key: string }): string | null {
    return allValues({ attrs, key })[0] ?? null;
}

const CATALOG_INCLUDED_DATA = ['summaries', 'attributes', 'productTypes', 'images', 'salesRanks'];
const MAX_CATALOG_PAGE_SIZE = 20;

export const amazonCatalog = { getCatalogItem, searchCatalogItems, flattenCatalogItem, allValues };

export const IDENTIFIER_TYPES = [
    { label: 'ASIN', value: 'ASIN' },
    { label: 'Your SKU', value: 'SKU' },
    { label: 'UPC', value: 'UPC' },
    { label: 'EAN', value: 'EAN' },
    { label: 'GTIN', value: 'GTIN' },
    { label: 'ISBN', value: 'ISBN' },
    { label: 'JAN', value: 'JAN' },
];

export type CatalogItem = {
    asin: string;
    attributes?: Record<string, unknown>;
    summaries?: {
        marketplaceId?: string;
        itemName?: string;
        brand?: string;
        manufacturer?: string;
        partNumber?: string;
        modelNumber?: string;
        browseClassification?: { displayName?: string };
    }[];
    productTypes?: { marketplaceId?: string; productType?: string }[];
    images?: { marketplaceId?: string; images?: { variant?: string; link?: string }[] }[];
    salesRanks?: { marketplaceId?: string; displayGroupRanks?: { title?: string; rank?: number }[] }[];
};

export type FlatCatalogItem = {
    asin: string;
    item_name: string | null;
    brand: string | null;
    manufacturer: string | null;
    product_type: string | null;
    browse_category: string | null;
    part_number: string | null;
    model_number: string | null;
    oem_equivalent_part_numbers: string;
    oe_manufacturer: string | null;
    automotive_fit_type: string | null;
    compatibility_options: string;
    compatible_vehicle_types: string;
    main_image_url: string | null;
    sales_rank: number | null;
    sales_rank_category: string | null;
};

type CatalogSearchPage = { items?: CatalogItem[]; pagination?: { nextToken?: string } };

type SearchCatalogParams = {
    auth: AmazonSellerAuthProps;
    marketplaceId: string;
    keywords?: string[];
    identifiers?: string[];
    identifiersType?: string;
    brandNames?: string[];
    sellerId?: string;
    maxRows: number;
};
