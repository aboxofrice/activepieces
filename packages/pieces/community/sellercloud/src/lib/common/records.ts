import { sellercloudEnums } from './enums';
import { tenantTime } from './tenant-time';

// Flat, table-ready shapes for SellerCloud records. Raw SellerCloud timestamps are tenant
// local time; each one is also given as UTC with a `_utc` suffix.

function flattenOrder({ order }: { order: SellercloudOrder }): FlatOrder {
    const items = order.Items ?? [];
    const ship = order.ShippingAddress ?? {};
    return {
        order_id: order.ID,
        channel_order_id: order.OrderSourceOrderID ?? null,
        channel_id: order.OrderSource ?? null,
        channel: sellercloudEnums.label({ map: sellercloudEnums.CHANNELS, code: order.OrderSource }),
        company_id: order.CompanyID ?? null,
        company_name: order.CompanyName ?? null,
        status_code: order.StatusCode ?? null,
        status: sellercloudEnums.label({ map: sellercloudEnums.ORDER_STATUSES, code: order.StatusCode }),
        shipping_status: sellercloudEnums.label({ map: sellercloudEnums.SHIPPING_STATUSES, code: order.ShippingStatus }),
        payment_status: sellercloudEnums.label({ map: sellercloudEnums.PAYMENT_STATUSES, code: order.PaymentStatus }),
        customer_first_name: order.FirstName ?? null,
        customer_last_name: order.LastName ?? null,
        customer_email: order.CustomerEmail ?? null,
        grand_total: order.GrandTotal ?? null,
        shipping_total: order.ShippingTotal ?? null,
        tax_total: order.TaxTotal ?? null,
        currency: order.OrderCurrencyCode ?? null,
        ship_to_name: [ship.FirstName, ship.LastName].filter(Boolean).join(' ') || null,
        ship_to_company: ship.CompanyName || null,
        ship_to_street1: ship.StreetLine1 || null,
        ship_to_street2: ship.StreetLine2 || null,
        ship_to_city: ship.City || null,
        ship_to_state: ship.StateCode || ship.StateName || null,
        ship_to_postal_code: ship.PostalCode || null,
        ship_to_country: ship.CountryCode || ship.CountryName || null,
        ship_to_phone: ship.PhoneNumber || null,
        shipping_carrier: order.ShippingCarrier || null,
        shipping_service: order.ShippingService || null,
        tracking_number: order.TrackingNumber || null,
        ship_date: order.ShipDate ?? null,
        item_count: items.reduce((sum, item) => sum + (item.Qty ?? 0), 0),
        skus: items.map((item) => item.ProductID).filter(Boolean).join(', '),
        items: items.map((item) => ({
            sku: item.ProductID ?? null,
            name: item.DisplayName ?? null,
            qty: item.Qty ?? null,
            unit_price: item.AdjustedSitePrice ?? null,
            line_total: item.LineTotal ?? null,
            ship_from_warehouse_id: item.ShipFromWareHouseID ?? null,
            ship_from_warehouse_name: item.ShipFromWarehouseName ?? null,
        })),
        time_of_order: order.TimeOfOrder ?? null,
        created_on: order.CreatedOn ?? null,
        created_on_utc: tenantTime.tenantLocalToUtc({ value: order.CreatedOn }),
        last_updated: order.LastUpdated ?? null,
        last_updated_utc: tenantTime.tenantLocalToUtc({ value: order.LastUpdated }),
        order_source_url: order.OrderSourceUrl || null,
    };
}

