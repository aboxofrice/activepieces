import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Props } from '../common/props';

export const listBrands = createAction({
    auth: turn14Auth,
    name: 'list_brands',
    displayName: 'List Brands',
    description: 'List the brands Turn14 carries for your account, with brand ID, drop-ship eligibility, AAIA codes and price groups.',
    props: {
        nameContains: Property.ShortText({
            displayName: 'Name Contains',
            required: false,
        }),
        dropshipOnly: Property.Checkbox({
            displayName: 'Drop-Ship Brands Only',
            required: false,
            defaultValue: false,
        }),
    },
    async run(context) {
        const needle = context.propsValue.nameContains?.trim().toLowerCase();
        const brands = await turn14Props.listBrands({ auth: turn14AuthProps(context.auth) });
        return brands
            .filter((brand) => !needle || (brand.attributes?.name ?? '').toLowerCase().includes(needle))
            .filter((brand) => !context.propsValue.dropshipOnly || brand.attributes?.dropship === true)
            .map((brand) => ({
                brand_id: brand.id,
                name: brand.attributes?.name ?? null,
                dropship: brand.attributes?.dropship ?? null,
                aaia_codes: (brand.attributes?.AAIA ?? []).join(','),
                price_group_ids: (brand.attributes?.pricegroups ?? []).map((group) => group.pricegroup_id).join(','),
                price_group_names: (brand.attributes?.pricegroups ?? []).map((group) => group.pricegroup_name).join(','),
                price_group_prefixes: (brand.attributes?.pricegroups ?? []).map((group) => group.pricegroup_prefix).join(','),
                logo_url: brand.attributes?.logo ?? null,
            }));
    },
});
