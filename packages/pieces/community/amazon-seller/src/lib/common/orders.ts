import { HttpMethod } from '@activepieces/pieces-common';
import { AmazonSellerAuthProps, SpApiQuery, spApiClient } from './client';

async function listOrders({ auth, marketplaceId, filters, maxRows }: ListOrdersParams): Promise<SpApiOrder[]> {
    return spApiClient.fetchPages<{ payload?: OrdersPage }, SpApiOrder>({
        maxRows,
        // A NextToken carries the original filters; Amazon rejects them if they are sent again.
        fetchPage: ({ nextToken }) => spApiClient.request({
            auth,
            method: HttpMethod.GET,
            path: '/orders/v0/orders',
            queryParams: nextToken
                ? { MarketplaceIds: [marketplaceId], NextToken: nextToken }
                : { MarketplaceIds: [marketplaceId], MaxResultsPerPage: MAX_ORDERS_PER_PAGE, ...filters },
        }),
        rowsOf: ({ page }) => page.payload?.Orders ?? [],
        nextTokenOf: ({ page }) => page.payload?.NextToken,
    });
}

async function getOrder({ auth, orderId }: { auth: AmazonSellerAuthProps; orderId: string }): Promise<SpApiOrder> {
    const response = await spApiClient.request<{ payload?: SpApiOrder }>({
        auth,
        method: HttpMethod.GET,
        path: `/orders/v0/orders/${encodeURIComponent(orderId.trim())}`,
    });
    if (!response.payload) {
        throw new Error(`Amazon returned no order for ${orderId}.`);
    }
    return response.payload;
}

async function getOrderItems({ auth, orderId }: { auth: AmazonSellerAuthProps; orderId: string }): Promise<SpApiOrderItem[]> {
    const path = `/orders/v0/orders/${encodeURIComponent(orderId.trim())}/orderItems`;
    return spApiClient.fetchPages<{ payload?: OrderItemsPage }, SpApiOrderItem>({
        fetchPage: ({ nextToken }) => spApiClient.request({
            auth,
            method: HttpMethod.GET,
            path,
            queryParams: { NextToken: nextToken },
        }),
        rowsOf: ({ page }) => page.payload?.OrderItems ?? [],
        nextTokenOf: ({ page }) => page.payload?.NextToken,
    });
}

function flattenOrder({ order }: { order: SpApiOrder }): FlatOrder {
    return {
        amazon_order_id: order.AmazonOrderId,
        seller_order_id: order.SellerOrderId ?? null,
        marketplace_id: order.MarketplaceId ?? null,
        purchase_date: order.PurchaseDate ?? null,
        last_update_date: order.LastUpdateDate ?? null,
        order_status: order.OrderStatus ?? null,
        fulfillment_channel: order.FulfillmentChannel ?? null,
        sales_channel: order.SalesChannel ?? null,
        order_type: order.OrderType ?? null,
        order_total_amount: order.OrderTotal?.Amount ?? null,
        order_total_currency: order.OrderTotal?.CurrencyCode ?? null,
        number_of_items_shipped: order.NumberOfItemsShipped ?? null,
        number_of_items_unshipped: order.NumberOfItemsUnshipped ?? null,
        payment_method: order.PaymentMethod ?? null,
        ship_service_level: order.ShipServiceLevel ?? null,
        shipment_service_level_category: order.ShipmentServiceLevelCategory ?? null,
        earliest_ship_date: order.EarliestShipDate ?? null,
        latest_ship_date: order.LatestShipDate ?? null,
        earliest_delivery_date: order.EarliestDeliveryDate ?? null,
        latest_delivery_date: order.LatestDeliveryDate ?? null,
        is_prime: order.IsPrime ?? null,
        is_business_order: order.IsBusinessOrder ?? null,
        is_premium_order: order.IsPremiumOrder ?? null,
        is_replacement_order: order.IsReplacementOrder === undefined ? null : String(order.IsReplacementOrder) === 'true',
        ship_city: order.ShippingAddress?.City ?? null,
        ship_state: order.ShippingAddress?.StateOrRegion ?? null,
        ship_postal_code: order.ShippingAddress?.PostalCode ?? null,
        ship_country_code: order.ShippingAddress?.CountryCode ?? null,
    };
}

function flattenOrderItem({ item, orderId }: { item: SpApiOrderItem; orderId: string }): FlatOrderItem {
    return {
        amazon_order_id: orderId,
        order_item_id: item.OrderItemId,
        seller_sku: item.SellerSKU ?? null,
        asin: item.ASIN ?? null,
        title: item.Title ?? null,
        quantity_ordered: item.QuantityOrdered ?? null,
        quantity_shipped: item.QuantityShipped ?? null,
        condition_id: item.ConditionId ?? null,
        condition_subtype_id: item.ConditionSubtypeId ?? null,
        item_price_amount: item.ItemPrice?.Amount ?? null,
        item_tax_amount: item.ItemTax?.Amount ?? null,
        shipping_price_amount: item.ShippingPrice?.Amount ?? null,
        shipping_tax_amount: item.ShippingTax?.Amount ?? null,
        promotion_discount_amount: item.PromotionDiscount?.Amount ?? null,
        currency: item.ItemPrice?.CurrencyCode ?? null,
        is_gift: item.IsGift === undefined ? null : String(item.IsGift) === 'true',
        is_transparency: item.IsTransparency ?? null,
        condition_note: item.ConditionNote ?? null,
        buyer_requested_cancel: item.BuyerRequestedCancel?.IsBuyerRequestedCancel === undefined ? null : String(item.BuyerRequestedCancel.IsBuyerRequestedCancel) === 'true',
        buyer_cancel_reason: item.BuyerRequestedCancel?.BuyerCancelReason ?? null,
    };
}

