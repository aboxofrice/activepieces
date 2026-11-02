import { Turn14AuthProps, turn14Client } from './client';
import { OrderEnvironment } from './environment';

// Request shapes follow Turn14's quote -> order/from_quote flow as used by published dealer
// integrations; Turn14's own reference is behind the dealer login. They were not exercised live.
async function createQuote({ auth, quote }: { auth: Turn14AuthProps; quote: QuoteInput }): Promise<unknown> {
    return turn14Client.request({ auth, method: 'POST', path: '/v1/quote', body: buildQuoteBody({ quote }), validate: turn14Client.isAnyBody });
}

async function placeOrderFromQuote({ auth, order }: { auth: Turn14AuthProps; order: OrderFromQuoteInput }): Promise<unknown> {
    return turn14Client.request({
        auth,
        method: 'POST',
        path: '/v1/order/from_quote',
        validate: turn14Client.isAnyBody,
        body: {
            data: {
                environment: order.environment,
                quote_id: order.quoteId,
                po_number: order.poNumber,
                acknowledge_prop_65: order.acknowledgeProp65,
                acknowledge_epa: order.acknowledgeEpa,
                shipping: order.shippingIds.map((shippingId) => ({ shipping_id: shippingId })),
            },
        },
    });
}

function buildQuoteBody({ quote }: { quote: QuoteInput }): Record<string, unknown> {
    return {
        data: {
            environment: quote.environment,
            po_number: quote.poNumber,
            locations: [{
                location: quote.location,
                combine_in_out_stock: quote.combineInOutStock,
                items: quote.items.map((item) => ({ item_identifier: item.itemId, item_identifier_type: 'item_id', quantity: item.quantity })),
                shipping: {
                    shipping_code: quote.shippingCode,
                    saturday_delivery: quote.saturdayDelivery,
                    signature_required: quote.signatureRequired,
                },
            }],
            acknowledge_prop_65: quote.acknowledgeProp65,
            recipient: {
                name: quote.recipient.name,
                address: quote.recipient.address,
                address_2: quote.recipient.address2 ?? '',
                city: quote.recipient.city,
                state: quote.recipient.state,
                country: quote.recipient.country,
                zip: quote.recipient.zip,
                phone_number: quote.recipient.phone,
                is_shop_address: quote.recipient.isShopAddress,
            },
        },
    };
}

// Only data.id and shipment[].shipping[].shipping_quote_id are known; the rest of each shipping
// option is passed through as Turn14 sends it.
function summarizeQuote({ response }: { response: unknown }): QuoteSummary {
    const data = turn14Client.isRecord(response) && turn14Client.isRecord(response['data']) ? response['data'] : {};
    const attributes = turn14Client.isRecord(data['attributes']) ? data['attributes'] : {};
    const shipments = Array.isArray(attributes['shipment']) ? attributes['shipment'].filter(turn14Client.isRecord) : [];
    const shippingOptions = shipments.flatMap((shipment, shipmentIndex): Record<string, unknown>[] => {
        const options = Array.isArray(shipment['shipping']) ? shipment['shipping'].filter(turn14Client.isRecord) : [];
        return options.map((option) => ({ shipment_index: shipmentIndex, location: shipment['location'] ?? null, ...option }));
    });
    const quoteId = data['id'];
    return {
        quote_id: typeof quoteId === 'string' || typeof quoteId === 'number' ? String(quoteId) : null,
        shipping_quote_ids: shippingOptions.map((option) => option['shipping_quote_id']).filter((id) => id !== undefined && id !== null),
        shipping_options: shippingOptions,
        raw: response,
    };
}

export const turn14Quotes = { createQuote, placeOrderFromQuote, buildQuoteBody, summarizeQuote };

export type QuoteInput = {
    environment: OrderEnvironment;
    poNumber: string;
    location: string;
    combineInOutStock: boolean;
    items: { itemId: string; quantity: number }[];
    shippingCode: number;
    saturdayDelivery: boolean;
    signatureRequired: boolean;
    acknowledgeProp65: boolean;
    recipient: {
        name: string;
        address: string;
        address2?: string;
        city: string;
        state: string;
        country: string;
        zip: string;
        phone: string;
        isShopAddress: boolean;
    };
};

export type OrderFromQuoteInput = {
    environment: OrderEnvironment;
    quoteId: string | number;
    poNumber: string;
    acknowledgeProp65: boolean;
    acknowledgeEpa: boolean;
    shippingIds: (string | number)[];
};

export type QuoteSummary = {
    quote_id: string | null;
    shipping_quote_ids: unknown[];
    shipping_options: Record<string, unknown>[];
    raw: unknown;
};
