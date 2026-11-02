import { HttpMethod } from '@activepieces/pieces-common';
import { Property } from '@activepieces/pieces-framework';
import { isNil, tryCatch } from '@activepieces/shared';
import { sellercloudAuth, sellercloudAuthProps } from '../auth';
import { SellercloudAuthProps, sellercloudClient } from './client';
import { sellercloudEnums } from './enums';
import { sellercloudListing } from './listing';
import { tenantTime } from './tenant-time';

// /Companies is the source of truth, but an API user without the company-view permission
// gets an empty list (or a 403) while still seeing every company's orders. Then fall back
// to the companies seen on orders over the last 90 days. That window holds thousands of
// orders, so sample pages spread across it instead of reading it all.
async function listCompanies({ auth }: { auth: SellercloudAuthProps }): Promise<CompanyList> {
    const direct = await tryCatch(() => sellercloudListing.listPages<{ ID: number; CompanyName?: string | null; Name?: string | null }>({
        auth,
        path: '/Companies',
        maxPages: 10,
    }));
    const fromApi = (direct.data?.items ?? []).map((company) => ({ id: company.ID, name: company.CompanyName || company.Name || `Company ${company.ID}` }));
    if (fromApi.length > 0) {
        return { companies: fromApi, source: 'companies' };
    }
    return { companies: await companiesSeenInOrders({ auth }), source: 'orders' };
}

async function companiesSeenInOrders({ auth }: { auth: SellercloudAuthProps }): Promise<CompanyOption[]> {
    const token = await sellercloudClient.getToken({ auth });
    const since = tenantTime.toFilterValue({ date: new Date(Date.now() - COMPANY_FALLBACK_WINDOW_MS) });
    const readPage = async (pageNumber: number) => sellercloudClient.request<{ Items: OrderCompany[] | null; TotalResults: number | null }>({
        auth,
        token,
        method: HttpMethod.GET,
        path: '/Orders',
        queryParams: { 'model.createdOnFrom': since, 'model.pageSize': sellercloudListing.PAGE_SIZE, 'model.pageNumber': pageNumber },
    });
    const first = await readPage(1);
    const totalPages = Math.max(1, Math.ceil((first.TotalResults ?? 0) / sellercloudListing.PAGE_SIZE));
    const sampled = unique(Array.from({ length: COMPANY_FALLBACK_SAMPLES }, (_, index) => 1 + Math.round((index + 1) * (totalPages - 1) / COMPANY_FALLBACK_SAMPLES)))
        .filter((pageNumber) => pageNumber > 1);
    const pages = [first.Items ?? []];
    for (const pageNumber of sampled) {
        const page = await readPage(pageNumber);
        pages.push(page.Items ?? []);
    }
    const sampledCompanies = new Map(pages.flat()
        .filter((order) => !isNil(order.CompanyID))
        .map((order) => [Number(order.CompanyID), order.CompanyName || `Company ${order.CompanyID}`]));
    const probed = await probeNeighbourCompanies({ auth, token, known: sampledCompanies });
    return [...sampledCompanies.entries(), ...probed.entries()].map(([id, name]) => ({ id, name }));
}

// Sampling misses a store with only a handful of orders. Company IDs are allocated
// sequentially per account, so ask for one order of each ID in the small gaps between the
// IDs already seen and just past either end; a company that has never had an order still
// needs "Other Company IDs". Sparse IDs would otherwise mean thousands of sequential calls
// inside a dropdown, so the probe is capped and stops at the first failure (a rate limit).
async function probeNeighbourCompanies({ auth, token, known }: { auth: SellercloudAuthProps; token: string; known: Map<number, string> }): Promise<Map<number, string>> {
    const found = new Map<number, string>();
    for (const id of probeCandidates({ known: [...known.keys()] })) {
        const { data: page, error } = await tryCatch(() => sellercloudClient.request<{ Items: OrderCompany[] | null }>({
            auth,
            token,
            method: HttpMethod.GET,
            path: `/Orders?model.companyID=${id}`,
            queryParams: { 'model.pageSize': 1, 'model.pageNumber': 1 },
        }));
        if (error) {
            break;
        }
        const order = (page.Items ?? []).find((item) => Number(item.CompanyID) === id);
        if (order) {
            found.set(id, order.CompanyName || `Company ${id}`);
        }
    }
    return found;
}

