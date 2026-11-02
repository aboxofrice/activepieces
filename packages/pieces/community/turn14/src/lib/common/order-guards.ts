import { createHash, randomUUID } from 'crypto';
import { Store, StoreScope } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { Turn14AuthProps, turn14Client } from './client';
import { OrderEnvironment } from './environment';
import { Turn14Order } from './orders';

// Claims the quote for this run, then runs every check that does not depend on Turn14 accepting
// the order. The claim ("sending" plus a per-run token) is written before the slow open-order
// lookup and re-read after a short pause, so of two runs racing for one quote only the last writer
// goes on. This narrows the race; it cannot close it, since the store has no compare-and-set.
// Nothing has been sent to Turn14 when this throws, and a refused claim is cleared again.
// With "Refuse a Second Order for This Quote" off, no claim is made and an existing record is left
// exactly as it is, so a later guarded run still sees an earlier order.
async function claimOrder({ store, auth, quoteId, poNumber, environment, refuseRepeatQuote, refuseOpenPo, clearClaim, listOpenOrders, settleMs = CLAIM_SETTLE_MS, now = Date.now() }: GuardParams): Promise<OrderClaim> {
    const claim: OrderClaim = { token: randomUUID(), at: new Date().toISOString(), owned: refuseRepeatQuote };
    if (!refuseRepeatQuote) {
        await assertNoConflict({ store, auth, quoteId, poNumber, environment, refuseOpenPo, listOpenOrders });
        return claim;
    }
    const existing = await readAttempt({ store, auth, quoteId });
    if (existing !== null) {
        assertClearable({ quoteId, attempt: existing, clearClaim: clearClaim?.trim() ?? '', refuseOpenPo, now });
    }
    await recordAttempt({ store, auth, quoteId, attempt: { status: 'sending', token: claim.token, at: claim.at, poNumber, environment, orderId: null } });
    await sleep({ ms: settleMs });
    const current = await readAttempt({ store, auth, quoteId });
    if (current?.token !== claim.token) {
        throw new Error(`Another run claimed quote ${quoteId} at the same moment, so this run sent nothing. Check List Open Orders / Get Order for PO "${poNumber}".`);
    }
    const { error } = await tryCatch(() => assertNoConflict({ store, auth, quoteId, poNumber, environment, refuseOpenPo, listOpenOrders }));
    if (error) {
        await releaseClaim({ store, auth, quoteId, token: claim.token });
        throw error;
    }
    return claim;
}

// Called right before the POST: the open-order lookup takes time, and another run may have taken
// the quote over meanwhile.
async function assertStillClaimed({ store, auth, quoteId, claim, poNumber }: { store: Store; auth: Turn14AuthProps; quoteId: string; claim: OrderClaim; poNumber: string }): Promise<void> {
    if (!claim.owned) {
        return;
    }
    const current = await readAttempt({ store, auth, quoteId });
    if (current?.token !== claim.token) {
        throw new Error(`Another run took over quote ${quoteId} before this one sent its order, so this run sent nothing. Check List Open Orders / Get Order for PO "${poNumber}".`);
    }
}

// Records an order made without a claim, but only where no record exists yet.
async function recordIfAbsent({ store, auth, quoteId, attempt }: { store: Store; auth: Turn14AuthProps; quoteId: string; attempt: AttemptRecord }): Promise<void> {
    if (await readAttempt({ store, auth, quoteId }) === null) {
        await recordAttempt({ store, auth, quoteId, attempt });
    }
}

