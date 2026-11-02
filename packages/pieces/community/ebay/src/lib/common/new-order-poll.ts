// Polling for New Order. Each poll re-reads an overlap window and dedupes by order ID.
//
// Publishing a flow disables and re-enables its trigger, and the store is scoped to the
// flow, not the version. Resetting the state on enable made the first poll after every
// publish report the whole overlap window again, so existing state is kept, and a fresh
// enable seeds the window's orders as already seen.
//
// A window holding more orders than one poll reads is not dropped: the poll records a
// cursor and the next polls carry on from that offset; the watermark only moves once the
// window has been read to the end.
async function enable({ store, fetchOrders, fingerprint, now = Date.now() }: EnableParams): Promise<'resumed' | 'seeded'> {
    const state = await readState({ store, fingerprint });
    if (state !== null && now - state.lastPollMs <= MAX_RESUME_GAP_MS) {
        return 'resumed';
    }
    const seen = await seedWindow({ fetchOrders, fromMs: now - OVERLAP_MS });
    await store.put<NewOrderState>(STATE_KEY, { v: STATE_VERSION, fp: fingerprint, lastPollMs: now, seenOrderIds: seen.slice(0, MAX_SEEN_IDS), cursor: null });
    return 'seeded';
}

async function poll<T extends PolledOrder>({ store, fetchOrders, fingerprint, now = Date.now() }: PollParams<T>): Promise<T[]> {
    const state = await readState({ store, fingerprint });
    if (state === null) {
        await enable({ store, fetchOrders, fingerprint, now });
        return [];
    }
    const cursor = state.cursor ?? { fromMs: state.lastPollMs - OVERLAP_MS, offset: 0, startedAt: now };
    const page = await fetchOrders({ fromMs: cursor.fromMs, offset: cursor.offset, maxOrders: MAX_ORDERS_PER_POLL });
    const seen = new Set(state.seenOrderIds);
    const fresh = page.orders
        .filter((order) => !seen.has(order.orderId))
        .filter((order, index, all) => all.findIndex((other) => other.orderId === order.orderId) === index)
        .sort((a, b) => timeOf({ value: a.creationDate }) - timeOf({ value: b.creationDate }));
    // Previously seen IDs are kept in case eBay briefly drops an order from the listing.
    const seenOrderIds = [...new Set([...page.orders.map((order) => order.orderId), ...state.seenOrderIds])].slice(0, MAX_SEEN_IDS);
    const nextCursor = page.truncated && page.orders.length > 0
        // Orders created mid-window can shift offsets; re-reading a little costs nothing.
        ? { ...cursor, offset: cursor.offset + page.orders.length - Math.min(OFFSET_REREAD, Math.floor(page.orders.length / 4)) }
        : null;
    await store.put<NewOrderState>(STATE_KEY, {
        v: STATE_VERSION,
        fp: fingerprint,
        lastPollMs: nextCursor === null ? cursor.startedAt : state.lastPollMs,
        seenOrderIds,
        cursor: nextCursor,
    });
    return fresh;
}

async function seedWindow({ fetchOrders, fromMs }: { fetchOrders: FetchOrders<PolledOrder>; fromMs: number }): Promise<string[]> {
    const read = async ({ offset, collected }: { offset: number; collected: string[] }): Promise<string[]> => {
        const page = await fetchOrders({ fromMs, offset, maxOrders: MAX_ORDERS_PER_POLL });
        const all = [...collected, ...page.orders.map((order) => order.orderId)];
        if (!page.truncated || page.orders.length === 0 || all.length >= MAX_SEEN_IDS) {
            return [...new Set(all)];
        }
        return read({ offset: offset + page.orders.length, collected: all });
    };
    return read({ offset: 0, collected: [] });
}

// Only a missing key means "no state"; a store error fails the poll rather than
// re-seeding and silently marking the outage's orders as seen.
async function readState({ store, fingerprint }: { store: NewOrderStore; fingerprint: string }): Promise<NewOrderState | null> {
    const data = await store.get<unknown>(STATE_KEY);
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const candidate: Partial<Record<keyof NewOrderState, unknown>> = Object.fromEntries(Object.entries(data));
    if (candidate.v !== STATE_VERSION || candidate.fp !== fingerprint || typeof candidate.lastPollMs !== 'number' || !Array.isArray(candidate.seenOrderIds)) {
        return null;
    }
    return {
        v: STATE_VERSION,
        fp: fingerprint,
        lastPollMs: candidate.lastPollMs,
        seenOrderIds: candidate.seenOrderIds.filter((id): id is string => typeof id === 'string'),
        cursor: parseCursor({ value: candidate.cursor }),
    };
}

function parseCursor({ value }: { value: unknown }): OrderCursor | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const candidate: Partial<Record<keyof OrderCursor, unknown>> = Object.fromEntries(Object.entries(value));
    if (typeof candidate.fromMs !== 'number' || typeof candidate.offset !== 'number' || typeof candidate.startedAt !== 'number') {
        return null;
    }
    return { fromMs: candidate.fromMs, offset: candidate.offset, startedAt: candidate.startedAt };
}

function timeOf({ value }: { value: string | undefined }): number {
    const parsed = value ? Date.parse(value) : Number.NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
}

const STATE_KEY = 'ebay_new_order_state';
const STATE_VERSION = 2;
const OVERLAP_MS = 2 * 60 * 60 * 1000;
const MAX_RESUME_GAP_MS = 6 * 60 * 60 * 1000;
const MAX_ORDERS_PER_POLL = 1000;
const MAX_SEEN_IDS = 5000;
const OFFSET_REREAD = 50;

export const newOrderPoll = { enable, poll, OVERLAP_MS, MAX_ORDERS_PER_POLL };

export type PolledOrder = { orderId: string; creationDate?: string };

export type FetchOrders<T extends PolledOrder> = (params: { fromMs: number; offset: number; maxOrders: number }) => Promise<{ orders: T[]; truncated: boolean }>;

export type NewOrderStore = {
    get: <V>(key: string) => Promise<V | null>;
    put: <V>(key: string, value: V) => Promise<V>;
};

type OrderCursor = { fromMs: number; offset: number; startedAt: number };

type NewOrderState = {
    v: number;
    fp: string;
    lastPollMs: number;
    seenOrderIds: string[];
    cursor: OrderCursor | null;
};

type EnableParams = {
    store: NewOrderStore;
    fetchOrders: FetchOrders<PolledOrder>;
    fingerprint: string;
    now?: number;
};

type PollParams<T extends PolledOrder> = {
    store: NewOrderStore;
    fetchOrders: FetchOrders<T>;
    fingerprint: string;
    now?: number;
};
