import { HttpMethod } from '@activepieces/pieces-common';
import { WalmartAuthProps, walmartClient } from './client';
import { walmartJson } from './json';

const { valueAt, stringAt, numberAt, arrayAt, isoFromEpoch, round, cursorRequest } = walmartJson;

// Walmart returns meta.nextCursor as a ready-made query string ("?limit=...&soIndex=...");
// the next page is fetched by sending exactly that query, with no other filters, because
// the cursor already carries them.
async function listOrders({ auth, filters, maxOrders }: { auth: WalmartAuthProps; filters: OrderFilters; maxOrders: number }): Promise<RawOrder[]> {
    return collectPages({
        auth,
        maxOrders,
        firstPage: { path: '/v3/orders', queryParams: { ...filters, limit: Math.min(MAX_PAGE_SIZE, Math.max(1, maxOrders)) } },
        collected: [],
    });
}

async function collectPages({ auth, maxOrders, firstPage, cursor, collected }: CollectPagesParams): Promise<RawOrder[]> {
    const page = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        ...(cursor ? cursorRequest({ basePath: '/v3/orders', cursor }) : firstPage),
    });
    const all = [...collected, ...ordersOf({ page })];
    const nextCursor = stringAt({ value: page, path: ['list', 'meta', 'nextCursor'] });
    if (all.length >= maxOrders || !nextCursor) {
        return all.slice(0, maxOrders);
    }
    return collectPages({ auth, maxOrders, firstPage, cursor: nextCursor, collected: all });
}

async function getOrder({ auth, purchaseOrderId }: { auth: WalmartAuthProps; purchaseOrderId: string }): Promise<RawOrder> {
    const response = await walmartClient.request<unknown>({
        auth,
        method: HttpMethod.GET,
        path: `/v3/orders/${encodeURIComponent(purchaseOrderId)}`,
    });
    const order = valueAt({ value: response, path: ['order'] });
    if (!walmartClient.isRecord(order)) {
        throw new Error(`Walmart returned no order for purchase order ${purchaseOrderId}`);
    }
    return order;
}

function ordersOf({ page }: { page: unknown }): RawOrder[] {
    return arrayAt({ value: page, path: ['list', 'elements', 'order'] });
}

// Walmart nests every order several levels deep; flows feed this into sheets and tables,
// so the order is flattened to one row and each line to one flat object. `raw` keeps the
// original for anything not surfaced here.
function flattenOrder({ order }: { order: RawOrder }): FlatOrder {
    const lines = arrayAt({ value: order, path: ['orderLines', 'orderLine'] })
        .map((line) => flattenLine({ line }));
    const orderDateMs = numberAt({ value: order, path: ['orderDate'] });
    const address = ['shippingInfo', 'postalAddress'];
    return {
        purchase_order_id: stringAt({ value: order, path: ['purchaseOrderId'] }) ?? '',
        customer_order_id: stringAt({ value: order, path: ['customerOrderId'] }) ?? '',
        order_date: isoFromEpoch({ epoch: orderDateMs }),
        order_date_epoch_ms: orderDateMs ?? null,
        order_type: stringAt({ value: order, path: ['orderType'] }) ?? null,
        customer_email: stringAt({ value: order, path: ['customerEmailId'] }) ?? null,
        ship_node_type: stringAt({ value: order, path: ['shipNode', 'type'] }) ?? null,
        ship_method: stringAt({ value: order, path: ['shippingInfo', 'methodCode'] }) ?? null,
        estimated_ship_date: isoFromEpoch({ epoch: numberAt({ value: order, path: ['shippingInfo', 'estimatedShipDate'] }) }),
        estimated_delivery_date: isoFromEpoch({ epoch: numberAt({ value: order, path: ['shippingInfo', 'estimatedDeliveryDate'] }) }),
        ship_to_name: stringAt({ value: order, path: [...address, 'name'] }) ?? null,
        ship_to_address1: stringAt({ value: order, path: [...address, 'address1'] }) ?? null,
        ship_to_address2: stringAt({ value: order, path: [...address, 'address2'] }) ?? null,
        ship_to_city: stringAt({ value: order, path: [...address, 'city'] }) ?? null,
        ship_to_state: stringAt({ value: order, path: [...address, 'state'] }) ?? null,
        ship_to_postal_code: stringAt({ value: order, path: [...address, 'postalCode'] }) ?? null,
        ship_to_country: stringAt({ value: order, path: [...address, 'country'] }) ?? null,
        ship_to_phone: stringAt({ value: order, path: ['shippingInfo', 'phone'] }) ?? null,
        line_count: lines.length,
        total_quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        order_total: round({ value: lines.reduce((sum, line) => sum + line.product_amount + line.shipping_amount + line.tax_amount, 0) }),
        currency: lines.find((line) => line.currency)?.currency ?? null,
        statuses: [...new Set(lines.map((line) => line.status).filter((status) => status.length > 0))].join(', '),
        skus: lines.map((line) => line.sku).join(', '),
        order_lines: lines,
        raw: order,
    };
}