async function assertNoConflict({ store, auth, quoteId, poNumber, environment, refuseOpenPo, listOpenOrders }: Omit<GuardParams, 'refuseRepeatQuote' | 'settleMs' | 'clearClaim' | 'now'>): Promise<void> {
    const quote = await readQuote({ store, auth, quoteId });
    if (quote !== null && quote.environment !== environment) {
        throw new Error(`Quote ${quoteId} was created with Order Environment "${quote.environment}" but this order asks for "${environment}". A quote can only be ordered in the environment it was created in - create a new quote instead.`);
    }
    if (refuseOpenPo) {
        const { orders, complete } = await listOpenOrders();
        const existing = findOpenOrderWithPo({ orders, poNumber });
        if (existing !== null) {
            throw new Error(`Turn14 already has an open order for PO "${poNumber}" (order ${String(existing.id)}${existing.attributes?.order_number ? `, ${existing.attributes.order_number}` : ''}), so no new order was sent. Use a different PO number, or untick "Refuse if an Open Order Has This PO" if a second order is really wanted.`);
        }
        if (!complete) {
            throw new Error('Could not read all of your open Turn14 orders, so a duplicate PO number cannot be ruled out. Nothing was sent. Try again later, or untick "Refuse if an Open Order Has This PO".');
        }
    }
}

// Removes the attempt record only while it is still this run's claim.
async function releaseClaim({ store, auth, quoteId, token }: { store: Store; auth: Turn14AuthProps; quoteId: string; token: string }): Promise<void> {
    const current = await readAttempt({ store, auth, quoteId });
    if (current?.token === token) {
        await store.delete(attemptKey({ auth, quoteId }), StoreScope.PROJECT);
    }
}

function findOpenOrderWithPo({ orders, poNumber }: { orders: Turn14Order[]; poNumber: string }): Turn14Order | null {
    const wanted = normalizePo({ value: poNumber });
    if (wanted.length === 0) {
        return null;
    }
    return orders.find((order) => normalizePo({ value: String(order.attributes?.purchase_order_number ?? '') }) === wanted) ?? null;
}

async function readAttempt({ store, auth, quoteId }: { store: Store; auth: Turn14AuthProps; quoteId: string }): Promise<AttemptRecord | null> {
    const data = await store.get<unknown>(attemptKey({ auth, quoteId }), StoreScope.PROJECT);
    return isAttemptRecord(data) ? data : null;
}

async function recordAttempt({ store, auth, quoteId, attempt }: { store: Store; auth: Turn14AuthProps; quoteId: string; attempt: AttemptRecord }): Promise<void> {
    await store.put(attemptKey({ auth, quoteId }), attempt, StoreScope.PROJECT);
}

async function readQuote({ store, auth, quoteId }: { store: Store; auth: Turn14AuthProps; quoteId: string }): Promise<QuoteRecord | null> {
    const data = await store.get<unknown>(quoteKey({ auth, quoteId }), StoreScope.PROJECT);
    return isQuoteRecord(data) ? data : null;
}

async function recordQuote({ store, auth, quoteId, quote }: { store: Store; auth: Turn14AuthProps; quoteId: string; quote: QuoteRecord }): Promise<void> {
    await store.put(quoteKey({ auth, quoteId }), quote, StoreScope.PROJECT);
}

// An earlier attempt blocks the quote unless the user pasted exactly that attempt's token or time
// into "Stuck Claim Token to Clear". Because a new claim gets a new token and time, the pasted
// value cannot clear anything a second time, even if it stays in the flow.
function assertClearable({ quoteId, attempt, clearClaim, refuseOpenPo, now }: { quoteId: string; attempt: AttemptRecord; clearClaim: string; refuseOpenPo: boolean; now: number }): void {
    const matches = clearClaim.length > 0 && (clearClaim === attempt.token || clearClaim === attempt.at);
    if (!matches) {
        throw new Error(describeAttempt({ quoteId, attempt, clearAttempted: clearClaim.length > 0 }));
    }
    if (attempt.status === 'placed') {
        throw new Error(`${describeAttempt({ quoteId, attempt, clearAttempted: false })} A claim recorded as placed cannot be cleared.`);
    }
    if (!refuseOpenPo) {
        throw new Error(`Clearing the stuck claim for quote ${quoteId} needs "Refuse if an Open Order Has This PO" switched on, so an order Turn14 did create is still caught.`);
    }
    const ageMs = now - Date.parse(attempt.at);
    if (!(ageMs >= MIN_STUCK_AGE_MS)) {
        throw new Error(`The claim for quote ${quoteId} was made at ${attempt.at}, less than ${MIN_STUCK_AGE_MS / 60000} minutes ago; its order may still be in progress or not yet visible in Turn14. Try again later.`);
    }
}