const MAX_ORDERS_PER_PAGE = 100;

export const amazonOrders = { listOrders, getOrder, getOrderItems, flattenOrder, flattenOrderItem };

export const ORDER_STATUSES = [
    { label: 'Pending (payment not yet authorized)', value: 'Pending' },
    { label: 'Unshipped', value: 'Unshipped' },
    { label: 'Partially Shipped', value: 'PartiallyShipped' },
    { label: 'Shipped', value: 'Shipped' },
    { label: 'Canceled', value: 'Canceled' },
    { label: 'Unfulfillable', value: 'Unfulfillable' },
    { label: 'Invoice Unconfirmed', value: 'InvoiceUnconfirmed' },
    { label: 'Pending Availability (pre-order)', value: 'PendingAvailability' },
];

export const FULFILLMENT_CHANNELS = [
    { label: 'Fulfilled by Amazon (AFN / FBA)', value: 'AFN' },
    { label: 'Fulfilled by Merchant (MFN)', value: 'MFN' },
];

export type SpApiOrder = {
    AmazonOrderId: string;
    SellerOrderId?: string;
    MarketplaceId?: string;
    PurchaseDate?: string;
    LastUpdateDate?: string;
    OrderStatus?: string;
    FulfillmentChannel?: string;
    SalesChannel?: string;
    OrderType?: string;
    OrderTotal?: Money;
    NumberOfItemsShipped?: number;
    NumberOfItemsUnshipped?: number;
    PaymentMethod?: string;
    ShipServiceLevel?: string;
    ShipmentServiceLevelCategory?: string;
    EarliestShipDate?: string;
    LatestShipDate?: string;
    EarliestDeliveryDate?: string;
    LatestDeliveryDate?: string;
    IsPrime?: boolean;
    IsBusinessOrder?: boolean;
    IsPremiumOrder?: boolean;
    IsReplacementOrder?: boolean | string;
    ShippingAddress?: { City?: string; StateOrRegion?: string; PostalCode?: string; CountryCode?: string };
};

export type FlatOrder = {
    amazon_order_id: string;
    seller_order_id: string | null;
    marketplace_id: string | null;
    purchase_date: string | null;
    last_update_date: string | null;
    order_status: string | null;
    fulfillment_channel: string | null;
    sales_channel: string | null;
    order_type: string | null;
    order_total_amount: string | null;
    order_total_currency: string | null;
    number_of_items_shipped: number | null;
    number_of_items_unshipped: number | null;
    payment_method: string | null;
    ship_service_level: string | null;
    shipment_service_level_category: string | null;
    earliest_ship_date: string | null;
    latest_ship_date: string | null;
    earliest_delivery_date: string | null;
    latest_delivery_date: string | null;
    is_prime: boolean | null;
    is_business_order: boolean | null;
    is_premium_order: boolean | null;
    is_replacement_order: boolean | null;
    ship_city: string | null;
    ship_state: string | null;
    ship_postal_code: string | null;
    ship_country_code: string | null;
};

export type FlatOrderItem = {
    amazon_order_id: string;
    order_item_id: string;
    seller_sku: string | null;
    asin: string | null;
    title: string | null;
    quantity_ordered: number | null;
    quantity_shipped: number | null;
    condition_id: string | null;
    condition_subtype_id: string | null;
    item_price_amount: string | null;
    item_tax_amount: string | null;
    shipping_price_amount: string | null;
    shipping_tax_amount: string | null;
    promotion_discount_amount: string | null;
    currency: string | null;
    is_gift: boolean | null;
    is_transparency: boolean | null;
    condition_note: string | null;
    buyer_requested_cancel: boolean | null;
    buyer_cancel_reason: string | null;
};

type Money = { CurrencyCode?: string; Amount?: string };

export type SpApiOrderItem = {
    OrderItemId: string;
    SellerSKU?: string;
    ASIN?: string;
    Title?: string;
    QuantityOrdered?: number;
    QuantityShipped?: number;
    ConditionId?: string;
    ConditionSubtypeId?: string;
    ItemPrice?: Money;
    ItemTax?: Money;
    ShippingPrice?: Money;
    ShippingTax?: Money;
    PromotionDiscount?: Money;
    IsGift?: boolean | string;
    IsTransparency?: boolean;
    ConditionNote?: string;
    BuyerRequestedCancel?: { IsBuyerRequestedCancel?: boolean | string; BuyerCancelReason?: string };
};

type OrdersPage = { Orders?: SpApiOrder[]; NextToken?: string };

type OrderItemsPage = { OrderItems?: SpApiOrderItem[]; NextToken?: string };

type ListOrdersParams = {
    auth: AmazonSellerAuthProps;
    marketplaceId: string;
    filters: SpApiQuery;
    maxRows?: number;
};
