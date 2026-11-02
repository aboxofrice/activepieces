import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { amazonListings } from '../common/listings';
import { amazonProps } from '../common/props';

export const updateListingQuantity = createAction({
    auth: amazonSellerAuth,
    name: 'update_listing_quantity',
    displayName: 'Update Listing Quantity',
    description: 'Set the merchant-fulfilled (MFN) available quantity of a listing. Other fulfillment settings on the listing (such as handling time) are kept unless you change them. FBA stock is managed by Amazon and cannot be set here.',
    props: {
        sku: amazonProps.sku(),
        quantity: Property.Number({
            displayName: 'Quantity',
            description: 'The new available quantity. Negative values are sent as 0.',
            required: true,
        }),
        handlingTime: Property.Number({
            displayName: 'Handling Time (days)',
            description: 'Optional. Days between order and shipment. Leave empty to keep the current value.',
            required: false,
        }),
        productType: Property.ShortText({
            displayName: 'Product Type',
            description: 'Leave empty to use the type of the existing listing.',
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
        const { sku, quantity, handlingTime, validationOnly } = context.propsValue;
        const marketplaceId = amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId });
        const sellerId = amazonProps.requireSellerId({ auth });
        const current = await amazonListings.readForUpdate({ auth, sellerId, sku, marketplaceId });
        const productType = context.propsValue.productType?.trim() || current.productType;
        const submission = await amazonListings.setFulfillmentQuantity({
            auth,
            sellerId,
            sku,
            marketplaceId,
            productType,
            currentAttributes: current.attributes,
            quantity: Math.max(0, Math.floor(quantity)),
            handlingTime: handlingTime ?? undefined,
            validationOnly: validationOnly ?? false,
        });
        const issues = amazonListings.submissionIssues({ submission, what: `quantity update for ${sku}` });
        return {
            sku: submission.sku,
            status: submission.status,
            submission_id: submission.submissionId,
            quantity: Math.max(0, Math.floor(quantity)),
            validation_only: validationOnly ?? false,
            product_type: productType,
            issues,
        };
    },
});
