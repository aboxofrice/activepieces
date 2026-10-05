import { isNil } from '@activepieces/shared';
import { SellercloudAuthProps, sellercloudClient } from './client';

// `/Catalog` returns only a fraction of the tenant's products (2,604 of ~240,953 here), so
// matching a supplier file against it silently drops most of the parts that do exist: on
// Romulus it matched 466 where ~2,690 were real. The inventory template is the only cheap
// source for the full product universe, and it doubles as a snapshot of current quantities,
// replacing one read per SKU with one request.
async function fetchWarehouseSnapshot({ auth, token, warehouseName, shadowSuffix }: FetchSnapshotParams): Promise<WarehouseSnapshot> {
    const base = auth.serverUrl.trim().replace(/\/+$/, '');
    const bearer = token ?? await sellercloudClient.getToken({ auth });
    const response = await fetch(`${base}/api/Inventory/Import/DownloadInventoryTemplate?template=2&fileFormat=1`, {
        headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!response.ok || isNil(response.body)) {
        throw new Error(`SellerCloud refused the inventory template: HTTP ${response.status}`);
    }
    return parseTemplate({ body: response.body, warehouseName, shadowSuffix });
}

// The payload is ~350 MB of base64 holding a row per product per warehouse, so it is decoded
// and filtered as it arrives rather than held in memory.
async function parseTemplate({ body, warehouseName, shadowSuffix }: { body: ReadableStream<Uint8Array>; warehouseName: string; shadowSuffix?: string }): Promise<WarehouseSnapshot> {
    const quantities = new Map<string, number>();
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let base64Tail = '';
    let lineTail = '';
    let header = true;

    const consume = (text: string) => {
        const lines = (lineTail + text).split(/\r?\n/);
        lineTail = lines.pop() ?? '';
        for (const line of lines) {
            if (header) {
                header = false;
                continue;
            }
            readRow({ line, warehouseName, quantities });
        }
    };

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        // base64 only decodes on 4-character boundaries, so carry the remainder.
        base64Tail += decoder.decode(value, { stream: true });
        const cut = base64Tail.length - (base64Tail.length % 4);
        if (cut > 0) {
            consume(Buffer.from(base64Tail.slice(0, cut), 'base64').toString('utf8'));
            base64Tail = base64Tail.slice(cut);
        }
    }
    if (base64Tail.length > 0) {
        consume(Buffer.from(base64Tail, 'base64').toString('utf8'));
    }
    if (lineTail.length > 0) {
        readRow({ line: lineTail, warehouseName, quantities });
    }
    return resolveShadows({ quantities, shadowSuffix });
}

function readRow({ line, warehouseName, quantities }: { line: string; warehouseName: string; quantities: Map<string, number> }): void {
    const cells = line.split('\t');
    if (cells.length < 3 || cells[1] !== warehouseName) {
        return;
    }
    const quantity = Number.parseInt(cells[2], 10);
    quantities.set(cells[0], Number.isNaN(quantity) ? 0 : quantity);
}

// A shadow SKU reports 0 on its own row and shares its parent's stock, and the parent's is
// the number an import actually moves. Verified against 2,166 per-SKU reads with no mismatch.
// Only the configured shadow suffix is stripped. Splitting on any dash made SKUs that merely
// contain one inherit an unrelated product's stock (4,392 SKUs appeared to hold stock against
// a verified 3,322).
function resolveShadows({ quantities, shadowSuffix }: { quantities: Map<string, number>; shadowSuffix?: string }): WarehouseSnapshot {
    const suffix = shadowSuffix?.trim();
    if (isNil(suffix) || suffix.length === 0) {
        return { quantities, productIds: [...quantities.keys()] };
    }
    const resolved = new Map<string, number>();
    for (const [sku, quantity] of quantities) {
        const isShadow = sku.endsWith(suffix) && sku.length > suffix.length;
        const effective = quantity === 0 && isShadow ? quantities.get(sku.slice(0, -suffix.length)) ?? 0 : quantity;
        resolved.set(sku, effective);
    }
    return { quantities: resolved, productIds: [...resolved.keys()] };
}

export const warehouseSnapshot = {
    fetchWarehouseSnapshot,
};

export type WarehouseSnapshot = {
    quantities: Map<string, number>;
    productIds: string[];
};

type FetchSnapshotParams = {
    auth: SellercloudAuthProps;
    token?: string;
    warehouseName: string;
    shadowSuffix?: string;
};
