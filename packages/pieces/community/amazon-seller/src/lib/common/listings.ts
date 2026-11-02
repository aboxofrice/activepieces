import { HttpMethod } from '@activepieces/pieces-common';
import { AmazonSellerAuthProps, spApiClient } from './client';
import { listingPatches, MFN_CHANNEL_CODE } from './listing-patches';

async function getListing({ auth, sellerId, sku, marketplaceId, includedData }: GetListingParams): Promise<ListingItem> {
    return spApiClient.request<ListingItem>({
        auth,
        method: HttpMethod.GET,
        path: listingPath({ sellerId, sku }),
        queryParams: { marketplaceIds: [marketplaceId], includedData },
    });
}

async function setFulfillmentQuantity({ quantity, handlingTime, marketplaceId, currentAttributes, ...target }: SetQuantityParams): Promise<ListingSubmission> {
    return patchListing({
        ...target,
        marketplaceId,
        patches: [
            {
                op: 'replace',
                path: '/attributes/fulfillment_availability',
                value: listingPatches.fulfillmentAvailability({ current: currentAttributes['fulfillment_availability'], marketplaceId, quantity, handlingTime }),
            },
        ],
    });
}

async function setPrice({ price, currency, minimumPrice, maximumPrice, marketplaceId, currentAttributes, ...target }: SetPriceParams): Promise<ListingSubmission> {
    return patchListing({
        ...target,
        marketplaceId,
        patches: [
            {
                op: 'replace',
                path: '/attributes/purchasable_offer',
                value: listingPatches.purchasableOffer({ current: currentAttributes['purchasable_offer'], marketplaceId, currency, price, minimumPrice, maximumPrice }),
            },
        ],
    });
}

async function patchListing({ auth, sellerId, sku, marketplaceId, productType, patches, validationOnly }: PatchListingParams): Promise<ListingSubmission> {
    return spApiClient.request<ListingSubmission>({
        auth,
        method: HttpMethod.PATCH,
        path: listingPath({ sellerId, sku }),
        queryParams: {
            marketplaceIds: [marketplaceId],
            mode: validationOnly ? 'VALIDATION_PREVIEW' : undefined,
            issueLocale: 'en_US',
        },
        body: { productType, patches },
    });
}

// A patch replaces whole attributes, so writes start from the listing's current attributes.
// Amazon also validates a patch against the product type's schema, so the listing's real type
// is sent; "PRODUCT" is the generic type Amazon accepts for offer-only attributes.
async function readForUpdate({ auth, sellerId, sku, marketplaceId }: ListingTarget): Promise<{ productType: string; attributes: Record<string, unknown> }> {
    const listing = await getListing({ auth, sellerId, sku, marketplaceId, includedData: ['summaries', 'attributes'] });
    return {
        productType: flattenListing({ listing, marketplaceId }).product_type ?? 'PRODUCT',
        attributes: listing.attributes ?? {},
    };
}

// An INVALID submission is a 200 with the reasons in `issues`; surfacing it as a failed step
// stops a flow from carrying on as if the change had been applied.
function submissionIssues({ submission, what }: { submission: ListingSubmission; what: string }): FlatIssue[] {
    const issues = (submission.issues ?? []).map((issue) => ({ code: issue.code ?? null, severity: issue.severity ?? null, message: issue.message ?? null }));
    if (submission.status === 'INVALID') {
        throw new Error(`Amazon rejected the ${what}: ${issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`);
    }
    return issues;
}

