import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Client } from '../common/client';
import { FlatRecord, Turn14Invoice, turn14Orders } from '../common/orders';
import { turn14Polling } from '../common/polling';

export const newInvoice = createTrigger({
    auth: turn14Auth,
    name: 'new_invoice',
    displayName: 'New Invoice',
    description: 'Fires for each new Turn14 invoice, with totals, amount due, tracking numbers, line items and the Turn14 order it belongs to. Reads the newest pages only (up to 3). State survives a republish; after the flow has been off for more than 15 minutes it starts fresh.',
    props: {},
    type: TriggerStrategy.POLLING,
    sampleData: {
        invoice_id: '1234567',
        invoice_number: 'INV1234567',
        date: '2026-10-29',
        order_id: '7654321',
        purchase_order_number: 'PO-1001',
        website_order_number: '0',
        total_price: 129.5,
        discount_percent: 0,
        discount_amount: 0,
        freight: 12.4,
        paid_amount: 0,
        amount_due: 141.9,
        payment_terms: 'Net 30',
        customer_name: 'Example Auto Parts LLC',
        bill_to_address: '100 Example St, Springfield, PA 19000',
        ship_to_address: 'Example Customer, 1 Sample Rd, Anytown, TX 75000',
        sales_rep: 'Sales Rep',
        comments: '',
        tracking_numbers: '1Z999AA10123456784',
        ship_methods: 'FedEx Ground',
        line_count: 1,
        lines: [{ item_id: '078595', part_number: 'rad20-0262', part_description: 'Radium Engineering Mitsubishi Evo 8-10 Clutch Fork Stop', quantity: 1, location_id: '01', unit_price: 29.16, total_price: 29.16 }],
        truncated: false,
    },
    async onEnable(context) {
        const now = Date.now();
        if (await turn14Polling.resumeAfterRepublish({ store: context.store, now }) && (await turn14Polling.readIdSet({ store: context.store, prefix: SEEN_PREFIX })).size > 0) {
            return;
        }
        const { rows } = await turn14Orders.listInvoices({ auth: turn14AuthProps(context.auth), maxPages: MAX_PAGES });
        await turn14Polling.writeIdSet({ store: context.store, prefix: SEEN_PREFIX, ids: rows.map((invoice) => String(invoice.id)) });
    },
    async onDisable(context) {
        await turn14Polling.markDisabled({ store: context.store, now: Date.now() });
    },
    async test(context) {
        const { rows } = await turn14Orders.listInvoices({ auth: turn14AuthProps(context.auth), maxPages: 1 });
        return rows
            .map((invoice) => turn14Orders.flattenInvoice({ invoice }))
            .sort((left, right) => String(right['date'] ?? '').localeCompare(String(left['date'] ?? '')))
            .slice(0, TEST_LIMIT);
    },
    async run(context) {
        const seen = await turn14Polling.readIdSet({ store: context.store, prefix: SEEN_PREFIX });
        const scan = await turn14Client.scanPages<Turn14Invoice, Turn14Invoice[]>({
            auth: turn14AuthProps(context.auth),
            path: '/v1/invoices',
            maxPages: MAX_PAGES,
            initial: [],
            // Newest first (checked live): once a page holds an invoice already seen, every later
            // page is older and was seen too.
            reduce: ({ acc, rows }) => ({ acc: [...acc, ...rows.filter((invoice) => !seen.has(String(invoice.id)))], done: rows.some((invoice) => seen.has(String(invoice.id))) }),
        });
        const truncated = scan.stoppedBy === 'maxPages';
        if (truncated) {
            console.warn(`[turn14] New Invoice: ${MAX_PAGES} pages of invoices were all new; older unseen invoices on later pages were not read.`);
        }
        const fresh = scan.acc;
        if (fresh.length > 0) {
            // Newest IDs first so the cap drops the oldest, which can no longer reach the first pages.
            const ids = [...fresh.map((invoice) => String(invoice.id)), ...seen].slice(0, MAX_SEEN_IDS);
            await turn14Polling.writeIdSet({ store: context.store, prefix: SEEN_PREFIX, ids });
        }
        return fresh
            .map((invoice): FlatRecord => ({ ...turn14Orders.flattenInvoice({ invoice }), truncated }))
            .sort((left, right) => String(left['date'] ?? '').localeCompare(String(right['date'] ?? '')));
    },
});

// Turn14 lists invoices newest first, so a poll only needs the first pages.
const MAX_PAGES = 3;
const MAX_SEEN_IDS = 20000;
const TEST_LIMIT = 5;
const SEEN_PREFIX = 'turn14_invoice_seen';
