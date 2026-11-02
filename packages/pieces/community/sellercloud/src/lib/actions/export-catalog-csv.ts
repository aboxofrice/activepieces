import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { isNil, tryCatch } from '@activepieces/shared';
import { sellercloudAuth, sellercloudAuthProps } from '../auth';
import { SellercloudAuthProps, sellercloudClient } from '../common/client';
import { sellercloudDropdowns } from '../common/dropdowns';
import { inventoryImport } from '../common/inventory';
import { sellercloudListing } from '../common/listing';

export const exportCatalogCsv = createAction({
    auth: sellercloudAuth,
    name: 'export_catalog_csv',
    displayName: 'Export Catalog to CSV',
    description: 'Export chosen product fields to a CSV file. SellerCloud runs the export as a queued job; this step waits for it and returns the file.',
    props: {
        skus: Property.Array({
            displayName: 'SKUs',
            description: 'Products to export. Leave empty to export the products matched by the search below.',
            required: false,
        }),
        keyword: Property.ShortText({
            displayName: 'Search Keyword',
            description: 'When no SKUs are given: export products matching this keyword.',
            required: false,
        }),
        brand: sellercloudDropdowns.brand,
        companies: sellercloudDropdowns.companies({ required: false, description: 'When no SKUs are given: only export products of these companies (stores).' }),
        otherCompanyIds: sellercloudDropdowns.otherCompanyIds,
        maxProducts: Property.Number({
            displayName: 'Max Products',
            description: 'When searching: the most products to export (at most 5000; each 50 costs one API call to find).',
            required: false,
            defaultValue: 500,
        }),
        columns: Property.MultiSelectDropdown({
            auth: sellercloudAuth,
            displayName: 'Columns',
            description: 'Product fields to include. Leave empty for SKU, name, part number, UPC, brand, company, price, cost and quantity.',
            required: false,
            refreshers: [],
            options: async ({ auth }) => {
                if (!auth) {
                    return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
                }
                const { data, error } = await tryCatch(() => listExportColumns({ auth: sellercloudAuthProps(auth) }));
                if (error) {
                    return { disabled: true, options: [], placeholder: `Couldn't load columns: ${error.message}` };
                }
                return { disabled: false, options: data.map((column) => ({ label: column.Value, value: column.Key })) };
            },
        }),
        fileName: Property.ShortText({
            displayName: 'File Name',
            required: false,
            defaultValue: 'sellercloud-catalog.csv',
        }),
        timeoutSeconds: Property.Number({
            displayName: 'Wait Timeout (seconds)',
            description: 'How long to wait for SellerCloud to finish the export.',
            required: false,
            defaultValue: 300,
        }),
    },
    async run(context) {
        const { skus, keyword, brand, companies, otherCompanyIds, maxProducts, columns, fileName, timeoutSeconds } = context.propsValue;
        const auth = sellercloudAuthProps(context.auth);
        const token = await sellercloudClient.getToken({ auth, store: context.store });
        const productIds = await resolveProductIds({
            auth,
            token,
            skus: Array.isArray(skus) ? skus.map((sku) => String(sku ?? '').trim()).filter((sku) => sku !== '') : [],
            keyword: (keyword ?? '').trim(),
            brand: isNil(brand) ? null : Number(brand),
            companies: sellercloudDropdowns.resolveCompanyIds({ selected: companies, other: otherCompanyIds }),
            maxProducts: Math.min(MAX_PRODUCTS, Math.max(1, maxProducts ?? 500)),
        });
        // An empty ProductIds list would ask SellerCloud for the whole catalog.
        if (productIds.length === 0) {
            throw new Error('SellerCloud: no products to export. Give SKUs or a search that matches something.');
        }
        const chosenColumns = (columns ?? []).length > 0 ? (columns ?? []).map(String) : DEFAULT_COLUMNS;
        const submitted = await sellercloudClient.request<{ QueuedJobLink?: string | null }>({
            auth,
            token,
            method: HttpMethod.POST,
            path: '/Catalog/Exports/Custom',
            body: {
                Columns: chosenColumns.map((name) => ({ OriginalName: name, DisplayName: name })),
                FileFormat: CSV_FORMAT,
                ProductIds: productIds,
            },
        });
        const jobId = jobIdFromLink({ link: submitted.QueuedJobLink });
        const job = await inventoryImport.waitForJob({ auth, token, jobId, timeoutSeconds: timeoutSeconds ?? 300 });
        if (job.timedOut) {
            return { success: false, job_id: jobId, status: job.status, message: 'The export is still running. Use "Get Queued Job" later, then download its output file.', file: null };
        }
        if (!job.succeeded) {
            throw new Error(`SellerCloud export job ${jobId} ended as ${job.status}: ${job.errorMessage ?? job.errors.join('; ')}`);
        }
        const raw = await sellercloudClient.request<unknown>({
            auth,
            token,
            method: HttpMethod.GET,
            path: '/QueuedJobs/OutputFile',
            queryParams: { id: jobId },
        });
        const csv = decodeOutputFile({ raw });
        const name = ensureCsvName({ name: fileName || 'sellercloud-catalog.csv' });
        const file = await context.files.write({ fileName: name, data: Buffer.from(csv, 'utf8') });
        return {
            success: true,
            job_id: jobId,
            status: job.status,
            file,
            file_name: name,
            product_count: productIds.length,
            row_count: Math.max(0, csv.split(/\r?\n/).filter((line) => line !== '').length - 1),
            columns: chosenColumns,
        };
    },
});

