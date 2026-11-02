import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { listingCommon } from '../../common/listing';

export const getListingDetails = createAction({
    auth: ebayAuth,
    name: 'listing_get_details',
    displayName: 'Listing · Get Listing Details',
    description: 'Get a listing\'s title, SKU, price, quantity, condition, category, item specifics, photos and its compatibility (fitment) table.',
    props: {
        itemId: Property.ShortText({
            displayName: 'Item ID',
            description: 'The listing number (in the listing URL).',
            required: true,
        }),
        includeCompatibility: Property.Checkbox({
            displayName: 'Include Compatibility Table',
            description: 'One row per vehicle (Year, Make, Model, Trim, Engine, notes). Large charts can have thousands of rows.',
            required: false,
            defaultValue: true,
        }),
    },
    async run(context) {
        return listingCommon.getListingDetails({
            auth: context.auth.props,
            itemId: context.propsValue.itemId,
            includeCompatibility: context.propsValue.includeCompatibility !== false,
        });
    },
});
