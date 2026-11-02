import { HttpMethod } from '@activepieces/pieces-common';
import { WalmartAuthProps, walmartClient } from './client';
import { SubmittedFeed, walmartFeeds } from './feeds';
import { walmartJson } from './json';

async function updatePrice({ auth, sku, price, currency }: { auth: WalmartAuthProps; sku: string; price: number; currency: string }): Promise<{ sku: string; price: number; currency: string; message: string }> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.PUT,
        path: '/v3/price',
        body: { sku, pricing: [{ currentPriceType: 'BASE', currentPrice: { currency, amount: price } }] },
    });
    return {
        sku,
        price,
        currency,
        message: walmartJson.stringAt({ value: response, path: ['ItemPriceResponse', 'message'] }) ?? '',
    };
}

// Feed spec 1.7: one BASE price per SKU. Walmart allows 10,000 items per feed but
// recommends at most 1,000.
async function submitPriceFeed({ auth, items, currency }: { auth: WalmartAuthProps; items: PriceUpdate[]; currency: string }): Promise<SubmittedFeed> {
    return walmartFeeds.submitFeed({
        auth,
        feedType: 'price',
        payload: {
            PriceHeader: { version: '1.7' },
            Price: items.map((item) => ({
                sku: item.sku,
                pricing: [{ currentPriceType: 'BASE', currentPrice: { currency, amount: item.price } }],
            })),
        },
        itemCount: items.length,
    });
}

export const MAX_FEED_ITEMS = 10000;

export const walmartPrices = {
    updatePrice,
    submitPriceFeed,
};

export type PriceUpdate = { sku: string; price: number };