function probeCandidates({ known }: { known: number[] }): number[] {
    const sorted = unique(known.filter((id) => Number.isInteger(id) && id > 0)).sort((a, b) => a - b);
    if (sorted.length === 0) {
        return [];
    }
    const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
    const gaps = sorted.slice(1).flatMap((id, index) => {
        const previous = sorted[index];
        return id - previous - 1 <= COMPANY_PROBE_MAX_GAP ? range(previous + 1, id - 1) : [];
    });
    const edges = [
        ...range(sorted[sorted.length - 1] + 1, sorted[sorted.length - 1] + COMPANY_PROBE_MARGIN),
        ...range(Math.max(1, sorted[0] - COMPANY_PROBE_MARGIN), sorted[0] - 1),
    ];
    return unique([...gaps, ...edges]).slice(0, COMPANY_PROBE_MAX_CALLS);
}

function unique(values: number[]): number[] {
    return [...new Set(values)];
}

function companyOptions({ list }: { list: CompanyList }): { label: string; value: number }[] {
    const suffix = list.source === 'orders' ? ' — seen in orders' : '';
    return [...list.companies]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((company) => ({ label: `${company.name} (${company.id})${suffix}`, value: company.id }));
}

function companies({ required, description }: { required: boolean; description?: string }) {
    return Property.MultiSelectDropdown({
        auth: sellercloudAuth,
        displayName: 'Companies',
        description: `${description ?? 'Only include these companies (stores). Leave empty for all.'} ${COMPANY_FALLBACK_HELP}`,
        required,
        refreshers: [],
        options: async ({ auth }) => {
            if (!auth) {
                return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
            }
            const { data, error } = await tryCatch(() => listCompanies({ auth: sellercloudAuthProps(auth) }));
            if (error) {
                return { disabled: true, options: [], placeholder: `Couldn't load companies: ${sellercloudClient.safeErrorMessage({ error, auth: sellercloudAuthProps(auth) })}. Use "Other Company IDs" instead.` };
            }
            if (data.companies.length === 0) {
                return { disabled: true, options: [], placeholder: 'No companies found. Use "Other Company IDs" instead.' };
            }
            return { disabled: false, options: companyOptions({ list: data }) };
        },
    });
}

// Dropdowns cannot take typed values, so a company missing from the list (a brand-new
// store, or one with no recent orders) is entered by ID here.
const otherCompanyIds = Property.ShortText({
    displayName: 'Other Company IDs',
    description: 'Company IDs not shown in the list above, comma separated (e.g. "171, 172"). Combined with the selected companies.',
    required: false,
});

function resolveCompanyIds({ selected, other }: { selected: unknown; other: unknown }): number[] | undefined {
    const fromList = Array.isArray(selected) ? selected.map(Number) : [];
    const typed = typeof other === 'string' ? other.split(/[\s,;]+/).filter((part) => part !== '').map(Number) : [];
    const ids = unique([...fromList, ...typed].filter((id) => Number.isInteger(id) && id > 0));
    return ids.length === 0 ? undefined : ids;
}

function warehouse({ required, description }: { required: boolean; description?: string }) {
    return Property.Dropdown({
        auth: sellercloudAuth,
        displayName: 'Warehouse',
        description,
        required,
        refreshers: [],
        options: async ({ auth }) => {
            if (!auth) {
                return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
            }
            const { data, error } = await tryCatch(() => sellercloudClient.listWarehouses({ auth: sellercloudAuthProps(auth) }));
            if (error) {
                return { disabled: true, options: [], placeholder: `Couldn't load warehouses: ${sellercloudClient.safeErrorMessage({ error, auth: sellercloudAuthProps(auth) })}` };
            }
            return {
                disabled: false,
                options: [...data].sort((a, b) => a.Name.localeCompare(b.Name)).map((w) => ({ label: `${w.Name} (${w.ID})`, value: w.ID })),
            };
        },
    });
}

