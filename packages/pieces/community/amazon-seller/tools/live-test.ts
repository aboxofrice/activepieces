/**
 * Smoke-tests the piece against a real SP-API account.
 *
 *   npx tsx --tsconfig tsconfig.base.json \
 *     packages/pieces/community/amazon-seller/tools/live-test.ts <creds.json> read|sandbox-write
 *
 * The creds file holds the connection's auth props (clientId, clientSecret, refreshToken,
 * marketplaceId, sellerId, sandbox). `read` only calls GET endpoints. `sandbox-write` refuses to
 * run unless the creds point at the SP-API sandbox host, which never changes real data.
 */
import { readFileSync } from 'fs';
import { amazonSeller } from '../src/index';
import { spApiClient } from '../src/lib/common/client';

async function main() {
    const [credsPath, mode] = process.argv.slice(2);
    const props = JSON.parse(readFileSync(credsPath, 'utf8'));
    const actions = amazonSeller.actions();
    const run = async (name: string, propsValue: Record<string, unknown>) => {
        const started = Date.now();
        try {
            const result = await actions[name].run({ auth: { props }, propsValue } as never);
            console.log(`OK    ${name} (${Date.now() - started}ms) ${summarize(result)}`);
            return result;
        } catch (error) {
            console.log(`FAIL  ${name} (${Date.now() - started}ms) ${(error as Error).message.slice(0, 400)}`);
            return null;
        }
    };

    if (mode === 'sandbox-write') {
        const base = spApiClient.apiBase({ auth: props });
        if (!props.sandbox || !base.startsWith('https://sandbox.')) {
            throw new Error(`Refusing to run writes: ${base} is not the SP-API sandbox.`);
        }
        console.log(`Sandbox host: ${base}`);
        await run('update_listing_quantity', { sku: 'ABC123', quantity: 5, productType: 'PRODUCT', validationOnly: false });
        await run('get_message_types_for_order', { orderId: '123-1234567-1234567' });
        await run('send_buyer_message', { orderId: '123-1234567-1234567', messageType: 'confirmOrderDetails', text: 'My Message' });
        await run('get_buyer_attributes', { orderId: '123-1234567-1234567' });
        await run('update_listing_price', { sku: 'ABC123', price: 19.99, productType: 'PRODUCT', validationOnly: false });
        await run('confirm_shipment', {
            orderId: '902-1106328-1059050', carrierCode: 'FedEx', carrierName: 'FedEx', shippingMethod: 'FedEx Ground', trackingNumber: '112345678',
            shipDate: '2022-02-11T01:00:00.000Z', items: [{ orderItemId: '79039765272157', quantity: 1 }], packageReferenceId: '1',
        });
        await run('cancel_order', { orderId: '902-1106328-1059050', reason: 'NoInventory', orderItemIds: ['79039765272157'] });
        return;
    }

    const orders = (await run('list_orders', { lastUpdatedAfter: new Date(Date.now() - 3 * 86400000).toISOString(), maxResults: 5 })) as { amazon_order_id: string; fulfillment_channel: string }[] | null;
    const orderId = orders?.find((o) => o.fulfillment_channel === 'MFN')?.amazon_order_id ?? orders?.[0]?.amazon_order_id;
    if (orderId) {
        await run('get_order', { orderId, includeItems: true });
        const items = (await run('get_order_items', { orderId })) as { seller_sku: string }[] | null;
        await run('get_message_types_for_order', { orderId });
        await run('get_buyer_attributes', { orderId });
        await run('get_order_financials', { orderId });
        const sku = items?.[0]?.seller_sku;
        if (sku) {
            await run('get_listing', { sku });
        }
    }
    await run('get_fba_inventory_summaries', { maxResults: 5 });
    await run('list_orders', { createdAfter: new Date(Date.now() - 86400000).toISOString(), orderStatuses: ['Unshipped'], fulfillmentChannels: ['MFN'], maxResults: 3 });

    await run('get_catalog_item', { asin: 'B07SZ61D9V' });
    await run('search_catalog_items', { keywords: 'FC3Z-6A785-C', maxResults: 5 });
    await run('search_catalog_items', { identifiers: ['PC1BZ-8213-A'], identifiersType: 'SKU' });
    await run('check_part_fitment', { asin: 'B07SZ61D9V', year: 2016, make: 'Ford', model: 'F-250 Super Duty' });
    await run('check_part_fitment', { asin: 'B07SZ61D9V', year: 2019, make: 'Ford', model: 'F-250 Super Duty' });
    await run('check_part_fitment', { sku: 'PC1BZ-8213-A', vin: process.env['TEST_VIN'] ?? '1FADP3K29GL000000' });
    await run('get_product_type_definition', { productType: 'AUTO_PART', requirements: 'LISTING_OFFER_ONLY', includeAttributes: true });
    await run('get_product_type_definition', { itemName: 'Ford oil separator assembly' });
    if (process.env['FEED_ID']) {
        await run('get_feed_status', { feedId: process.env['FEED_ID'], includeResult: true });
    }
    if (process.env['RETURNS'] === '1') {
        await run('get_returns', { reportType: 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE', reportId: process.env['RETURNS_REPORT_ID'], waitSeconds: 240 });
    }

    const store = memoryStore();
    const trigger = amazonSeller.triggers()['new_order'];
    try {
        const sample = await trigger.test({ auth: { props }, propsValue: {}, store } as never);
        console.log(`OK    new_order.test ${summarize(sample)}`);
        await store.put('amazon_new_order_enabled_at', Date.now() - 86400000);
        await store.put('amazon_new_order_last_poll', Date.now() - 6 * 3600000);
        await store.put('amazon_new_order_seen', {});
        const first = await trigger.run({ auth: { props }, propsValue: {}, store } as never);
        const second = await trigger.run({ auth: { props }, propsValue: {}, store } as never);
        console.log(`OK    new_order.run first=${(first as unknown[]).length} second(dedupe)=${(second as unknown[]).length}`);
    } catch (error) {
        console.log(`FAIL  new_order ${(error as Error).message.slice(0, 400)}`);
    }
}

function summarize(result: unknown): string {
    if (Array.isArray(result)) {
        return `rows=${result.length} keys=${Object.keys(result[0] ?? {}).slice(0, 8).join(',')}`;
    }
    return JSON.stringify(result).slice(0, 300);
}

function memoryStore() {
    const data = new Map<string, unknown>();
    return {
        put: async (key: string, value: unknown) => { data.set(key, value); return value; },
        get: async (key: string) => data.get(key) ?? null,
        delete: async (key: string) => { data.delete(key); },
    };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