function flattenListing({ listing, marketplaceId }: { listing: ListingItem; marketplaceId: string }): FlatListing {
    const summary = listing.summaries?.find((entry) => entry.marketplaceId === marketplaceId) ?? listing.summaries?.[0];
    const mfn = listing.fulfillmentAvailability?.find((entry) => entry.fulfillmentChannelCode === MFN_CHANNEL_CODE);
    const offer = listing.offers?.find((entry) => entry.marketplaceId === marketplaceId) ?? listing.offers?.[0];
    const issues = listing.issues ?? [];
    return {
        sku: listing.sku,
        asin: summary?.asin ?? null,
        product_type: summary?.productType ?? null,
        item_name: summary?.itemName ?? null,
        status: summary?.status?.join(', ') ?? null,
        condition_type: summary?.conditionType ?? null,
        created_date: summary?.createdDate ?? null,
        last_updated_date: summary?.lastUpdatedDate ?? null,
        main_image_url: summary?.mainImage?.link ?? null,
        mfn_quantity: mfn?.quantity ?? null,
        fulfillment_channels: (listing.fulfillmentAvailability ?? []).map((entry) => entry.fulfillmentChannelCode).join(', '),
        offer_price_amount: offer?.price?.amount ?? null,
        offer_price_currency: offer?.price?.currencyCode ?? offer?.price?.currency ?? null,
        issues_count: issues.length,
        error_issues_count: issues.filter((issue) => issue.severity === 'ERROR').length,
        issues: issues.map((issue) => ({ code: issue.code ?? null, severity: issue.severity ?? null, message: issue.message ?? null })),
        fulfillment_availability: (listing.fulfillmentAvailability ?? []).map((entry) => ({
            fulfillment_channel_code: entry.fulfillmentChannelCode,
            quantity: entry.quantity ?? null,
        })),
        attributes: listing.attributes ?? null,
    };
}

function listingPath({ sellerId, sku }: { sellerId: string; sku: string }): string {
    return `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku.trim())}`;
}

export const amazonListings = { getListing, setFulfillmentQuantity, setPrice, readForUpdate, submissionIssues, flattenListing };

export const LISTING_INCLUDED_DATA = [
    { label: 'Summaries (ASIN, title, status, product type)', value: 'summaries' },
    { label: 'Fulfillment Availability (quantities)', value: 'fulfillmentAvailability' },
    { label: 'Offers (price)', value: 'offers' },
    { label: 'Issues', value: 'issues' },
    { label: 'Attributes (full listing data)', value: 'attributes' },
    { label: 'Procurement', value: 'procurement' },
];

export type ListingItem = {
    sku: string;
    summaries?: {
        marketplaceId?: string;
        asin?: string;
        productType?: string;
        conditionType?: string;
        status?: string[];
        itemName?: string;
        createdDate?: string;
        lastUpdatedDate?: string;
        mainImage?: { link?: string };
    }[];
    fulfillmentAvailability?: { fulfillmentChannelCode: string; quantity?: number }[];
    offers?: { marketplaceId?: string; offerType?: string; price?: { amount?: string; currencyCode?: string; currency?: string } }[];
    issues?: ListingIssue[];
    attributes?: Record<string, unknown>;
};

export type ListingSubmission = {
    sku: string;
    status: 'ACCEPTED' | 'INVALID' | 'VALID';
    submissionId: string;
    issues?: ListingIssue[];
};

export type FlatListing = {
    sku: string;
    asin: string | null;
    product_type: string | null;
    item_name: string | null;
    status: string | null;
    condition_type: string | null;
    created_date: string | null;
    last_updated_date: string | null;
    main_image_url: string | null;
    mfn_quantity: number | null;
    fulfillment_channels: string;
    offer_price_amount: string | null;
    offer_price_currency: string | null;
    issues_count: number;
    error_issues_count: number;
    issues: { code: string | null; severity: string | null; message: string | null }[];
    fulfillment_availability: { fulfillment_channel_code: string; quantity: number | null }[];
    attributes: Record<string, unknown> | null;
};

type FlatIssue = { code: string | null; severity: string | null; message: string | null };

type ListingIssue = { code?: string; message?: string; severity?: string; attributeNames?: string[] };

type GetListingParams = {
    auth: AmazonSellerAuthProps;
    sellerId: string;
    sku: string;
    marketplaceId: string;
    includedData: string[];
};

type ListingTarget = {
    auth: AmazonSellerAuthProps;
    sellerId: string;
    sku: string;
    marketplaceId: string;
};

type WriteTarget = ListingTarget & {
    productType: string;
    validationOnly: boolean;
};

type PatchListingParams = WriteTarget & {
    patches: { op: 'replace' | 'add' | 'delete'; path: string; value: unknown[] }[];
};

type SetQuantityParams = WriteTarget & {
    currentAttributes: Record<string, unknown>;
    quantity: number;
    handlingTime?: number;
};

type SetPriceParams = WriteTarget & {
    currentAttributes: Record<string, unknown>;
    price: number;
    currency: string;
    minimumPrice?: number;
    maximumPrice?: number;
};
