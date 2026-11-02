import { tryCatchSync } from '@activepieces/shared';
import { turn14Client } from './client';

// Custom API Call must not become a way around the order safety checks: any non-GET call to the
// quote or order endpoints is refused before it is sent.
function assertAllowed({ propsValue }: { propsValue: unknown }): void {
    const values = turn14Client.isRecord(propsValue) ? propsValue : {};
    const method = typeof values['method'] === 'string' ? values['method'].toUpperCase() : 'GET';
    const urlProp = values['url'];
    const url = turn14Client.isRecord(urlProp) && typeof urlProp['url'] === 'string' ? urlProp['url'] : '';
    if (method !== 'GET' && isOrderPath({ url })) {
        throw new Error(`Custom API Call refuses ${method} ${url}: quotes and orders must go through Create Shipping Quote / Place Order From Quote, which check the environment and guard against duplicate orders.`);
    }
}

function isOrderPath({ url }: { url: string }): boolean {
    const decoded = tryCatchSync(() => decodeURIComponent(url.trim())).data ?? url.trim();
    const resolved = tryCatchSync(() => new URL(decoded.replace(/^\/+/, ''), 'https://turn14.invalid/v1/')).data;
    if (resolved === null) {
        return true;
    }
    const path = resolved.pathname.toLowerCase().replace(/\/{2,}/g, '/').replace(/^(\/v1)+(?=\/|$)/, '');
    return /^\/(quotes?|orders?)(\/|$)/.test(path);
}

export const turn14CustomCall = { assertAllowed, isOrderPath };
