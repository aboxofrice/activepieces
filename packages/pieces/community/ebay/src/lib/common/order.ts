import { HttpMethod } from '@activepieces/pieces-common';
import { Property } from '@activepieces/pieces-framework';
import { EbayAuthProps, ebayClient } from './client';

function fulfillmentStatusProp() {
    return Property.StaticDropdown({
        displayName: 'Fulfillment Status',
        description: 'Leave empty for all orders.',
        required: false,
        options: {
            // eBay only accepts these two combinations for the orderfulfillmentstatus filter.
            options: [
                { label: 'Not shipped yet (not started or in progress)', value: 'NOT_STARTED|IN_PROGRESS' },
                { label: 'Shipped or partly shipped (fulfilled or in progress)', value: 'FULFILLED|IN_PROGRESS' },
            ],
        },
    });
}

function buildFilter({ dateField, from, to, fulfillmentStatus }: OrderFilter): string | undefined {
    const parts = [
        from || to ? `${dateField}:[${toEbayDate({ value: from })}..${toEbayDate({ value: to })}]` : null,
        fulfillmentStatus ? `orderfulfillmentstatus:{${fulfillmentStatus}}` : null,
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(',') : undefined;
}

async function listOrders({ auth, filter, orderIds, maxOrders, offset = 0 }: { auth: EbayAuthProps; filter: string | undefined; orderIds?: string; maxOrders: number; offset?: number }): Promise<{ orders: EbayOrder[]; total: number; truncated: boolean }> {
    const pages = await fetchOrderPages({ auth, filter, orderIds, offset, remaining: maxOrders });
    const orders = pages.flatMap((page) => page.orders ?? []).slice(0, maxOrders);
    const total = pages[0]?.total ?? 0;
    const last = pages[pages.length - 1];
    return {
        orders,
        total,
        truncated: !orderIds && !!last?.next && (last.orders?.length ?? 0) > 0 && offset + orders.length < total,
    };
}

async function getOrder({ auth, orderId }: { auth: EbayAuthProps; orderId: string }): Promise<EbayOrder> {
    return ebayClient.request<EbayOrder>({
        auth,
        method: HttpMethod.GET,
        path: `${FULFILLMENT_PATH}/order/${encodeURIComponent(orderId.trim())}`,
    });
}

async function listShippingFulfillments({ auth, orderId }: { auth: EbayAuthProps; orderId: string }): Promise<FlatShippingFulfillment[]> {
    const fulfillments = await listRawShippingFulfillments({ auth, orderId });
    return fulfillments.map((fulfillment) => flattenShippingFulfillment({ fulfillment }));
}

async function listRawShippingFulfillments({ auth, orderId }: { auth: EbayAuthProps; orderId: string }): Promise<EbayShippingFulfillment[]> {
    const response = await ebayClient.request<{ fulfillments?: EbayShippingFulfillment[] }>({
        auth,
        method: HttpMethod.GET,
        path: `${FULFILLMENT_PATH}/order/${encodeURIComponent(orderId.trim())}/shipping_fulfillment`,
    });
    return response.fulfillments ?? [];
}

function flattenShippingFulfillment({ fulfillment }: { fulfillment: EbayShippingFulfillment }): FlatShippingFulfillment {
    return {
        fulfillment_id: fulfillment.fulfillmentId ?? null,
        shipped_date: fulfillment.shippedDate ?? null,
        carrier: fulfillment.shippingCarrierCode ?? null,
        tracking_number: fulfillment.shipmentTrackingNumber ?? null,
        line_item_ids: (fulfillment.lineItems ?? []).map((lineItem) => lineItem.lineItemId).filter((id): id is string => !!id).join(', '),
    };
}

function flattenOrder({ order }: { order: EbayOrder }): FlatOrder {
    const instruction = order.fulfillmentStartInstructions?.[0];
    const shipTo = instruction?.shippingStep?.shipTo;
    const address = shipTo?.contactAddress;
    const lineItems = (order.lineItems ?? []).map((lineItem) => flattenLineItem({ lineItem }));
    return {
        order_id: order.orderId,
        legacy_order_id: order.legacyOrderId ?? null,
        sales_record_reference: order.salesRecordReference ?? null,
        creation_date: order.creationDate ?? null,
        last_modified_date: order.lastModifiedDate ?? null,
        order_fulfillment_status: order.orderFulfillmentStatus ?? null,
        order_payment_status: order.orderPaymentStatus ?? null,
        cancel_state: order.cancelStatus?.cancelState ?? null,
        seller_id: order.sellerId ?? null,
        buyer_username: order.buyer?.username ?? null,
        buyer_checkout_notes: order.buyerCheckoutNotes ?? null,
        ship_to_name: shipTo?.fullName ?? null,
        ship_to_email: shipTo?.email ?? null,
        ship_to_phone: shipTo?.primaryPhone?.phoneNumber ?? null,
        ship_to_address_line1: address?.addressLine1 ?? null,
        ship_to_address_line2: address?.addressLine2 ?? null,
        ship_to_city: address?.city ?? null,
        ship_to_state: address?.stateOrProvince ?? null,
        ship_to_postal_code: address?.postalCode ?? null,
        ship_to_country: address?.countryCode ?? null,
        shipping_service_code: instruction?.shippingStep?.shippingServiceCode ?? null,
        ship_by_date: instruction?.maxEstimatedDeliveryDate ?? null,
        currency: order.pricingSummary?.total?.currency ?? null,
        subtotal: amount({ value: order.pricingSummary?.priceSubtotal }),
        delivery_cost: amount({ value: order.pricingSummary?.deliveryCost }),
        tax: amount({ value: order.pricingSummary?.tax }),
        total: amount({ value: order.pricingSummary?.total }),
        total_marketplace_fee: amount({ value: order.totalMarketplaceFee }),
        total_due_seller: amount({ value: order.paymentSummary?.totalDueSeller }),
        line_item_count: lineItems.length,
        skus: lineItems.map((lineItem) => lineItem.sku).filter((sku): sku is string => !!sku).join(', '),
        line_items: lineItems,
    };
}

async function fetchOrderPages({ auth, filter, orderIds, offset, remaining }: { auth: EbayAuthProps; filter: string | undefined; orderIds?: string; offset: number; remaining: number }): Promise<EbayOrdersPage[]> {
    const limit = Math.min(PAGE_SIZE, remaining);
    const page = await ebayClient.request<EbayOrdersPage>({
        auth,
        method: HttpMethod.GET,
        path: `${FULFILLMENT_PATH}/order`,
        // eBay ignores `filter` when orderIds is set.
        queryParams: orderIds ? { orderIds } : { filter, limit, offset },
    });
    const fetched = page.orders?.length ?? 0;
    if (orderIds || !page.next || fetched === 0 || remaining - fetched <= 0) {
        return [page];
    }
    return [page, ...await fetchOrderPages({ auth, filter, offset: offset + fetched, remaining: remaining - fetched })];
}

function flattenLineItem({ lineItem }: { lineItem: EbayLineItem }): FlatLineItem {
    const tax = lineItem.ebayCollectAndRemitTaxes?.[0];
    return {
        line_item_id: lineItem.lineItemId ?? null,
        item_id: lineItem.legacyItemId ?? null,
        variation_id: lineItem.legacyVariationId ?? null,
        sku: lineItem.sku ?? null,
        title: lineItem.title ?? null,
        quantity: lineItem.quantity ?? null,
        line_item_cost: amount({ value: lineItem.lineItemCost }),
        line_total: amount({ value: lineItem.total }),
        shipping_cost: amount({ value: lineItem.deliveryCost?.shippingCost }),
        ebay_collected_tax: amount({ value: tax?.amount }),
        ebay_collected_tax_type: tax?.taxType ?? null,
        fulfillment_status: lineItem.lineItemFulfillmentStatus ?? null,
    };
}

function amount({ value }: { value: EbayAmount | undefined }): number | null {
    if (!value?.value) {
        return null;
    }
    const parsed = Number(value.value);
    return Number.isFinite(parsed) ? parsed : null;
}

// eBay requires full ISO 8601 UTC with milliseconds; an empty side of the range means open-ended.
function toEbayDate({ value }: { value: string | undefined }): string {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`"${value}" is not a valid date.`);
    }
    return date.toISOString();
}