function warehouses({ required, description }: { required: boolean; description?: string }) {
    return Property.MultiSelectDropdown({
        auth: sellercloudAuth,
        displayName: 'Warehouses',
        description,
        required,
        refreshers: [],
        options: async ({ auth }) => {
            if (!auth) {
                return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
            }
            const { data, error } = await tryCatch(() => sellercloudClient.listWarehouses({ auth: sellercloudAuthProps(auth) }));
            if (error) {
                return { disabled: true, options: [], placeholder: `Couldn't load warehouses: ${sellercloudClient.safeErrorMessage({ error, auth: sellercloudAuthProps(auth) })}` };
            }
            return {
                disabled: false,
                options: [...data].sort((a, b) => a.Name.localeCompare(b.Name)).map((w) => ({ label: `${w.Name} (${w.ID})`, value: w.ID })),
            };
        },
    });
}

function channels({ description }: { description?: string }) {
    return Property.StaticMultiSelectDropdown({
        displayName: 'Channels',
        description: description ?? 'Only include orders from these sales channels. Leave empty for all.',
        required: false,
        options: { options: sellercloudEnums.toOptions({ map: sellercloudEnums.CHANNELS }) },
    });
}

function orderStatuses({ displayName, description, defaultValue }: { displayName: string; description: string; defaultValue?: number[] }) {
    return Property.StaticMultiSelectDropdown({
        displayName,
        description,
        required: false,
        defaultValue,
        options: { options: sellercloudEnums.toOptions({ map: sellercloudEnums.ORDER_STATUSES }) },
    });
}

const brand = Property.Dropdown({
    auth: sellercloudAuth,
    displayName: 'Brand',
    description: 'Only return products of this brand.',
    required: false,
    refreshers: [],
    options: async ({ auth }) => {
        if (!auth) {
            return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
        }
        const { data, error } = await tryCatch(() => sellercloudClient.request<KeyValue<number>[]>({
            auth: sellercloudAuthProps(auth),
            method: HttpMethod.GET,
            path: '/Settings/Brands',
        }));
        if (error) {
            return { disabled: true, options: [], placeholder: `Couldn't load brands: ${sellercloudClient.safeErrorMessage({ error, auth: sellercloudAuthProps(auth) })}` };
        }
        return {
            disabled: false,
            options: [...data].sort((a, b) => a.Value.localeCompare(b.Value)).map((item) => ({ label: item.Value, value: item.Key })),
        };
    },
});

const shippingCarrier = Property.Dropdown({
    auth: sellercloudAuth,
    displayName: 'Carrier',
    required: true,
    refreshers: [],
    options: async ({ auth }) => {
        if (!auth) {
            return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
        }
        const { data, error } = await tryCatch(() => sellercloudClient.request<KeyValue<string>[]>({
            auth: sellercloudAuthProps(auth),
            method: HttpMethod.GET,
            path: '/Settings/ShippingCarriers',
            queryParams: { siteCode: US_SITE_CODE },
        }));
        if (error) {
            return { disabled: true, options: [], placeholder: `Couldn't load carriers: ${sellercloudClient.safeErrorMessage({ error, auth: sellercloudAuthProps(auth) })}` };
        }
        return { disabled: false, options: data.map((item) => ({ label: item.Value, value: item.Key })) };
    },
});

