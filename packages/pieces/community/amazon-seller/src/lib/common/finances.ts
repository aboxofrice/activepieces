import { HttpMethod } from '@activepieces/pieces-common';
import { AmazonSellerAuthProps, spApiClient } from './client';

async function listOrderFinancialEvents({ auth, orderId }: { auth: AmazonSellerAuthProps; orderId: string }): Promise<FinancialEvents> {
    const pages = await spApiClient.fetchPages<FinancesPage, FinancialEvents>({
        fetchPage: ({ nextToken }) => spApiClient.request({
            auth,
            method: HttpMethod.GET,
            path: `/finances/v0/orders/${encodeURIComponent(orderId.trim())}/financialEvents`,
            queryParams: { MaxResultsPerPage: 100, NextToken: nextToken },
        }),
        rowsOf: ({ page }) => (page.payload?.FinancialEvents ? [page.payload.FinancialEvents] : []),
        nextTokenOf: ({ page }) => page.payload?.NextToken,
    });
    return {
        ShipmentEventList: pages.flatMap((page) => page.ShipmentEventList ?? []),
        RefundEventList: pages.flatMap((page) => page.RefundEventList ?? []),
    };
}

// Shipment and refund events share one item shape except that refunds use the *Adjustment*
// list names; both become one row per item so a sheet can sum charges, fees and refunds.
function flattenFinancialEvents({ events, orderId }: { events: FinancialEvents; orderId: string }): OrderFinancials {
    const shipmentRows = (events.ShipmentEventList ?? []).flatMap((event) => (event.ShipmentItemList ?? []).map((item) => ({
        event_type: 'Shipment',
        posted_date: event.PostedDate ?? null,
        seller_sku: item.SellerSKU ?? null,
        order_item_id: item.OrderItemId ?? null,
        quantity: item.QuantityShipped ?? null,
        charges: sumAmounts({ amounts: (item.ItemChargeList ?? []).map((charge) => charge.ChargeAmount) }),
        fees: sumAmounts({ amounts: (item.ItemFeeList ?? []).map((fee) => fee.FeeAmount) }),
        promotions: sumAmounts({ amounts: (item.PromotionList ?? []).map((promotion) => promotion.PromotionAmount) }),
        currency: firstCurrency({ amounts: (item.ItemChargeList ?? []).map((charge) => charge.ChargeAmount) }),
        fee_breakdown: describe({ entries: (item.ItemFeeList ?? []).map((fee) => [fee.FeeType, fee.FeeAmount]) }),
    })));
    const refundRows = (events.RefundEventList ?? []).flatMap((event) => (event.ShipmentItemAdjustmentList ?? []).map((item) => ({
        event_type: 'Refund',
        posted_date: event.PostedDate ?? null,
        seller_sku: item.SellerSKU ?? null,
        order_item_id: item.OrderItemId ?? item.OrderAdjustmentItemId ?? null,
        quantity: item.QuantityShipped ?? null,
        charges: sumAmounts({ amounts: (item.ItemChargeAdjustmentList ?? []).map((charge) => charge.ChargeAmount) }),
        fees: sumAmounts({ amounts: (item.ItemFeeAdjustmentList ?? []).map((fee) => fee.FeeAmount) }),
        promotions: sumAmounts({ amounts: (item.PromotionAdjustmentList ?? []).map((promotion) => promotion.PromotionAmount) }),
        currency: firstCurrency({ amounts: (item.ItemChargeAdjustmentList ?? []).map((charge) => charge.ChargeAmount) }),
        fee_breakdown: describe({ entries: (item.ItemFeeAdjustmentList ?? []).map((fee) => [fee.FeeType, fee.FeeAmount]) }),
    })));
    const rows = [...shipmentRows, ...refundRows];
    const total = (pick: (row: FinancialRow) => number, type?: string) => round({ value: rows.filter((row) => !type || row.event_type === type).reduce((sum, row) => sum + pick(row), 0) });
    return {
        amazon_order_id: orderId,
        total_charges: total((row) => row.charges, 'Shipment'),
        total_fees: total((row) => row.fees, 'Shipment'),
        total_refunded: total((row) => row.charges, 'Refund'),
        refund_fee_adjustments: total((row) => row.fees, 'Refund'),
        net: total((row) => row.charges + row.fees + row.promotions),
        has_refund: refundRows.length > 0,
        currency: rows.find((row) => row.currency)?.currency ?? null,
        rows,
    };
}

function sumAmounts({ amounts }: { amounts: (Amount | undefined)[] }): number {
    return round({ value: amounts.reduce((sum, amount) => sum + (amount?.CurrencyAmount ?? 0), 0) });
}

function firstCurrency({ amounts }: { amounts: (Amount | undefined)[] }): string | null {
    return amounts.find((amount) => amount?.CurrencyCode)?.CurrencyCode ?? null;
}

function describe({ entries }: { entries: [string | undefined, Amount | undefined][] }): string {
    return entries.filter(([, amount]) => (amount?.CurrencyAmount ?? 0) !== 0).map(([type, amount]) => `${type ?? 'Fee'}: ${amount?.CurrencyAmount}`).join(', ');
}

function round({ value }: { value: number }): number {
    return Math.round(value * 100) / 100;
}

export const amazonFinances = { listOrderFinancialEvents, flattenFinancialEvents };

export type OrderFinancials = {
    amazon_order_id: string;
    total_charges: number;
    total_fees: number;
    total_refunded: number;
    refund_fee_adjustments: number;
    net: number;
    has_refund: boolean;
    currency: string | null;
    rows: FinancialRow[];
};

type FinancialRow = {
    event_type: string;
    posted_date: string | null;
    seller_sku: string | null;
    order_item_id: string | null;
    quantity: number | null;
    charges: number;
    fees: number;
    promotions: number;
    currency: string | null;
    fee_breakdown: string;
};

type Amount = { CurrencyCode?: string; CurrencyAmount?: number };

type FinancialItem = {
    SellerSKU?: string;
    OrderItemId?: string;
    OrderAdjustmentItemId?: string;
    QuantityShipped?: number;
    ItemChargeList?: { ChargeType?: string; ChargeAmount?: Amount }[];
    ItemFeeList?: { FeeType?: string; FeeAmount?: Amount }[];
    PromotionList?: { PromotionAmount?: Amount }[];
    ItemChargeAdjustmentList?: { ChargeType?: string; ChargeAmount?: Amount }[];
    ItemFeeAdjustmentList?: { FeeType?: string; FeeAmount?: Amount }[];
    PromotionAdjustmentList?: { PromotionAmount?: Amount }[];
};

type FinancialEvents = {
    ShipmentEventList?: { PostedDate?: string; ShipmentItemList?: FinancialItem[] }[];
    RefundEventList?: { PostedDate?: string; ShipmentItemAdjustmentList?: FinancialItem[] }[];
};

type FinancesPage = { payload?: { FinancialEvents?: FinancialEvents; NextToken?: string } };