function flattenLine({ line }: { line: Record<string, unknown> }): FlatOrderLine {
    const charges = arrayAt({ value: line, path: ['charges', 'charge'] });
    const sumCharges = ({ chargeType }: { chargeType: string }) => charges
        .filter((charge) => charge['chargeType'] === chargeType)
        .reduce((sum, charge) => sum + (numberAt({ value: charge, path: ['chargeAmount', 'amount'] }) ?? 0), 0);
    const tax = charges.reduce((sum, charge) => sum + (numberAt({ value: charge, path: ['tax', 'taxAmount', 'amount'] }) ?? 0), 0);
    const statuses = arrayAt({ value: line, path: ['orderLineStatuses', 'orderLineStatus'] });
    const tracking = statuses.map((status) => valueAt({ value: status, path: ['trackingInfo'] })).find(walmartClient.isRecord);
    return {
        line_number: stringAt({ value: line, path: ['lineNumber'] }) ?? '',
        sku: stringAt({ value: line, path: ['item', 'sku'] }) ?? '',
        product_name: stringAt({ value: line, path: ['item', 'productName'] }) ?? '',
        quantity: numberAt({ value: line, path: ['orderLineQuantity', 'amount'] }) ?? 0,
        status: statuses.map((status) => stringAt({ value: status, path: ['status'] })).filter((status) => status !== undefined).join(', '),
        product_amount: round({ value: sumCharges({ chargeType: 'PRODUCT' }) }),
        shipping_amount: round({ value: sumCharges({ chargeType: 'SHIPPING' }) }),
        tax_amount: round({ value: tax }),
        currency: charges.map((charge) => stringAt({ value: charge, path: ['chargeAmount', 'currency'] })).find((currency) => currency !== undefined) ?? null,
        carrier: tracking
            ? stringAt({ value: tracking, path: ['carrierName', 'carrier'] }) ?? stringAt({ value: tracking, path: ['carrierName', 'otherCarrier'] }) ?? null
            : null,
        tracking_number: tracking ? stringAt({ value: tracking, path: ['trackingNumber'] }) ?? null : null,
    };
}

const MAX_PAGE_SIZE = 200;

export const ORDER_STATUSES = ['Created', 'Acknowledged', 'Shipped', 'Delivered', 'Cancelled'];

export const SHIP_NODE_TYPES = ['SellerFulfilled', 'WFSFulfilled', '3PLFulfilled'];

export const walmartOrders = {
    listOrders,
    getOrder,
    flattenOrder,
};

export type RawOrder = Record<string, unknown>;

export type OrderFilters = {
    createdStartDate?: string;
    createdEndDate?: string;
    status?: string;
    shipNodeType?: string;
    sku?: string;
    customerOrderId?: string;
};

export type FlatOrderLine = {
    line_number: string;
    sku: string;
    product_name: string;
    quantity: number;
    status: string;
    product_amount: number;
    shipping_amount: number;
    tax_amount: number;
    currency: string | null;
    carrier: string | null;
    tracking_number: string | null;
};

export type FlatOrder = {
    purchase_order_id: string;
    customer_order_id: string;
    order_date: string | null;
    order_date_epoch_ms: number | null;
    order_type: string | null;
    customer_email: string | null;
    ship_node_type: string | null;
    ship_method: string | null;
    estimated_ship_date: string | null;
    estimated_delivery_date: string | null;
    ship_to_name: string | null;
    ship_to_address1: string | null;
    ship_to_address2: string | null;
    ship_to_city: string | null;
    ship_to_state: string | null;
    ship_to_postal_code: string | null;
    ship_to_country: string | null;
    ship_to_phone: string | null;
    line_count: number;
    total_quantity: number;
    order_total: number;
    currency: string | null;
    statuses: string;
    skus: string;
    order_lines: FlatOrderLine[];
    raw: RawOrder;
};

type CollectPagesParams = {
    auth: WalmartAuthProps;
    maxOrders: number;
    firstPage: { path: string; queryParams: Record<string, string | number | undefined> };
    cursor?: string;
    collected: RawOrder[];
};
