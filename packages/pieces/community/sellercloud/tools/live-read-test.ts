/**
 * Smoke-tests generated read actions against a real SellerCloud tenant.
 *
 *   npx tsx --tsconfig tsconfig.base.json \
 *     packages/pieces/community/sellercloud/tools/live-read-test.ts <creds.json>
 *
 * The creds file is the connection's auth props: serverUrl, username, password.
 */
import { readFileSync } from 'fs';
import { sellercloud } from '../src/index';

const CASES: { name: string; propsValue: Record<string, unknown> }[] = [
    { name: 'warehouses_get_all', propsValue: { pageSize: 5, pageNumber: 1 } },
    { name: 'product_conditions_get_get', propsValue: {} },
    { name: 'companies_get_all', propsValue: { pageSize: 5, pageNumber: 1 } },
    { name: 'settings_get_brands', propsValue: {} },
    { name: 'catalog_get_all', propsValue: { pageSize: 3, pageNumber: 1 } },
    { name: 'inventory_get_all', propsValue: { pageSize: 3, pageNumber: 1 } },
    { name: 'orders_get_all', propsValue: { pageSize: 3, pageNumber: 1 } },
    { name: 'catalog_get_product_types', propsValue: {} },
    { name: 'warehouses_get_all', propsValue: { warehouseIds: [1, 2] } },
    { name: 'catalog_views', propsValue: {} },
    { name: 'inventory_views', propsValue: {} },
    { name: 'settings_get_shipping_carriers', propsValue: { siteCode: 0 } },
    { name: 'settings_get_payment_terms', propsValue: {} },
    { name: 'companies_get_ebay_site_codes', propsValue: {} },
];

async function main() {
    const props = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const actions = await sellercloud.actions();
    for (const testCase of CASES) {
        const action = actions[testCase.name];
        if (!action) {
            console.log(`MISSING  ${testCase.name}`);
            continue;
        }
        try {
            const result = await action.run({ auth: { props }, propsValue: testCase.propsValue } as never);
            console.log(`OK       ${testCase.name}  ${JSON.stringify(result).slice(0, 200)}`);
        }
        catch (error) {
            console.log(`FAIL     ${testCase.name}  ${(error as Error).message.slice(0, 260)}`);
        }
    }
}

main();