function flattenRma({ rma }: { rma: SellercloudRma }): Record<string, unknown> {
    const items = rma.Items ?? [];
    return {
        rma_id: rma.ID,
        order_id: rma.CreatedForOrderID ?? null,
        channel_rma_id: rma.OrderSourceRMAID || null,
        channel_id: rma.OrderSource ?? null,
        channel: sellercloudEnums.label({ map: sellercloudEnums.CHANNELS, code: rma.OrderSource }),
        company_id: rma.CompanyID ?? null,
        company_name: rma.Company ?? null,
        status_code: rma.RMAStatusCode ?? null,
        status: sellercloudEnums.label({ map: sellercloudEnums.RMA_STATUSES, code: rma.RMAStatusCode }),
        customer_first_name: rma.CustomerFirstName || rma.FirstName || null,
        customer_last_name: rma.CustomerLastName || rma.LastName || null,
        tracking_number: rma.TrackingNumber || null,
        total_refunded: rma.TotalRefunded ?? null,
        item_count: items.length,
        skus: items.map((item) => item.SKU).filter(Boolean).join(', '),
        items: items.map((item) => ({
            sku: item.SKU ?? null,
            qty_returned: item.QtyReturned ?? null,
            qty_received: item.QtyReceived ?? null,
            return_reason: item.ReasonName || null,
            problem_description: item.ProblemDescription || null,
        })),
        created_on: rma.CreatedOn ?? null,
        created_on_utc: tenantTime.tenantLocalToUtc({ value: rma.CreatedOn }),
        received_on: rma.ReceivedOn ?? null,
        closed_on: rma.ClosedOn ?? null,
    };
}

function flattenPurchaseOrder({ po }: { po: SellercloudPurchaseOrder }): Record<string, unknown> {
    const items = po.Items ?? [];
    return {
        purchase_order_id: po.ID,
        title: po.PurchaseTitle || null,
        vendor_id: po.VendorID ?? null,
        company_id: po.CompanyID ?? null,
        warehouse_id: po.WarehouseID ?? null,
        status_code: po.PurchaseOrderStatus ?? null,
        status: sellercloudEnums.label({ map: sellercloudEnums.PO_STATUSES, code: po.PurchaseOrderStatus }),
        receiving_status_code: po.ReceivingStatus ?? null,
        receiving_status: sellercloudEnums.label({ map: sellercloudEnums.PO_RECEIVING_STATUSES, code: po.ReceivingStatus }),
        grand_total: po.GrandTotal ?? null,
        tracking_number: po.TrackingNumber || null,
        vendor_invoice_number: po.VendorInvoiceNumber || null,
        item_count: items.length,
        items: items.map((item) => ({
            sku: item.SKU ?? null,
            name: item.ProductName ?? null,
            qty_ordered: item.QtyOrdered ?? null,
            qty_received: item.QtyReceived ?? null,
            unit_price: item.UnitPrice ?? null,
        })),
        created_on: po.CreatedOn ?? null,
        last_revised_on: po.LastRevisedOn ?? null,
        last_revised_on_utc: tenantTime.tenantLocalToUtc({ value: po.LastRevisedOn }),
    };
}

function flattenProduct({ product }: { product: SellercloudCatalogProduct }): FlatProduct {
    return {
        sku: product.ID,
        name: product.ProductName ?? null,
        manufacturer_part_number: product.ManufacturerSKU || null,
        brand: product.BrandName || null,
        brand_id: product.BrandID ?? null,
        upc: product.UPC || null,
        company_id: product.CompanyID ?? null,
        company_name: product.CompanyName ?? null,
        product_type: product.ProductType || null,
        shadow_of: product.ShadowOf || null,
        active_status: product.ActiveStatus ?? null,
        physical_qty: product.PhysicalQty ?? null,
        available_qty: product.InventoryAvailableQty ?? null,
        aggregate_qty: product.AggregateQty ?? null,
        site_price: product.SitePrice ?? null,
        list_price: product.ListPrice ?? null,
        site_cost: product.SiteCost ?? null,
        default_vendor: product.DefaultVendor || null,
        image_url: product.ImageUrl || null,
    };
}

export const sellercloudRecords = {
    flattenOrder,
    flattenRma,
    flattenPurchaseOrder,
    flattenProduct,
};

export type SellercloudOrder = {
    ID: number;
    OrderSourceOrderID?: string | null;
    OrderSource?: number | null;
    CompanyID?: number | null;
    CompanyName?: string | null;
    StatusCode?: number | null;
    ShippingStatus?: number | null;
    PaymentStatus?: number | null;
    FirstName?: string | null;
    LastName?: string | null;
    CustomerEmail?: string | null;
    GrandTotal?: number | null;
    ShippingTotal?: number | null;
    TaxTotal?: number | null;
    OrderCurrencyCode?: string | null;
    ShippingCarrier?: string | null;
    ShippingService?: string | null;
    TrackingNumber?: string | null;
    ShipDate?: string | null;
    TimeOfOrder?: string | null;
    CreatedOn?: string | null;
    LastUpdated?: string | null;
    OrderSourceUrl?: string | null;
    ShippingAddress?: SellercloudAddress | null;
    Items?: SellercloudOrderItem[] | null;
};

