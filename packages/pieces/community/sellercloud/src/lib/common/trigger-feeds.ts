import { SellercloudAuthProps, sellercloudClient } from './client';
import { ListPagesResult, sellercloudListing } from './listing';
import { SellercloudOrder, SellercloudPurchaseOrder, SellercloudRma } from './records';
import { tenantTime } from './tenant-time';

// Data sources for the polling triggers. Each returns the records SellerCloud reports for
// a window starting at `since` (from `startPage` on), and whether more pages remain;
// dedupe and resuming a truncated window happen in the poller.

async function orders({ auth, store, since, dateField, channels, companies, maxPages, startPage }: OrdersParams): Promise<ListPagesResult<SellercloudOrder>> {
    const token = await sellercloudClient.getToken({ auth, store });
    return sellercloudListing.listPages<SellercloudOrder>({
        auth,
        token,
        path: '/Orders',
        query: { [dateField === 'created' ? 'model.createdOnFrom' : 'model.lastUpdatedFrom']: tenantTime.toFilterValue({ date: since }) },
        arrayQuery: { 'model.channel': channels, 'model.companyID': companies },
        maxPages,
        startPage,
        keepPartialOnError: true,
    });
}

async function returns({ auth, store, since, channels, companies, maxPages, startPage }: ScopedParams): Promise<ListPagesResult<SellercloudRma>> {
    const token = await sellercloudClient.getToken({ auth, store });
    return sellercloudListing.listPages<SellercloudRma>({
        auth,
        token,
        path: '/Rma',
        query: { 'model.dateFrom': tenantTime.toFilterValue({ date: since }) },
        arrayQuery: { 'model.orderSources': channels, 'model.companyIDList': companies },
        maxPages,
        startPage,
        keepPartialOnError: true,
    });
}

async function receivedPurchaseOrders({ auth, store, since, companies, warehouses, maxPages, startPage }: PurchaseOrderParams): Promise<ListPagesResult<SellercloudPurchaseOrder>> {
    const token = await sellercloudClient.getToken({ auth, store });
    return sellercloudListing.listPages<SellercloudPurchaseOrder>({
        auth,
        token,
        path: '/PurchaseOrders',
        query: { 'model.receiveDateFrom': tenantTime.toFilterValue({ date: since }) },
        arrayQuery: { 'model.companyIDList': companies, 'model.receiveWarehouseID': warehouses },
        maxPages,
        startPage,
        keepPartialOnError: true,
    });
}

// With SKUs: the current quantity of each, read 50 at a time. With only a warehouse: the
// products updated since `since` that are at or below the threshold. SellerCloud requires
// a quantity range whenever a warehouse filter is sent.
async function inventory({ auth, store, since, skus, warehouseId, companies, maxQty, maxPages, startPage }: InventoryParams): Promise<ListPagesResult<InventoryRecord>> {
    const token = await sellercloudClient.getToken({ auth, store });
    const arrayQuery = { 'model.warehouse': warehouseId === null ? undefined : [warehouseId], 'model.companyID': companies };
    if (skus.length === 0) {
        return sellercloudListing.listPages<InventoryRecord>({
            auth,
            token,
            path: '/Inventory',
            query: { ...warehouseRange({ warehouseId, maxQty }), 'model.lastUpdatedFrom': tenantTime.toFilterValue({ date: since }) },
            arrayQuery,
            maxPages,
            startPage,
            keepPartialOnError: true,
        });
    }
    const items = await inventoryBySku({ auth, token, skus, warehouseId, companies });
    return { items, total: items.length, truncated: false, nextPage: 1 };
}

// The current quantity of specific products, whatever their level.
async function inventoryBySku({ auth, token, skus, warehouseId, companies }: InventoryBySkuParams): Promise<InventoryRecord[]> {
    const chunks = Array.from({ length: Math.ceil(skus.length / SKUS_PER_REQUEST) }, (_, index) => skus.slice(index * SKUS_PER_REQUEST, (index + 1) * SKUS_PER_REQUEST));
    const arrayQuery = { 'model.warehouse': warehouseId === null ? undefined : [warehouseId], 'model.companyID': companies };
    const pages = [];
    for (const chunk of chunks) {
        const { items } = await sellercloudListing.listPages<InventoryRecord>({
            auth,
            token,
            path: '/Inventory',
            query: { ...warehouseRange({ warehouseId, maxQty: null }), 'model.inventoryID': chunk.join(',') },
            arrayQuery,
            maxPages: 2,
        });
        pages.push(items);
    }
    return pages.flat();
}

function warehouseRange({ warehouseId, maxQty }: { warehouseId: number | null; maxQty: number | null }): Record<string, number> {
    return warehouseId === null ? {} : { 'model.physicalQtyFrom': MIN_QTY, 'model.physicalQtyTo': maxQty ?? MAX_QTY };
}

const SKUS_PER_REQUEST = 50;
const MIN_QTY = -1000000;
const MAX_QTY = 1000000000;

export const sellercloudFeeds = { orders, returns, receivedPurchaseOrders, inventory, inventoryBySku };

export type InventoryRecord = {
    ID: string;
    ProductName?: string | null;
    PhysicalQty?: number | null;
    WarehousePhysicalQty?: number | null;
    InventoryAvailableQty?: number | null;
    ReservedQty?: number | null;
    WarehouseName?: string | null;
    CompanyID?: number | null;
    CompanyName?: string | null;
    BrandName?: string | null;
    ManufacturerSKU?: string | null;
    LastModifiedDate?: string | null;
};

type TokenStoreLike = Parameters<typeof sellercloudClient.getToken>[0]['store'];

type ScopedParams = {
    auth: SellercloudAuthProps;
    store: TokenStoreLike;
    since: Date;
    channels?: number[];
    companies?: number[];
    maxPages: number;
    startPage?: number;
};

type OrdersParams = ScopedParams & { dateField: 'created' | 'updated' };

type PurchaseOrderParams = {
    auth: SellercloudAuthProps;
    store: TokenStoreLike;
    since: Date;
    companies?: number[];
    warehouses?: number[];
    maxPages: number;
    startPage?: number;
};

type InventoryParams = {
    auth: SellercloudAuthProps;
    store: TokenStoreLike;
    since: Date;
    skus: string[];
    warehouseId: number | null;
    companies?: number[];
    maxQty: number | null;
    maxPages: number;
    startPage?: number;
};

type InventoryBySkuParams = {
    auth: SellercloudAuthProps;
    token: string;
    skus: string[];
    warehouseId: number | null;
    companies?: number[];
};
