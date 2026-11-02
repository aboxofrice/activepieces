import { EbayOrder, EbayShippingFulfillment } from './order';

// Decides what Add Tracking should do, without side effects, so a retry is safe:
// - a fulfillment that already carries this tracking number is the result (a retried
//   step, or one whose follow-up read failed, does not create a duplicate);
// - lines (or quantities) already shipped are left out;
// - nothing left to ship is an error rather than an empty POST.
function plan({ order, existing, wantedLineItemIds, trackingNumber }: PlanParams): FulfillmentPlan {
    const wanted = wantedLineItemIds.map((id) => id.trim()).filter((id) => id !== '');
    const selected = (order.lineItems ?? []).filter((lineItem) => wanted.length === 0 || (lineItem.lineItemId !== undefined && wanted.includes(lineItem.lineItemId)));
    if (selected.length === 0 || selected.length < wanted.length) {
        return { kind: 'no_matching_lines' };
    }
    const sameTracking = existing.find((fulfillment) => normalizeTracking({ value: fulfillment.shipmentTrackingNumber }) === normalizeTracking({ value: trackingNumber })
        && (fulfillment.lineItems ?? []).some((lineItem) => selected.some((candidate) => candidate.lineItemId === lineItem.lineItemId)));
    if (sameTracking) {
        return { kind: 'already_exists', fulfillment: sameTracking };
    }
    const shipped = shippedQuantities({ existing });
    const lineItems = selected
        .filter((lineItem) => lineItem.lineItemFulfillmentStatus !== 'FULFILLED' && lineItem.lineItemId !== undefined)
        .map((lineItem) => ({ lineItemId: lineItem.lineItemId ?? '', quantity: Math.max(0, (lineItem.quantity ?? 1) - (shipped.get(lineItem.lineItemId ?? '') ?? 0)) }))
        .filter((lineItem) => lineItem.quantity > 0);
    if (lineItems.length === 0) {
        return { kind: 'already_shipped', existing };
    }
    return { kind: 'create', lineItems };
}

function shippedQuantities({ existing }: { existing: EbayShippingFulfillment[] }): Map<string, number> {
    return existing
        .flatMap((fulfillment) => fulfillment.lineItems ?? [])
        .reduce((totals, lineItem) => {
            const id = lineItem.lineItemId;
            return id === undefined ? totals : new Map(totals).set(id, (totals.get(id) ?? 0) + (lineItem.quantity ?? 0));
        }, new Map<string, number>());
}

function normalizeTracking({ value }: { value: string | undefined }): string {
    return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

// createShippingFulfillment answers 201 with the new ID only in the Location header.
function fulfillmentIdFromLocation({ headers }: { headers: Record<string, unknown> }): string | null {
    const location = Object.entries(headers).find(([name]) => name.toLowerCase() === 'location')?.[1];
    const value = Array.isArray(location) ? location[0] : location;
    if (typeof value !== 'string' || value === '') {
        return null;
    }
    const id = value.split('?')[0].replace(/\/+$/, '').split('/').pop();
    return id ? decodeURIComponent(id) : null;
}

export const fulfillmentCommon = { plan, normalizeTracking, fulfillmentIdFromLocation };

export type FulfillmentPlan =
    | { kind: 'no_matching_lines' }
    | { kind: 'already_exists'; fulfillment: EbayShippingFulfillment }
    | { kind: 'already_shipped'; existing: EbayShippingFulfillment[] }
    | { kind: 'create'; lineItems: { lineItemId: string; quantity: number }[] };

type PlanParams = {
    order: EbayOrder;
    existing: EbayShippingFulfillment[];
    wantedLineItemIds: string[];
    trackingNumber: string;
};
