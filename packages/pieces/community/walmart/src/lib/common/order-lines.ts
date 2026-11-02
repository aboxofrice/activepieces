import { Property } from '@activepieces/pieces-framework';
import { WalmartAuthProps } from './client';
import { walmartOrders } from './orders';

// Leaving the lines empty means "the whole order": every line at its ordered quantity,
// which is what most ship/cancel flows want and saves users from mapping line numbers.
async function resolveLines({ auth, purchaseOrderId, lines }: { auth: WalmartAuthProps; purchaseOrderId: string; lines: unknown[] | undefined }): Promise<LineSelection[]> {
    const chosen = (lines ?? []).map(parseLine).filter((line): line is LineSelection => line !== null);
    if (chosen.length > 0) {
        return chosen;
    }
    const order = walmartOrders.flattenOrder({ order: await walmartOrders.getOrder({ auth, purchaseOrderId }) });
    return order.order_lines.map((line) => ({ lineNumber: line.line_number, quantity: line.quantity }));
}

function parseLine(value: unknown): LineSelection | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const lineNumber = 'lineNumber' in value ? String(value.lineNumber ?? '').trim() : '';
    const quantity = 'quantity' in value ? Number(value.quantity) : NaN;
    if (!lineNumber) {
        return null;
    }
    return { lineNumber, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 };
}

export const orderLinesProp = Property.Array({
    displayName: 'Order Lines',
    description: 'Leave empty to apply to every line of the order at its full quantity.',
    required: false,
    properties: {
        lineNumber: Property.ShortText({
            displayName: 'Line Number',
            description: 'The order line number (line_number in Get Order output), e.g. 1.',
            required: true,
        }),
        quantity: Property.Number({
            displayName: 'Quantity',
            required: true,
            defaultValue: 1,
        }),
    },
});

export const walmartOrderLines = {
    resolveLines,
};

export type LineSelection = { lineNumber: string; quantity: number };
