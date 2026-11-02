import { createHash } from 'crypto';
import { Store, StoreScope } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { Turn14AuthProps, turn14Client } from './client';
import { OrderEnvironment } from './environment';
import { Turn14Order } from './orders';

// Runs every check that does not depend on Turn14 accepting the order, and throws on the first
// one that fails. Nothing has been sent to Turn14 when this throws.
async function assertSafeToOrder({ store, auth, quoteId, poNumber, environment, refuseRepeatQuote, refuseOpenPo, listOpenOrders }: GuardParams): Promise<void> {
    if (refuseRepeatQuote) {
        const attempt = await readAttempt({ store, auth, quoteId });
        if (attempt !== null) {
            throw new Error(describeAttempt({ quoteId, attempt }));
        }
    }
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

function findOpenOrderWithPo({ orders, poNumber }: { orders: Turn14Order[]; poNumber: string }): Turn14Order | null {
    const wanted = normalizePo({ value: poNumber });
    if (wanted.length === 0) {
        return null;
    }
    return orders.find((order) => normalizePo({ value: String(order.attributes?.purchase_order_number ?? '') }) === wanted) ?? null;
}

async function readAttempt({ store, auth, quoteId }: { store: Store; auth: Turn14AuthProps; quoteId: string }): Promise<AttemptRecord | null> {
    const { data } = await tryCatch(() => store.get<unknown>(attemptKey({ auth, quoteId }), StoreScope.PROJECT));
    return isAttemptRecord(data) ? data : null;
}

async function recordAttempt({ store, auth, quoteId, attempt }: { store: Store; auth: Turn14AuthProps; quoteId: string; attempt: AttemptRecord }): Promise<void> {
    await store.put(attemptKey({ auth, quoteId }), attempt, StoreScope.PROJECT);
}

async function clearAttempt({ store, auth, quoteId }: { store: Store; auth: Turn14AuthProps; quoteId: string }): Promise<void> {
    await store.delete(attemptKey({ auth, quoteId }), StoreScope.PROJECT);
}

async function readQuote({ store, auth, quoteId }: { store: Store; auth: Turn14AuthProps; quoteId: string }): Promise<QuoteRecord | null> {
    const { data } = await tryCatch(() => store.get<unknown>(quoteKey({ auth, quoteId }), StoreScope.PROJECT));
    return isQuoteRecord(data) ? data : null;
}

async function recordQuote({ store, auth, quoteId, quote }: { store: Store; auth: Turn14AuthProps; quoteId: string; quote: QuoteRecord }): Promise<void> {
    await store.put(quoteKey({ auth, quoteId }), quote, StoreScope.PROJECT);
}

function describeAttempt({ quoteId, attempt }: { quoteId: string; attempt: AttemptRecord }): string {
    const outcome = attempt.status === 'placed'
        ? `it was placed${attempt.orderId ? ` as Turn14 order ${attempt.orderId}` : ''}`
        : 'its outcome is unknown (the run stopped or Turn14 did not answer clearly)';
    return `An order for quote ${quoteId} (PO "${attempt.poNumber}") was already sent at ${attempt.at} and ${outcome}, so it was not sent again. Check List Open Orders / Get Order. To order it anyway, untick "Refuse a Second Order for This Quote".`;
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

function isAttemptRecord(value: unknown): value is AttemptRecord {
    return turn14Client.isRecord(value)
        && (value['status'] === 'sending' || value['status'] === 'placed' || value['status'] === 'unknown')
        && typeof value['at'] === 'string'
        && typeof value['poNumber'] === 'string';
}

function isQuoteRecord(value: unknown): value is QuoteRecord {
    return turn14Client.isRecord(value) && (value['environment'] === 'testing' || value['environment'] === 'production');
}

export const turn14OrderGuards = {
    assertSafeToOrder,
    findOpenOrderWithPo,
    readAttempt,
    recordAttempt,
    clearAttempt,
    readQuote,
    recordQuote,
};

export type AttemptRecord = {
    status: 'sending' | 'placed' | 'unknown';
    at: string;
    poNumber: string;
    environment: OrderEnvironment;
    orderId: string | null;
};

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
    listOpenOrders: () => Promise<{ orders: Turn14Order[]; complete: boolean }>;
};