type SellercloudAddress = {
    FirstName?: string;
    LastName?: string;
    CompanyName?: string;
    StreetLine1?: string;
    StreetLine2?: string;
    City?: string;
    StateCode?: string;
    StateName?: string;
    PostalCode?: string;
    CountryCode?: string;
    CountryName?: string;
    PhoneNumber?: string;
};

type SellercloudOrderItem = {
    ProductID?: string;
    DisplayName?: string;
    Qty?: number;
    AdjustedSitePrice?: number;
    LineTotal?: number;
    ShipFromWareHouseID?: number;
    ShipFromWarehouseName?: string;
};

export type SellercloudRma = {
    ID: number;
    CreatedForOrderID?: number | null;
    OrderSourceRMAID?: string | null;
    OrderSource?: number | null;
    CompanyID?: number | null;
    Company?: string | null;
    RMAStatusCode?: number | null;
    FirstName?: string | null;
    LastName?: string | null;
    CustomerFirstName?: string | null;
    CustomerLastName?: string | null;
    TrackingNumber?: string | null;
    TotalRefunded?: number | null;
    CreatedOn?: string | null;
    ReceivedOn?: string | null;
    ClosedOn?: string | null;
    Items?: { SKU?: string; QtyReturned?: number; QtyReceived?: number; ReasonName?: string; ProblemDescription?: string }[] | null;
};

export type SellercloudPurchaseOrder = {
    ID: number;
    PurchaseTitle?: string | null;
    VendorID?: number | null;
    CompanyID?: number | null;
    WarehouseID?: number | null;
    PurchaseOrderStatus?: number | null;
    ReceivingStatus?: number | null;
    GrandTotal?: number | null;
    TrackingNumber?: string | null;
    VendorInvoiceNumber?: string | null;
    CreatedOn?: string | null;
    LastRevisedOn?: string | null;
    Items?: { SKU?: string; ProductName?: string; QtyOrdered?: number; QtyReceived?: number; UnitPrice?: number }[] | null;
};

export type SellercloudCatalogProduct = {
    ID: string;
    ProductName?: string | null;
    ManufacturerSKU?: string | null;
    BrandName?: string | null;
    BrandID?: number | null;
    UPC?: string | null;
    CompanyID?: number | null;
    CompanyName?: string | null;
    ProductType?: string | null;
    ShadowOf?: string | null;
    ActiveStatus?: string | null;
    PhysicalQty?: number | null;
    InventoryAvailableQty?: number | null;
    AggregateQty?: number | null;
    SitePrice?: number | null;
    ListPrice?: number | null;
    SiteCost?: number | null;
    DefaultVendor?: string | null;
    ImageUrl?: string | null;
};

export type FlatOrder = {
    order_id: number;
    channel_order_id: string | null;
    channel_id: number | null;
    channel: string | null;
    company_id: number | null;
    company_name: string | null;
    status_code: number | null;
    status: string | null;
    shipping_status: string | null;
    payment_status: string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
    customer_email: string | null;
    grand_total: number | null;
    shipping_total: number | null;
    tax_total: number | null;
    currency: string | null;
    ship_to_name: string | null;
    ship_to_company: string | null;
    ship_to_street1: string | null;
    ship_to_street2: string | null;
    ship_to_city: string | null;
    ship_to_state: string | null;
    ship_to_postal_code: string | null;
    ship_to_country: string | null;
    ship_to_phone: string | null;
    shipping_carrier: string | null;
    shipping_service: string | null;
    tracking_number: string | null;
    ship_date: string | null;
    item_count: number;
    skus: string;
    items: Record<string, unknown>[];
    time_of_order: string | null;
    created_on: string | null;
    created_on_utc: string | null;
    last_updated: string | null;
    last_updated_utc: string | null;
    order_source_url: string | null;
};

export type FlatProduct = Record<string, string | number | null>;
