import { Turn14AuthProps, turn14Client } from './client';

async function listInvoices({ auth, maxPages }: { auth: Turn14AuthProps; maxPages: number }): Promise<Turn14Invoice[]> {
    const { rows } = await turn14Client.fetchPages<Turn14Invoice>({ auth, path: '/v1/invoices', maxPages });
    return rows;
}

async function getInvoice({ auth, invoiceId }: { auth: Turn14AuthProps; invoiceId: string }): Promise<Turn14Invoice> {
    const response = await turn14Client.request<{ data: Turn14Invoice }>({ auth, method: 'GET', path: `/v1/invoices/${encodeURIComponent(invoiceId)}` });
    return response.data;
}

async function listOrders({ auth, maxPages }: { auth: Turn14AuthProps; maxPages: number }): Promise<Turn14Order[]> {
    const { rows } = await turn14Client.fetchPages<Turn14Order>({ auth, path: '/v1/orders', maxPages });
    return rows;
}

async function getOrder({ auth, orderId }: { auth: Turn14AuthProps; orderId: string }): Promise<Turn14Order> {
    const response = await turn14Client.request<{ data: Turn14Order }>({ auth, method: 'GET', path: `/v1/orders/${encodeURIComponent(orderId)}` });
    return response.data;
}

// Turn14 rejects a tracking window wider than 3 days, so longer ranges are read in slices.
async function getTracking({ auth, startDate, endDate }: { auth: Turn14AuthProps; startDate: string; endDate: string }): Promise<Turn14Tracking[]> {
    const windows = trackingWindows({ startDate, endDate });
    const rows = await windows.reduce<Promise<Turn14Tracking[]>>(async (previous, window) => {
        const collected = await previous;
        const response = await turn14Client.request<{ data?: Turn14Tracking[] }>({ auth, method: 'GET', path: '/v1/tracking', queryParams: { start_date: window.start, end_date: window.end } });
        return [...collected, ...(response.data ?? [])];
    }, Promise.resolve([]));
    const seen = new Set<string>();
    return rows.filter((row) => {
        const key = `${row.id}|${row.attributes?.tracking_number ?? ''}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function trackingWindows({ startDate, endDate }: { startDate: string; endDate: string }): { start: string; end: string }[] {
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const end = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        throw new Error('Tracking dates must be YYYY-MM-DD and the end date must not be before the start date.');
    }
    const days = Math.round((end - start) / DAY_MS);
    if (days > MAX_TRACKING_RANGE_DAYS) {
        throw new Error(`Tracking can be read for at most ${MAX_TRACKING_RANGE_DAYS} days at a time.`);
    }
    const count = Math.floor(days / (TRACKING_WINDOW_DAYS + 1)) + 1;
    return Array.from({ length: count }, (_, index) => {
        const windowStart = start + index * (TRACKING_WINDOW_DAYS + 1) * DAY_MS;
        return { start: isoDate({ epochMs: windowStart }), end: isoDate({ epochMs: Math.min(end, windowStart + TRACKING_WINDOW_DAYS * DAY_MS) }) };
    });
}

function flattenInvoice({ invoice }: { invoice: Turn14Invoice }): FlatRecord {
    const a = invoice.attributes ?? {};
    const tracking = a.tracking ?? [];
    return {
        invoice_id: String(invoice.id),
        invoice_number: a.invoice_number ?? null,
        date: a.date ?? null,
        order_id: (a.relationships ?? []).map((relationship) => relationship.order?.order_id).filter(Boolean).join(',') || null,
        purchase_order_number: a.purchase_order_number ?? null,
        website_order_number: a.website_order_number ?? null,
        total_price: a.total_price ?? null,
        discount_percent: a.discount_percent ?? null,
        discount_amount: a.discount_amount ?? null,
        freight: a.freight ?? null,
        paid_amount: a.paid_amount ?? null,
        amount_due: a.amount_due ?? null,
        payment_terms: a.payment_terms ?? null,
        customer_name: a.customer_name ?? null,
        bill_to_address: a.bill_to_address ?? null,
        ship_to_address: a.ship_to_address ?? null,
        sales_rep: a.sales_rep ?? null,
        comments: a.comments ?? null,
        tracking_numbers: tracking.map((entry) => entry.tracking_number).filter(Boolean).join(','),
        ship_methods: [...new Set(tracking.map((entry) => entry.ship_method).filter(Boolean))].join(','),
        line_count: (a.lines ?? []).length,
        lines: (a.lines ?? []).map((line) => ({
            item_id: line.item_id ?? null,
            part_number: line.part_number ?? null,
            part_description: line.part_description ?? null,
            quantity: line.quantity ?? null,
            location_id: line.location_id ?? null,
            unit_price: line.unit_price ?? null,
            total_price: line.total_price ?? null,
        })),
    };
}

function flattenOrder({ order }: { order: Turn14Order }): FlatRecord {
    const a = order.attributes ?? {};
    const tracking = a.tracking ?? [];
    return {
        order_id: String(order.id),
        order_number: a.order_number ?? null,
        purchase_order_number: a.purchase_order_number ?? null,
        website_order_number: a.website_order_number ?? null,
        date: a.date ?? null,
        status: a.status ?? null,
        total: a.total ?? null,
        discount: a.discount ?? null,
        freight: a.freight ?? null,
        shipping_code: a.shipping_code ?? null,
        bill_to_address: a.bill_to_address ?? null,
        ship_to_address: a.ship_to_address ?? null,
        tracking_email: a.tracking_email ?? null,
        tracking_numbers: tracking.map((entry) => entry.tracking_number).filter(Boolean).join(','),
        ship_methods: [...new Set(tracking.map((entry) => entry.ship_method).filter(Boolean))].join(','),
        invoice_ids: (order.relationships?.invoice ?? []).map((invoice) => invoice.invoice_id).filter(Boolean).join(','),
        line_count: (a.lines ?? []).length,
        open_quantity: (a.lines ?? []).reduce((sum, line) => sum + (line.open_quantity ?? 0), 0),
        lines: (a.lines ?? []).map((line) => ({
            line_num: line.line_num ?? null,
            item_id: line.item_id === undefined ? null : String(line.item_id),
            part_number: line.part_number ?? null,
            part_description: line.part_description ?? null,
            quantity: line.quantity ?? null,
            open_quantity: line.open_quantity ?? null,
            delivered_quantity: line.delivered_quantity ?? null,
            invoiced_quantity: line.invoiced_quantity ?? null,
            total_fulfilled_quantity: line.total_fulfilled_quantity ?? null,
            price: line.price ?? null,
            total: line.total ?? null,
            location_id: line.location_id ?? null,
            estimated_ship_dates: JSON.stringify(line.esd ?? []),
        })),
    };
}

function flattenTracking({ tracking }: { tracking: Turn14Tracking }): FlatRecord {
    const references = tracking.attributes?.references ?? [];
    const order = references.find((reference) => reference.type === 'Order');
    const invoice = references.find((reference) => reference.type === 'Invoice');
    return {
        tracking_id: String(tracking.id),
        tracking_number: tracking.attributes?.tracking_number ?? null,
        service: tracking.attributes?.service ?? null,
        order_id: order?.id ?? null,
        order_number: order?.number ?? null,
        invoice_id: invoice?.id ?? null,
        invoice_number: invoice?.number ?? null,
        purchase_order_number: order?.purchase_order_number ?? invoice?.purchase_order_number ?? null,
    };
}

function isoDate({ epochMs }: { epochMs: number }): string {
    return new Date(epochMs).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TRACKING_WINDOW_DAYS = 3;
const MAX_TRACKING_RANGE_DAYS = 31;

export const turn14Orders = { listInvoices, getInvoice, listOrders, getOrder, getTracking, flattenInvoice, flattenOrder, flattenTracking, isoDate, DAY_MS };

export type FlatRecord = Record<string, unknown>;

export type Turn14Invoice = {
    id: number | string;
    type?: string;
    attributes?: {
        invoice_number?: string;
        date?: string;
        total_price?: number;
        discount_percent?: number;
        discount_amount?: number;
        freight?: number;
        paid_amount?: number;
        amount_due?: number;
        bill_to_address?: string;
        ship_to_address?: string;
        sales_rep?: string;
        customer_name?: string;
        payment_terms?: string;
        tracking?: { ship_method?: string; tracking_number?: string }[];
        lines?: { item_id?: string; part_number?: string; part_description?: string; quantity?: number; location_id?: string; unit_price?: number; total_price?: number }[];
        relationships?: { order?: { order_id?: string; links?: string } }[];
        purchase_order_number?: string;
        website_order_number?: string;
        comments?: string;
    };
};

export type Turn14Order = {
    id: number | string;
    type?: string;
    attributes?: {
        order_number?: string;
        purchase_order_number?: string;
        website_order_number?: number | string;
        date?: string;
        status?: string;
        total?: number;
        discount?: number;
        freight?: number;
        bill_to_address?: string;
        ship_to_address?: string;
        shipping_code?: number;
        tracking_email?: string;
        tracking?: { ship_method?: string; tracking_number?: string }[];
        lines?: {
            part_number?: string;
            part_description?: string;
            line_num?: number;
            item_id?: number | string;
            quantity?: number;
            open_quantity?: number;
            delivered_quantity?: number;
            invoiced_quantity?: number;
            total_fulfilled_quantity?: number;
            price?: number;
            total?: number;
            location_id?: string;
            esd?: unknown[];
        }[];
    };
    relationships?: { invoice?: { invoice_id?: string; links?: string }[] };
};

export type Turn14Tracking = {
    id: number | string;
    type?: string;
    attributes?: {
        tracking_number?: string;
        service?: string;
        references?: { type?: string; id?: string; number?: string; purchase_order_number?: string }[];
    };
};
