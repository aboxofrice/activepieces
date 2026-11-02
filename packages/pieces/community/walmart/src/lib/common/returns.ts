import { HttpMethod } from '@activepieces/pieces-common';
import { WalmartAuthProps, walmartClient } from './client';
import { walmartJson } from './json';

const { stringAt, numberAt, arrayAt, cursorRequest } = walmartJson;

async function listReturns({ auth, filters, maxReturns }: { auth: WalmartAuthProps; filters: ReturnFilters; maxReturns: number }): Promise<FlatReturn[]> {
    const collect = async ({ cursor, collected }: { cursor?: string; collected: FlatReturn[] }): Promise<FlatReturn[]> => {
        const page = await walmartClient.request<unknown>({
            auth,
            method: HttpMethod.GET,
            ...(cursor
                ? cursorRequest({ basePath: '/v3/returns', cursor })
                : { path: '/v3/returns', queryParams: { ...filters, limit: Math.min(RETURNS_PAGE_SIZE, Math.max(1, maxReturns)) } }),
        });
        const returns = arrayAt({ value: page, path: ['returnOrders'] }).map((returnOrder) => flattenReturn({ returnOrder }));
        const all = [...collected, ...returns];
        const next = stringAt({ value: page, path: ['meta', 'nextCursor'] });
        if (all.length >= maxReturns || returns.length === 0 || !next) {
            return all.slice(0, maxReturns);
        }
        return collect({ cursor: next, collected: all });
    };
    return collect({ collected: [] });
}

function flattenReturn({ returnOrder }: { returnOrder: Record<string, unknown> }): FlatReturn {
    const lines = arrayAt({ value: returnOrder, path: ['returnOrderLines'] }).map((line) => ({
        return_line_number: stringAt({ value: line, path: ['returnOrderLineNumber'] }) ?? '',
        purchase_order_id: stringAt({ value: line, path: ['purchaseOrderId'] }) ?? null,
        purchase_order_line_number: stringAt({ value: line, path: ['purchaseOrderLineNumber'] }) ?? null,
        sku: stringAt({ value: line, path: ['item', 'sku'] }) ?? '',
        product_name: stringAt({ value: line, path: ['item', 'productName'] }) ?? '',
        quantity: numberAt({ value: line, path: ['quantity', 'measurementValue'] }) ?? numberAt({ value: line, path: ['quantity'] }) ?? 0,
        status: stringAt({ value: line, path: ['status'] }) ?? '',
        return_reason: stringAt({ value: line, path: ['returnReason'] }) ?? null,
        refunded_quantity: numberAt({ value: line, path: ['refundedQty'] }) ?? 0,
        current_refund_status: stringAt({ value: line, path: ['currentRefundStatus'] }) ?? null,
        current_delivery_status: stringAt({ value: line, path: ['currentDeliveryStatus'] }) ?? null,
        line_total: numberAt({ value: line, path: ['chargeTotals', 'lineTotal', 'currencyAmount'] }) ?? null,
    }));
    return {
        return_order_id: stringAt({ value: returnOrder, path: ['returnOrderId'] }) ?? '',
        customer_order_id: stringAt({ value: returnOrder, path: ['customerOrderId'] }) ?? null,
        return_order_date: stringAt({ value: returnOrder, path: ['returnOrderDate'] }) ?? null,
        return_by_date: stringAt({ value: returnOrder, path: ['returnByDate'] }) ?? null,
        return_type: stringAt({ value: returnOrder, path: ['returnType'] }) ?? null,
        refund_mode: stringAt({ value: returnOrder, path: ['refundMode'] }) ?? null,
        return_channel: stringAt({ value: returnOrder, path: ['returnChannel', 'channelName'] }) ?? null,
        total_refund_amount: numberAt({ value: returnOrder, path: ['totalRefundAmount', 'currencyAmount'] }) ?? null,
        currency: stringAt({ value: returnOrder, path: ['totalRefundAmount', 'currencyUnit'] }) ?? null,
        line_count: lines.length,
        statuses: [...new Set(lines.map((line) => line.status).filter((status) => status.length > 0))].join(', '),
        purchase_order_ids: [...new Set(lines.map((line) => line.purchase_order_id).filter((id) => id !== null))].join(', '),
        skus: lines.map((line) => line.sku).join(', '),
        return_lines: lines,
        raw: returnOrder,
    };
}

const RETURNS_PAGE_SIZE = 200;

export const RETURN_STATUSES = ['INITIATED', 'DELIVERED', 'COMPLETED'];

export const walmartReturns = {
    listReturns,
};

export type ReturnFilters = {
    returnOrderId?: string;
    customerOrderId?: string;
    status?: string;
    returnCreationStartDate?: string;
    returnCreationEndDate?: string;
};

export type FlatReturnLine = {
    return_line_number: string;
    purchase_order_id: string | null;
    purchase_order_line_number: string | null;
    sku: string;
    product_name: string;
    quantity: number;
    status: string;
    return_reason: string | null;
    refunded_quantity: number;
    current_refund_status: string | null;
    current_delivery_status: string | null;
    line_total: number | null;
};

export type FlatReturn = {
    return_order_id: string;
    customer_order_id: string | null;
    return_order_date: string | null;
    return_by_date: string | null;
    return_type: string | null;
    refund_mode: string | null;
    return_channel: string | null;
    total_refund_amount: number | null;
    currency: string | null;
    line_count: number;
    statuses: string;
    purchase_order_ids: string;
    skus: string;
    return_lines: FlatReturnLine[];
    raw: Record<string, unknown>;
};