async function resolveProductIds({ auth, token, skus, keyword, brand, companies, maxProducts }: ResolveParams): Promise<string[]> {
    if (skus.length > 0) {
        return [...new Set(skus)];
    }
    if (keyword === '' && brand === null && isNil(companies)) {
        throw new Error('SellerCloud: give SKUs, or a keyword / brand / company to search for. Exporting the whole catalog is not supported here.');
    }
    const { items } = await sellercloudListing.listPages<{ ID: string }>({
        auth,
        token,
        path: '/Catalog',
        query: { 'model.keyword': keyword || undefined },
        arrayQuery: { 'model.brandIds': brand === null ? undefined : [brand], 'model.companyID': companies },
        maxPages: Math.ceil(maxProducts / sellercloudListing.PAGE_SIZE),
    });
    return items.slice(0, maxProducts).map((item) => item.ID);
}

async function listExportColumns({ auth }: { auth: SellercloudAuthProps }): Promise<{ Key: string; Value: string }[]> {
    const metadata = await sellercloudClient.request<{ AvailableColumns?: { Key: string; Value: string }[] | null }>({
        auth,
        method: HttpMethod.GET,
        path: '/Catalog/Exports/Custom/Metadata',
        queryParams: { includeAdvancedColumns: false },
    });
    return [...(metadata.AvailableColumns ?? [])].sort((a, b) => a.Value.localeCompare(b.Value));
}

// The response carries only a UI link, e.g. "/queued-jobs/queued-job-details.aspx?id=28684".
function jobIdFromLink({ link }: { link: string | null | undefined }): number {
    const match = /id=(\d+)/i.exec(link ?? '') ?? /(\d+)\D*$/.exec(link ?? '');
    if (!match) {
        throw new Error(`SellerCloud: export submitted but no job ID in the response (${link ?? 'empty'}).`);
    }
    return Number(match[1]);
}

// The output file comes back as base64 text (served as text/plain).
function decodeOutputFile({ raw }: { raw: unknown }): string {
    if (typeof raw !== 'string') {
        throw new Error('SellerCloud: the export output file was not returned as text.');
    }
    const trimmed = raw.trim().replace(/^"|"$/g, '');
    return Buffer.from(trimmed, 'base64').toString('utf8').replace(/^﻿/, '');
}

function ensureCsvName({ name }: { name: string }): string {
    return name.toLowerCase().endsWith('.csv') ? name : `${name}.csv`;
}

const CSV_FORMAT = 1;
const MAX_PRODUCTS = 5000;
const DEFAULT_COLUMNS = ['ProductID', 'ProductName', 'ManufacturerSKU', 'UPC', 'BrandName', 'CompanyName', 'SitePrice', 'SiteCost', 'AggregateQty'];

type ResolveParams = {
    auth: SellercloudAuthProps;
    token: string;
    skus: string[];
    keyword: string;
    brand: number | null;
    companies: number[] | undefined;
    maxProducts: number;
};
