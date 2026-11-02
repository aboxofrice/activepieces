import { Property } from '@activepieces/pieces-framework';
import { WalmartAuthProps } from './client';
import { EligibleLine, walmartLineMath } from './line-math';
import { walmartOrders } from './orders';

// Leaving the lines empty means "the whole order": every line at the quantity still in a
// status the action applies to, which saves users from mapping line numbers. The order is
// always read so explicit rows can be checked against what is actually left.
async function resolveLines({ auth, purchaseOrderId, lines, statuses, action }: ResolveLinesParams): Promise<LineSelection[]> {
    const chosen = (lines ?? [])
        .map((value, index) => walmartLineMath.parseLine({ value, index }))
        .filter((line): line is LineSelection => line !== null);
    const order = await walmartOrders.getOrder({ auth, purchaseOrderId });
    return walmartLineMath.selectLines({ order, chosen, statuses, action });
}

export const orderLinesProp = Property.Array({
    displayName: 'Order Lines',
    description: 'Leave empty to apply to every line that can still take this action, at its remaining quantity.',
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

export type LineSelection = EligibleLine;

type ResolveLinesParams = {
    auth: WalmartAuthProps;
    purchaseOrderId: string;
    lines: unknown[] | undefined;
    statuses: string[];
    action: string;
};