const FULFILLMENT_PATH = '/sell/fulfillment/v1';
const PAGE_SIZE = 200;

export const orderCommon = {
    fulfillmentStatusProp,
    buildFilter,
    listOrders,
    getOrder,
    flattenOrder,
    listShippingFulfillments,
    listRawShippingFulfillments,
    flattenShippingFulfillment,
    fulfillmentPath: FULFILLMENT_PATH,
};

export type OrderFilter = {
    dateField: 'creationdate' | 'lastmodifieddate';
    from?: string;
    to?: string;
    fulfillmentStatus?: string;
};

export type EbayAmount = {
    value?: string;
    currency?: string;
};

export type EbayLineItem = {
    lineItemId?: string;
    legacyItemId?: string;
    legacyVariationId?: string;
    sku?: string;
    title?: string;
    quantity?: number;
    lineItemCost?: EbayAmount;
    total?: EbayAmount;
    deliveryCost?: { shippingCost?: EbayAmount };
    ebayCollectAndRemitTaxes?: { taxType?: string; amount?: EbayAmount }[];
    lineItemFulfillmentStatus?: string;
};

export type EbayOrder = {
    orderId: string;
    legacyOrderId?: string;
    salesRecordReference?: string;
    creationDate?: string;
    lastModifiedDate?: string;
    orderFulfillmentStatus?: string;
    orderPaymentStatus?: string;
    cancelStatus?: { cancelState?: string };
    sellerId?: string;
    buyer?: { username?: string };
    buyerCheckoutNotes?: string;
    pricingSummary?: {
        priceSubtotal?: EbayAmount;
        deliveryCost?: EbayAmount;
        tax?: EbayAmount;
        total?: EbayAmount;
    };
    paymentSummary?: { totalDueSeller?: EbayAmount; payments?: { paymentDate?: string; paymentStatus?: string }[] };
    totalMarketplaceFee?: EbayAmount;
    fulfillmentStartInstructions?: {
        maxEstimatedDeliveryDate?: string;
        shippingStep?: {
            shippingServiceCode?: string;
            shipTo?: {
                fullName?: string;
                email?: string;
                primaryPhone?: { phoneNumber?: string };
                contactAddress?: {
                    addressLine1?: string;
                    addressLine2?: string;
                    city?: string;
                    stateOrProvince?: string;
                    postalCode?: string;
                    countryCode?: string;
                };
            };
        };
    }[];
    lineItems?: EbayLineItem[];
};