function describeAttempt({ quoteId, attempt, clearAttempted }: { quoteId: string; attempt: AttemptRecord; clearAttempted: boolean }): string {
    const sent = `An order for quote ${quoteId} (PO "${attempt.poNumber}") was already sent at ${attempt.at}`;
    if (attempt.status === 'placed') {
        return `${sent} and was placed${attempt.orderId ? ` as Turn14 order ${attempt.orderId}` : ''}, so it was not sent again. To order it again anyway, untick "Refuse a Second Order for This Quote".`;
    }
    const mismatch = clearAttempted ? ' The value in "Stuck Claim Token to Clear" does not match this claim.' : '';
    return `${sent} and its outcome is unknown (the run stopped or Turn14 did not answer clearly), so it was not sent again.${mismatch} Check PO "${attempt.poNumber}" in Turn14 (List Open Orders / Get Order). If no order exists there, paste ${attempt.token} into "Stuck Claim Token to Clear" and run once more.`;
}

// Store keys are project-wide so a retried or duplicated flow run sees them; they include the host
// and a hash of the client ID so two Turn14 accounts in one project cannot collide.
function attemptKey({ auth, quoteId }: { auth: Turn14AuthProps; quoteId: string }): string {
    return `turn14_order_attempt_${accountTag({ auth })}_${safeId({ value: quoteId })}`;
}

function quoteKey({ auth, quoteId }: { auth: Turn14AuthProps; quoteId: string }): string {
    return `turn14_quote_env_${accountTag({ auth })}_${safeId({ value: quoteId })}`;
}

function accountTag({ auth }: { auth: Turn14AuthProps }): string {
    const host = turn14Client.isTestingHost({ auth }) ? 'test' : 'prod';
    return `${host}_${createHash('sha256').update(auth.clientId.trim()).digest('hex').slice(0, 10)}`;
}

function safeId({ value }: { value: string }): string {
    return value.trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
}

function normalizePo({ value }: { value: string }): string {
    return value.trim().toLowerCase();
}

function sleep({ ms }: { ms: number }): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAttemptRecord(value: unknown): value is AttemptRecord {
    return turn14Client.isRecord(value)
        && typeof value['token'] === 'string'
        && (value['status'] === 'sending' || value['status'] === 'placed' || value['status'] === 'unknown')
        && typeof value['at'] === 'string'
        && typeof value['poNumber'] === 'string';
}

function isQuoteRecord(value: unknown): value is QuoteRecord {
    return turn14Client.isRecord(value) && (value['environment'] === 'testing' || value['environment'] === 'production');
}

const CLAIM_SETTLE_MS = 1500;
const MIN_STUCK_AGE_MS = 15 * 60 * 1000;

export const turn14OrderGuards = {
    claimOrder,
    assertStillClaimed,
    releaseClaim,
    recordIfAbsent,
    findOpenOrderWithPo,
    readAttempt,
    recordAttempt,
    readQuote,
    recordQuote,
};

export type AttemptRecord = {
    status: 'sending' | 'placed' | 'unknown';
    token: string;
    at: string;
    poNumber: string;
    environment: OrderEnvironment;
    orderId: string | null;
};

export type OrderClaim = { token: string; at: string; owned: boolean };

export type QuoteRecord = {
    environment: OrderEnvironment;
    poNumber: string;
    at: string;
};

type GuardParams = {
    store: Store;
    auth: Turn14AuthProps;
    quoteId: string;
    poNumber: string;
    environment: OrderEnvironment;
    refuseRepeatQuote: boolean;
    refuseOpenPo: boolean;
    clearClaim?: string;
    now?: number;
    listOpenOrders: () => Promise<{ orders: Turn14Order[]; complete: boolean }>;
    settleMs?: number;
};
