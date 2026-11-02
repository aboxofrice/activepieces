import { HttpMethod } from '@activepieces/pieces-common';
import { AmazonSellerAuthProps, spApiClient } from './client';

async function listFbaInventory({ auth, marketplaceId, sellerSkus, startDateTime, details, maxRows }: ListFbaInventoryParams): Promise<FbaInventorySummary[]> {
    return spApiClient.fetchPages<FbaInventoryPage, FbaInventorySummary>({
        maxRows,
        // Unlike getOrders, this endpoint wants the full filter set repeated with nextToken.
        fetchPage: ({ nextToken }) => spApiClient.request({
            auth,
            method: HttpMethod.GET,
            path: '/fba/inventory/v1/summaries',
            queryParams: {
                granularityType: 'Marketplace',
                granularityId: marketplaceId,
                marketplaceIds: [marketplaceId],
                details,
                sellerSkus,
                startDateTime,
                nextToken,
            },
        }),
        rowsOf: ({ page }) => page.payload?.inventorySummaries ?? [],
        nextTokenOf: ({ page }) => page.pagination?.nextToken,
    });
}

function flattenFbaSummary({ summary }: { summary: FbaInventorySummary }): FlatFbaInventory {
    const d = summary.inventoryDetails;
    return {
        seller_sku: summary.sellerSku ?? null,
        asin: summary.asin ?? null,
        fn_sku: summary.fnSku ?? null,
        product_name: summary.productName ?? null,
        condition: summary.condition ?? null,
        total_quantity: summary.totalQuantity ?? null,
        last_updated_time: summary.lastUpdatedTime ?? null,
        fulfillable_quantity: d?.fulfillableQuantity ?? null,
        inbound_working_quantity: d?.inboundWorkingQuantity ?? null,
        inbound_shipped_quantity: d?.inboundShippedQuantity ?? null,
        inbound_receiving_quantity: d?.inboundReceivingQuantity ?? null,
        reserved_total_quantity: d?.reservedQuantity?.totalReservedQuantity ?? null,
        reserved_pending_customer_order_quantity: d?.reservedQuantity?.pendingCustomerOrderQuantity ?? null,
        reserved_pending_transshipment_quantity: d?.reservedQuantity?.pendingTransshipmentQuantity ?? null,
        reserved_fc_processing_quantity: d?.reservedQuantity?.fcProcessingQuantity ?? null,
        unfulfillable_total_quantity: d?.unfulfillableQuantity?.totalUnfulfillableQuantity ?? null,
        researching_total_quantity: d?.researchingQuantity?.totalResearchingQuantity ?? null,
    };
}

export const fbaInventory = { listFbaInventory, flattenFbaSummary };

export type FlatFbaInventory = {
    seller_sku: string | null;
    asin: string | null;
    fn_sku: string | null;
    product_name: string | null;
    condition: string | null;
    total_quantity: number | null;
    last_updated_time: string | null;
    fulfillable_quantity: number | null;
    inbound_working_quantity: number | null;
    inbound_shipped_quantity: number | null;
    inbound_receiving_quantity: number | null;
    reserved_total_quantity: number | null;
    reserved_pending_customer_order_quantity: number | null;
    reserved_pending_transshipment_quantity: number | null;
    reserved_fc_processing_quantity: number | null;
    unfulfillable_total_quantity: number | null;
    researching_total_quantity: number | null;
};

type FbaInventorySummary = {
    asin?: string;
    fnSku?: string;
    sellerSku?: string;
    condition?: string;
    productName?: string;
    lastUpdatedTime?: string;
    totalQuantity?: number;
    inventoryDetails?: {
        fulfillableQuantity?: number;
        inboundWorkingQuantity?: number;
        inboundShippedQuantity?: number;
        inboundReceivingQuantity?: number;
        reservedQuantity?: { totalReservedQuantity?: number; pendingCustomerOrderQuantity?: number; pendingTransshipmentQuantity?: number; fcProcessingQuantity?: number };
        unfulfillableQuantity?: { totalUnfulfillableQuantity?: number };
        researchingQuantity?: { totalResearchingQuantity?: number };
    };
};

type FbaInventoryPage = {
    payload?: { inventorySummaries?: FbaInventorySummary[] };
    pagination?: { nextToken?: string };
};

type ListFbaInventoryParams = {
    auth: AmazonSellerAuthProps;
    marketplaceId: string;
    sellerSkus?: string[];
    startDateTime?: string;
    details: boolean;
    maxRows?: number;
};