export type EbayOrdersPage = {
    orders?: EbayOrder[];
    total?: number;
    next?: string;
};

export type FlatLineItem = {
    line_item_id: string | null;
    item_id: string | null;
    variation_id: string | null;
    sku: string | null;
    title: string | null;
    quantity: number | null;
    line_item_cost: number | null;
    line_total: number | null;
    shipping_cost: number | null;
    ebay_collected_tax: number | null;
    ebay_collected_tax_type: string | null;
    fulfillment_status: string | null;
};

export type FlatOrder = {
    order_id: string;
    legacy_order_id: string | null;
    sales_record_reference: string | null;
    creation_date: string | null;
    last_modified_date: string | null;
    order_fulfillment_status: string | null;
    order_payment_status: string | null;
    cancel_state: string | null;
    seller_id: string | null;
    buyer_username: string | null;
    buyer_checkout_notes: string | null;
    ship_to_name: string | null;
    ship_to_email: string | null;
    ship_to_phone: string | null;
    ship_to_address_line1: string | null;
    ship_to_address_line2: string | null;
    ship_to_city: string | null;
    ship_to_state: string | null;
    ship_to_postal_code: string | null;
    ship_to_country: string | null;
    shipping_service_code: string | null;
    ship_by_date: string | null;
    currency: string | null;
    subtotal: number | null;
    delivery_cost: number | null;
    tax: number | null;
    total: number | null;
    total_marketplace_fee: number | null;
    total_due_seller: number | null;
    line_item_count: number;
    skus: string;
    line_items: FlatLineItem[];
};

export type EbayShippingFulfillment = {
    fulfillmentId?: string;
    shippedDate?: string;
    shippingCarrierCode?: string;
    shipmentTrackingNumber?: string;
    lineItems?: { lineItemId?: string; quantity?: number }[];
};

export type FlatShippingFulfillment = {
    fulfillment_id: string | null;
    shipped_date: string | null;
    carrier: string | null;
    tracking_number: string | null;
    line_item_ids: string;
};
