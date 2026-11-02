import { createAction, Property } from '@activepieces/pieces-framework';
import { amazonSellerAuth, amazonSellerAuthProps } from '../auth';
import { AmazonSellerAuthProps } from '../common/client';
import { amazonCatalog } from '../common/catalog';
import { DecodedVehicle, fitment } from '../common/fitment';
import { amazonListings } from '../common/listings';
import { amazonProps } from '../common/props';

export const checkPartFitment = createAction({
    auth: amazonSellerAuth,
    name: 'check_part_fitment',
    displayName: 'Check Part Fitment (text heuristic)',
    description: "Compare a part's Amazon catalog compatibility text with a vehicle (by VIN or year/make/model). This is a text heuristic, NOT confirmed fitment: Amazon does not expose its confirmed-fit data through the API for US listings. Answers text_match / text_mismatch / unknown with a confidence and the text it relied on; confirm before telling a buyer.",
    props: {
        notice: Property.MarkDown({
            value: '**Text heuristic, not confirmed fitment.** Amazon\'s "Confirmed Fit" database is not readable through SP-API in the US. This action reads the catalog\'s compatibility text (e.g. "2015-2016 Ford F-250 Super Duty 6.7L"), title and bullet points, decodes a VIN with NHTSA\'s free vPIC service, and checks that the text names the vehicle\'s make, its model, and a model-year range next to that model. `text_match` means the text says so; it does not mean Amazon has confirmed the fit.',
        }),
        asin: Property.ShortText({
            displayName: 'ASIN',
            description: 'The part to check. Either ASIN or Seller SKU is required.',
            required: false,
        }),
        sku: Property.ShortText({
            displayName: 'Seller SKU',
            description: 'Used to look up the ASIN when no ASIN is given. Needs the Seller ID on the connection.',
            required: false,
        }),
        vin: Property.ShortText({
            displayName: 'VIN',
            description: '17-character VIN. Overrides Year/Make/Model when given.',
            required: false,
        }),
        year: Property.Number({ displayName: 'Vehicle Year', required: false }),
        make: Property.ShortText({ displayName: 'Vehicle Make', description: 'e.g. Ford', required: false }),
        model: Property.ShortText({ displayName: 'Vehicle Model', description: 'e.g. F-250 Super Duty', required: false }),
        marketplaceId: amazonProps.marketplace(),
    },
    async run(context) {
        const auth = amazonSellerAuthProps(context.auth);
        const marketplaceId = amazonProps.resolveMarketplace({ auth, override: context.propsValue.marketplaceId });
        const { vin, year, make, model } = context.propsValue;
        const vehicle = await resolveVehicle({ vin, year, make, model });
        const asin = await resolveAsin({ auth, marketplaceId, asin: context.propsValue.asin, sku: context.propsValue.sku });
        const item = await amazonCatalog.getCatalogItem({ auth, asin, marketplaceId });
        const flat = amazonCatalog.flattenCatalogItem({ item, marketplaceId });
        const attrs = item.attributes ?? {};
        const assessment = fitment.assessFitment({
            sources: [
                { label: 'compatibility', text: flat.compatibility_options },
                { label: 'title', text: flat.item_name ?? '' },
                ...amazonCatalog.allValues({ attrs, key: 'bullet_point' }).map((text) => ({ label: 'bullet', text })),
            ],
            fitType: flat.automotive_fit_type,
            brand: flat.brand,
            vehicle,
        });
        return {
            ...assessment,
            method: 'text_heuristic',
            fitment_confirmed: false,
            reasons: assessment.reasons.join(' '),
            asin: flat.asin,
            item_name: flat.item_name,
            brand: flat.brand,
            part_number: flat.part_number,
            oem_equivalent_part_numbers: flat.oem_equivalent_part_numbers,
            automotive_fit_type: flat.automotive_fit_type,
            compatibility_options: flat.compatibility_options,
            compatible_vehicle_types: flat.compatible_vehicle_types,
            vehicle_vin: vehicle.vin,
            vehicle_year: vehicle.year,
            vehicle_make: vehicle.make,
            vehicle_model: vehicle.model,
            vehicle_trim: vehicle.trim,
            vehicle_engine: vehicle.engine,
            vehicle_body_class: vehicle.body_class,
        };
    },
});

async function resolveVehicle({ vin, year, make, model }: VehicleInput): Promise<DecodedVehicle> {
    if (vin?.trim()) {
        return fitment.decodeVin({ vin });
    }
    if (!year) {
        throw new Error('Give a VIN, or at least the vehicle year (plus make and model for a useful answer).');
    }
    return { vin: null, year, make: make?.trim() ?? '', model: model?.trim() ?? '', trim: null, engine: null, body_class: null };
}

async function resolveAsin({ auth, marketplaceId, asin, sku }: AsinInput): Promise<string> {
    if (asin?.trim()) {
        return asin.trim();
    }
    if (!sku?.trim()) {
        throw new Error('Give the part as an ASIN or a Seller SKU.');
    }
    const listing = await amazonListings.getListing({ auth, sellerId: amazonProps.requireSellerId({ auth }), sku, marketplaceId, includedData: ['summaries'] });
    const found = amazonListings.flattenListing({ listing, marketplaceId }).asin;
    if (!found) {
        throw new Error(`Listing ${sku} has no ASIN yet.`);
    }
    return found;
}

type VehicleInput = {
    vin: string | undefined | null;
    year: number | undefined | null;
    make: string | undefined | null;
    model: string | undefined | null;
};

type AsinInput = {
    auth: AmazonSellerAuthProps;
    marketplaceId: string;
    asin: string | undefined | null;
    sku: string | undefined | null;
};
