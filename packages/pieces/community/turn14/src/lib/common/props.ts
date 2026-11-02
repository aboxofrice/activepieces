import { Property } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { turn14Auth, turn14AuthProps } from '../auth';
import { Turn14AuthProps, turn14Client } from './client';

function brandDropdown({ required, description }: { required: boolean; description?: string }) {
    return Property.Dropdown({
        auth: turn14Auth,
        displayName: 'Brand',
        description: description ?? 'Turn14 brand (manufacturer line).',
        required,
        refreshers: [],
        options: async ({ auth }) => {
            if (!auth) {
                return { disabled: true, options: [], placeholder: 'Connect your Turn14 account first' };
            }
            const { data, error } = await tryCatch(() => listBrands({ auth: turn14AuthProps(auth) }));
            if (error) {
                return { disabled: true, options: [], placeholder: `Could not load brands: ${error.message}` };
            }
            return {
                disabled: false,
                options: data.map((brand) => ({ label: brand.attributes?.name ?? brand.id, value: brand.id })),
            };
        },
    });
}

function locationDropdown({ required, description }: { required: boolean; description?: string }) {
    return Property.Dropdown({
        auth: turn14Auth,
        displayName: 'Warehouse',
        description: description ?? 'Turn14 warehouse location.',
        required,
        refreshers: [],
        options: async ({ auth }) => {
            if (!auth) {
                return { disabled: true, options: [], placeholder: 'Connect your Turn14 account first' };
            }
            const { data, error } = await tryCatch(() => listLocations({ auth: turn14AuthProps(auth) }));
            if (error) {
                return { disabled: true, options: [], placeholder: `Could not load warehouses: ${error.message}` };
            }
            return {
                disabled: false,
                options: data.map((location) => ({ label: locationLabel({ location }), value: location.id })),
            };
        },
    });
}

function shippingDropdown() {
    return Property.Dropdown({
        auth: turn14Auth,
        displayName: 'Shipping Method',
        description: 'Requested carrier/service. Turn14 returns the actual options and costs in the quote.',
        required: true,
        refreshers: [],
        options: async ({ auth }) => {
            if (!auth) {
                return { disabled: true, options: [], placeholder: 'Connect your Turn14 account first' };
            }
            const { data, error } = await tryCatch(() => listShippingMethods({ auth: turn14AuthProps(auth) }));
            if (error) {
                return { disabled: true, options: [], placeholder: `Could not load shipping methods: ${error.message}` };
            }
            return {
                disabled: false,
                options: data.map((method) => ({
                    label: `${method.attributes?.carrier_name ?? ''} ${method.attributes?.transportation_name ?? ''} (code ${method.id})`.trim(),
                    value: Number(method.id),
                })),
            };
        },
    });
}

function itemIdsProperty({ displayName, description, required }: { displayName?: string; description?: string; required: boolean }) {
    return Property.Array({
        displayName: displayName ?? 'Turn14 Item IDs',
        description: description ?? 'Turn14 item IDs (the numeric "item_id" from Search Items, e.g. 078595 - not the part number). Each entry may also hold a comma-separated list.',
        required,
    });
}

async function listBrands({ auth }: { auth: Turn14AuthProps }): Promise<Turn14Brand[]> {
    const response = await turn14Client.request<{ data?: Turn14Brand[] }>({ auth, method: 'GET', path: '/v1/brands' });
    return [...(response.data ?? [])].sort((left, right) => (left.attributes?.name ?? '').localeCompare(right.attributes?.name ?? ''));
}

async function listLocations({ auth }: { auth: Turn14AuthProps }): Promise<Turn14Location[]> {
    const response = await turn14Client.request<{ data?: Turn14Location[] }>({ auth, method: 'GET', path: '/v1/locations' });
    return response.data ?? [];
}

async function listShippingMethods({ auth }: { auth: Turn14AuthProps }): Promise<Turn14ShippingMethod[]> {
    const response = await turn14Client.request<{ data?: Turn14ShippingMethod[] }>({ auth, method: 'GET', path: '/v1/shipping' });
    return response.data ?? [];
}

function locationLabel({ location }: { location: Turn14Location }): string {
    const a = location.attributes ?? {};
    const place = [a.City, a.State].filter(Boolean).join(', ');
    return `${location.id} - ${a.Name ?? 'Warehouse'}${place ? ` (${place})` : ''}`;
}

export const turn14Props = { brandDropdown, locationDropdown, shippingDropdown, itemIdsProperty, listBrands, listLocations, listShippingMethods };

export type Turn14Brand = {
    id: string;
    type?: string;
    attributes?: {
        name?: string;
        dropship?: boolean;
        logo?: string;
        AAIA?: string[];
        pricegroups?: { pricegroup_id?: string; pricegroup_name?: string; pricegroup_prefix?: string }[];
    };
};

export type Turn14Location = {
    id: string;
    type?: string;
    attributes?: { Name?: string; Street?: string; City?: string; State?: string; Country?: string; ZipCode?: string };
};

export type Turn14ShippingMethod = {
    id: number | string;
    type?: string;
    attributes?: { transportation_name?: string; carrier_name?: string };
};
