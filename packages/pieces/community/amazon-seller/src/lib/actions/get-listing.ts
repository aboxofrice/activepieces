import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonListings, LISTING_INCLUDED_DATA } from '../common/listings';
import { amazonProps } from '../common/props';

// Declared before createAction, which reads it while the module is still evaluating.
const DEFAULT_INCLUDED_DATA = ['summaries', 'fulfillmentAvailability', 'offers', 'issues'];

export const getListing = createAction({
    auth: amazonSellerAuth,
    name: 'get_listing',
    displayName: 'Get Listing',
    description: 'Get a listing by SKU: ASIN, title, status, price, merchant-fulfilled quantity and listing issues.',
    props: {
        sku: amazonProps.sku(),
        includedData: Property.StaticMultiSelectDropdown({
            displayName: 'Include',
            required: false,
            defaultValue: DEFAULT_INCLUDED_DATA,
            options: { options: LISTING_INCLUDED_DATA },
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const marketplaceId = amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId });
        const includedData = context.propsValue.includedData?.length ? context.propsValue.includedData : DEFAULT_INCLUDED_DATA;
        const listing = await amazonListings.getListing({
            auth,
            sellerId: amazonProps.requireSellerId({ auth }),
            sku: context.propsValue.sku,
            marketplaceId,
            includedData,
        });
        return amazonListings.flattenListing({ listing, marketplaceId });
    },
});
