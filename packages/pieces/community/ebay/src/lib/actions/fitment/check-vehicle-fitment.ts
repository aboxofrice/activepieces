import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { fitmentCommon } from '../../common/fitment';

export const checkVehicleFitment = createAction({
    auth: ebayAuth,
    name: 'fitment_check_vehicle',
    displayName: 'Fitment · Check Vehicle Against Listing',
    description: 'Checks a vehicle (e.g. from a decoded VIN) against one of your listings\' fitment chart, then confirms the matched row with eBay. Only returns COMPATIBLE when eBay confirms it.',
    props: {
        itemId: Property.ShortText({
            displayName: 'Item ID',
            description: 'Your listing\'s item ID (a conversation\'s item_id).',
            required: true,
        }),
        year: Property.ShortText({ displayName: 'Year', required: true }),
        make: Property.ShortText({ displayName: 'Make', required: true }),
        model: Property.ShortText({ displayName: 'Model', required: true }),
        series: Property.ShortText({
            displayName: 'Series',
            description: 'Helps older models eBay names with the series, e.g. Dodge "Ram 1500".',
            required: false,
        }),
        trim: Property.ShortText({
            displayName: 'Trim',
            description: 'Slash-separated alternatives are allowed, e.g. "Big Horn/Lone Star".',
            required: false,
        }),
        displacementL: Property.ShortText({
            displayName: 'Engine Displacement (L)',
            description: 'e.g. 5.7',
            required: false,
        }),
        cylinders: Property.ShortText({ displayName: 'Cylinders', required: false }),
    },
    async run(context) {
        const { itemId, ...vehicle } = context.propsValue;
        const auth = context.auth.props;
        const listing = await fitmentCommon.getListingFitment({ auth, itemId });
        if (!listing.found || listing.listingStatus !== 'Active') {
            return {
                status: 'LISTING_UNAVAILABLE',
                reason: listing.error ?? `The listing is ${listing.listingStatus ?? 'unavailable'}.`,
                item_id: itemId,
                listing_title: listing.title,
                listing_status: listing.listingStatus,
                chart_rows: listing.rows.length,
                year_make_model_rows: 0,
                matched_row: null,
                candidates: [],
            };
        }
        const match = fitmentCommon.matchVehicle({ rows: listing.rows, vehicle });
        const matchedRow = match.status === 'CANDIDATE' ? match.candidates[0] : null;
        const ebayStatus = matchedRow ? await fitmentCommon.confirmWithEbay({ auth, itemId, row: matchedRow }) : null;
        const status = match.status !== 'CANDIDATE' ? match.status
            : ebayStatus === 'COMPATIBLE' ? 'COMPATIBLE'
                : 'UNDETERMINED';
        return {
            status,
            reason: match.status === 'CANDIDATE' && status !== 'COMPATIBLE' ? `eBay did not confirm the matched row (${ebayStatus}).` : match.reason,
            item_id: itemId,
            listing_title: listing.title,
            listing_status: listing.listingStatus,
            chart_rows: listing.rows.length,
            year_make_model_rows: match.yearMakeModelRows,
            matched_row: matchedRow,
            candidates: match.candidates,
        };
    },
});
