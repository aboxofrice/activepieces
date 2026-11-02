import { turn14Client } from './client';

// Custom API Call is read-only. Writes (quotes, orders and anything else) must go through the
// actions that carry the environment guard and duplicate-order checks; a path filter could be
// bypassed with encodings or suffixes, so every non-GET method is refused before sending.
function assertAllowed({ propsValue }: { propsValue: unknown }): void {
    const values = turn14Client.isRecord(propsValue) ? propsValue : {};
    const method = typeof values['method'] === 'string' ? values['method'].toUpperCase() : 'GET';
    if (method !== 'GET') {
        throw new Error(`Custom API Call only sends GET requests to Turn14 (got ${method}). Use Create Shipping Quote / Place Order From Quote for quotes and orders.`);
    }
}

export const turn14CustomCall = { assertAllowed };
