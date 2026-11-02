import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonListings } from '../common/listings';
import { marketplaces } from '../common/marketplaces';
import { amazonProps } from '../common/props';

export const updateListingPrice = createAction({
    auth: amazonSellerAuth,
    name: 'update_listing_price',
    displayName: 'Update Listing Price',
    description: 'Set the price of your offer on a listing, optionally with minimum/maximum allowed prices (used by Amazon to guard against pricing errors and by automated pricing).',
    props: {
        sku: amazonProps.sku(),
        price: Property.Number({
            displayName: 'Price',
            description: "Your price in the marketplace's currency (e.g. 39.99 for USD on amazon.com).",
            required: true,
        }),
        minimumPrice: Property.Number({
            displayName: 'Minimum Allowed Price',
            description: 'Optional. Amazon deactivates the offer if the price ever drops below this.',
            required: false,
        }),
        maximumPrice: Property.Number({
            displayName: 'Maximum Allowed Price',
            description: 'Optional. Amazon deactivates the offer if the price ever rises above this.',
            required: false,
        }),
        productType: Property.ShortText({
            displayName: 'Product Type',
            description: 'Leave empty to read it from the listing (one extra request).',
            required: false,
        }),
        validationOnly: Property.Checkbox({
            displayName: 'Validate Only (dry run)',
            description: 'Ask Amazon to check the change without applying it.',
            required: false,
            defaultValue: false,
        }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const { sku, price, minimumPrice, maximumPrice, validationOnly } = context.propsValue;
        if (!(price > 0)) {
            throw new Error('Price must be greater than 0.');
        }
        if (minimumPrice != null && maximumPrice != null && minimumPrice > maximumPrice) {
            throw new Error('Minimum Allowed Price is higher than Maximum Allowed Price.');
        }
        const marketplaceId = amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId });
        const sellerId = amazonProps.requireSellerId({ auth });
        const productType = context.propsValue.productType?.trim() || await amazonListings.lookupProductType({ auth, sellerId, sku, marketplaceId });
        const currency = marketplaces.currencyFor({ marketplaceId });
        const submission = await amazonListings.setPrice({
            auth,
            sellerId,
            sku,
            marketplaceId,
            productType,
            price,
            currency,
            minimumPrice: minimumPrice ?? undefined,
            maximumPrice: maximumPrice ?? undefined,
            validationOnly: validationOnly ?? false,
        });
        return {
            sku: submission.sku,
            status: submission.status,
            submission_id: submission.submissionId,
            price,
            currency,
            validation_only: validationOnly ?? false,
            product_type: productType,
            issues: amazonListings.submissionIssues({ submission, what: `price update for ${sku}` }),
        };
    },
});