const shippingService = Property.Dropdown({
    auth: sellercloudAuth,
    displayName: 'Service',
    description: 'The shipping service (method) used.',
    required: true,
    refreshers: ['carrier'],
    options: async ({ auth, carrier }) => {
        if (!auth) {
            return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
        }
        if (typeof carrier !== 'string' || carrier === '') {
            return { disabled: true, options: [], placeholder: 'Select a carrier first' };
        }
        const { data, error } = await tryCatch(() => sellercloudClient.request<KeyValue<string>[]>({
            auth: sellercloudAuthProps(auth),
            method: HttpMethod.GET,
            path: '/Settings/ShippingServices',
            queryParams: { siteCode: US_SITE_CODE, carrier },
        }));
        if (error) {
            return { disabled: true, options: [], placeholder: `Couldn't load services: ${sellercloudClient.safeErrorMessage({ error, auth: sellercloudAuthProps(auth) })}` };
        }
        return { disabled: false, options: data.map((item) => ({ label: item.Value, value: item.Key })) };
    },
});

const orderCustomColumn = Property.Dropdown({
    auth: sellercloudAuth,
    displayName: 'Custom Column',
    description: 'The order custom columns defined in SellerCloud. Enter the order ID first to load them.',
    required: true,
    refreshers: ['orderId'],
    options: async ({ auth, orderId }) => {
        if (!auth) {
            return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
        }
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) {
            return { disabled: true, options: [], placeholder: 'Enter an order ID first' };
        }
        const { data, error } = await tryCatch(() => listOrderCustomColumns({ auth: sellercloudAuthProps(auth), orderId: id }));
        if (error) {
            return { disabled: true, options: [], placeholder: `Couldn't load custom columns: ${sellercloudClient.safeErrorMessage({ error, auth: sellercloudAuthProps(auth) })}` };
        }
        return {
            disabled: false,
            options: data.map((column) => ({
                label: `${column.DisplayName || column.ColumnName} (${CUSTOM_COLUMN_TYPES[column.DataType] ?? 'Text'})`,
                value: column.ColumnName,
            })),
        };
    },
});

async function listOrderCustomColumns({ auth, orderId, token }: { auth: SellercloudAuthProps; orderId: number; token?: string }): Promise<OrderCustomColumn[]> {
    return sellercloudClient.request<OrderCustomColumn[]>({
        auth,
        token,
        method: HttpMethod.GET,
        path: `/Orders/${orderId}/CustomColumns`,
    });
}

const US_SITE_CODE = 0;
const COMPANY_FALLBACK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const COMPANY_FALLBACK_SAMPLES = 5;
const COMPANY_PROBE_MARGIN = 3;
const COMPANY_PROBE_MAX_GAP = 5;
const COMPANY_PROBE_MAX_CALLS = 20;
const COMPANY_FALLBACK_HELP = 'The list comes from SellerCloud Companies; if the API user lacks the company-view permission it shows companies seen in orders from the last 90 days (marked "seen in orders") — grant that permission for the full list.';
const CUSTOM_COLUMN_TYPES: Record<number, string> = {
    0: 'Text', 1: 'Integer', 2: 'Decimal', 3: 'Date/Time', 4: 'Yes/No', 5: 'Long Text', 6: 'Hyperlink',
};

export const sellercloudDropdowns = {
    companies,
    otherCompanyIds,
    resolveCompanyIds,
    warehouse,
    warehouses,
    channels,
    orderStatuses,
    brand,
    shippingCarrier,
    shippingService,
    orderCustomColumn,
    listCompanies,
    listOrderCustomColumns,
    probeCandidates,
};

export type OrderCustomColumn = {
    ID: number;
    ColumnName: string;
    DisplayName?: string;
    DataType: number;
    DataLength?: number;
    IsDropDownColumn?: boolean;
    Value: unknown;
};

type CompanyOption = { id: number; name: string };

type CompanyList = { companies: CompanyOption[]; source: 'companies' | 'orders' };

type OrderCompany = { CompanyID?: number | null; CompanyName?: string | null };

type KeyValue<K> = { Key: K; Value: string };
