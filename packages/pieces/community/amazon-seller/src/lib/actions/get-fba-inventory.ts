import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { fbaInventory } from '../common/inventory';
import { amazonProps } from '../common/props';

export const getFbaInventory = createAction({
    auth: amazonSellerAuth,
    name: 'get_fba_inventory_summaries',
    displayName: 'Get FBA Inventory',
    description: 'Get Fulfillment by Amazon stock levels (fulfillable, inbound, reserved, unfulfillable) per SKU.',
    props: {
        sellerSkus: Property.Array({
            displayName: 'Seller SKUs',
            description: 'Up to 50 SKUs. Leave empty for every FBA SKU.',
            required: false,
        }),
        startDateTime: Property.DateTime({
            displayName: 'Changed Since',
            description: 'Only SKUs whose inventory changed after this time. Ignored when SKUs are listed.',
            required: false,
        }),
        details: Property.Checkbox({
            displayName: 'Include Quantity Breakdown',
            description: 'Adds inbound, reserved, unfulfillable and researching quantities.',
            required: false,
            defaultValue: true,
        }),
        marketplaceId: amazonProps.marketplace(),
        maxResults: Property.Number({
            displayName: 'Maximum SKUs',
            required: false,
            defaultValue: 1000,
        }),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const { startDateTime, details, maxResults } = context.propsValue;
        const sellerSkus = (context.propsValue.sellerSkus ?? []).map((value) => String(value).trim()).filter((value) => value.length > 0);
        if (sellerSkus.length > MAX_SKUS) {
            throw new Error(`Amazon accepts at most ${MAX_SKUS} SKUs per request; ${sellerSkus.length} were given.`);
        }
        const summaries = await fbaInventory.listFbaInventory({
            auth,
            marketplaceId: amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId }),
            sellerSkus,
            startDateTime: sellerSkus.length === 0 && startDateTime ? new Date(startDateTime).toISOString() : undefined,
            details: details ?? true,
            maxRows: maxResults ?? undefined,
        });
        return summaries.map((summary) => fbaInventory.flattenFbaSummary({ summary }));
    },
});

const MAX_SKUS = 50;
