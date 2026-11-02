import { Store } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { Turn14AuthProps, turn14Client } from './client';
import { turn14Environment } from './environment';
import { AttemptRecord, turn14OrderGuards } from './order-guards';
import { turn14Orders } from './orders';
import { turn14Quotes } from './quotes';

// Place Order From Quote: environment guard, quote claim and duplicate checks, then one POST that
// is never retried. Once Turn14 has accepted the order, bookkeeping failures no longer fail the run,
// because a failed run would hide the order ID and invite a re-run.
async function placeOrder({ store, auth, input, settleMs }: { store: Store; auth: Turn14AuthProps; input: PlaceOrderInput; settleMs?: number }): Promise<PlaceOrderResult> {
    const { quoteId, poNumber } = input;
    const environment = turn14Environment.resolveOrderEnvironment({ auth, requested: input.environment, confirmLiveOrder: input.confirmLiveOrder, requireLiveConfirmation: true });
    const claim = await turn14OrderGuards.claimOrder({
        store,
        auth,
        quoteId,
        poNumber,
        environment,
        refuseRepeatQuote: input.refuseRepeatQuote,
        refuseOpenPo: input.refuseOpenPo,
        clearClaim: input.clearClaim,
        settleMs,
        listOpenOrders: async () => {
            const { rows, truncated } = await turn14Orders.listOrders({ auth, maxPages: MAX_OPEN_ORDER_PAGES });
            return { orders: rows, complete: !truncated };
        },
    });
    await turn14OrderGuards.assertStillClaimed({ store, auth, quoteId, claim, poNumber });
    const record = { token: claim.token, at: claim.at, poNumber, environment };
    // Only this run's own claim may be overwritten or removed; without a claim, nothing existing is touched.
    const save = (attempt: AttemptRecord) => (claim.owned
        ? turn14OrderGuards.recordAttempt({ store, auth, quoteId, attempt })
        : turn14OrderGuards.recordIfAbsent({ store, auth, quoteId, attempt }));
    const { data: response, error } = await tryCatch(() => turn14Quotes.placeOrderFromQuote({
        auth,
        order: {
            environment,
            quoteId: /^\d+$/.test(quoteId) ? Number(quoteId) : quoteId,
            poNumber,
            acknowledgeProp65: input.acknowledgeProp65,
            acknowledgeEpa: input.acknowledgeEpa,
            shippingIds: input.shippingIds,
        },
    }));
    if (error) {
        if (error instanceof turn14Client.Turn14OutcomeUnknownError) {
            await tryCatch(() => save({ ...record, status: 'unknown', orderId: null }));
            throw new Error(`${error.message} (PO "${poNumber}", quote ${quoteId})`);
        }
        // Turn14 answered and refused (or the request never left), so nothing was ordered.
        if (claim.owned) {
            await tryCatch(() => turn14OrderGuards.releaseClaim({ store, auth, quoteId, token: claim.token }));
        }
        throw error;
    }
    const orderId = orderIdOf({ response });
    const { error: recordError } = await tryCatch(() => save({ ...record, status: 'placed', orderId }));
    const warnings = [
        ...(recordError ? [`The order was placed but could not be recorded (${recordError.message}); the claim for quote ${quoteId} stays "sending", so a re-run is still refused.`] : []),
        ...(response === null ? [`Turn14 accepted the request but sent no body. Check List Open Orders for PO "${poNumber}".`] : []),
    ];
    const mismatches = turn14Environment.echoedEnvironmentMismatches({ response, expected: environment });
    if (mismatches.length > 0) {
        throw new Error(`Turn14 accepted order ${orderId ?? '(no ID returned)'} for PO "${poNumber}" but answered with ${mismatches.join(', ')}, while "${environment}" was requested. Check this order in Turn14 now. ${warnings.join(' ')}`.trim());
    }
    return { environment, order_id: orderId, po_number: poNumber, warnings, raw: response };
}

function orderIdOf({ response }: { response: unknown }): string | null {
    const data = turn14Client.isRecord(response) ? response['data'] : null;
    const id = turn14Client.isRecord(data) ? data['id'] : null;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

const MAX_OPEN_ORDER_PAGES = 20;

export const turn14PlaceOrder = { placeOrder };

export type PlaceOrderInput = {
    environment: unknown;
    confirmLiveOrder: boolean;
    quoteId: string;
    poNumber: string;
    shippingIds: (string | number)[];
    acknowledgeProp65: boolean;
    acknowledgeEpa: boolean;
    refuseOpenPo: boolean;
    refuseRepeatQuote: boolean;
    clearClaim?: string;
};

export type PlaceOrderResult = {
    environment: string;
    order_id: string | null;
    po_number: string;
    warnings: string[];
    raw: unknown;
};
