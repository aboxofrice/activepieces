import { HttpMethod } from '@activepieces/pieces-common';
import { WalmartAuthProps, walmartClient } from './client';
import { SubmittedFeed, walmartFeeds } from './feeds';

async function getInventory({ auth, sku, shipNode }: { auth: WalmartAuthProps; sku: string; shipNode?: string }): Promise<FlatInventory> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        path: '/v3/inventory',
        queryParams: { sku, shipNode },
    });
    return flattenInventory({ response, fallbackSku: sku, shipNode });
}

async function updateInventory({ auth, sku, quantity, shipNode }: { auth: WalmartAuthProps; sku: string; quantity: number; shipNode?: string }): Promise<FlatInventory> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.PUT,
        path: '/v3/inventory',
        queryParams: { sku, shipNode },
        body: { sku, quantity: { unit: 'EACH', amount: quantity } },
    });
    return flattenInventory({ response, fallbackSku: sku, shipNode });
}

// The feed is the bulk path Walmart recommends for more than a handful of SKUs: one
// request, processed asynchronously, tracked by feed id. Spec 1.4 sets one quantity per
// SKU at the default ship node.
async function submitInventoryFeed({ auth, items }: { auth: WalmartAuthProps; items: InventoryUpdate[] }): Promise<SubmittedFeed> {
    return walmartFeeds.submitFeed({
        auth,
        feedType: 'inventory',
        payload: {
            InventoryHeader: { version: '1.4' },
            Inventory: items.map((item) => ({ sku: item.sku, quantity: { unit: 'EACH', amount: item.quantity } })),
        },
        itemCount: items.length,
    });
}

function flattenInventory({ response, fallbackSku, shipNode }: { response: unknown; fallbackSku: string; shipNode?: string }): FlatInventory {
    const body = walmartClient.isRecord(response) ? response : {};
    const quantity = walmartClient.isRecord(body['quantity']) ? body['quantity'] : {};
    return {
        sku: stringOf({ value: body['sku'] }) ?? fallbackSku,
        quantity: numberOf({ value: quantity['amount'] }),
        unit: stringOf({ value: quantity['unit'] }) ?? 'EACH',
        ship_node: shipNode ?? null,
        inventory_available_date: stringOf({ value: body['inventoryAvailableDate'] }) ?? null,
    };
}

function stringOf({ value }: { value: unknown }): string | undefined {
    return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;
}

function numberOf({ value }: { value: unknown }): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export const walmartInventory = {
    getInventory,
    updateInventory,
    submitInventoryFeed,
};

export type InventoryUpdate = { sku: string; quantity: number };

export type FlatInventory = {
    sku: string;
    quantity: number;
    unit: string;
    ship_node: string | null;
    inventory_available_date: string | null;
};
