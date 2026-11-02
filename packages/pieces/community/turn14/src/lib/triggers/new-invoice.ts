import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Orders } from '../common/orders';
import { turn14Polling } from '../common/polling';

export const newInvoice = createTrigger({
    auth: turn14Auth,
    name: 'new_invoice',
    displayName: 'New Invoice',
    description: 'Fires for each new Turn14 invoice, with totals, amount due, tracking numbers, line items and the Turn14 order it belongs to.',
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
    },
    async onEnable(context) {
        const { rows: invoices } = await turn14Orders.listInvoices({ auth: turn14AuthProps(context.auth), maxPages: MAX_PAGES });
        await turn14Polling.writeIdSet({ store: context.store, prefix: SEEN_PREFIX, ids: invoices.map((invoice) => String(invoice.id)) });
    },
    async onDisable(context) {
        await turn14Polling.deleteIdSet({ store: context.store, prefix: SEEN_PREFIX });
    },
    async test(context) {
        const { rows: invoices } = await turn14Orders.listInvoices({ auth: turn14AuthProps(context.auth), maxPages: 1 });
        return invoices
            .map((invoice) => turn14Orders.flattenInvoice({ invoice }))
            .sort((left, right) => String(right['date'] ?? '').localeCompare(String(left['date'] ?? '')))
            .slice(0, TEST_LIMIT);
    },
    async run(context) {
        const { rows: invoices } = await turn14Orders.listInvoices({ auth: turn14AuthProps(context.auth), maxPages: MAX_PAGES });
        const seen = await turn14Polling.readIdSet({ store: context.store, prefix: SEEN_PREFIX });
        const fresh = invoices.filter((invoice) => !seen.has(String(invoice.id)));
        if (fresh.length > 0) {
            await turn14Polling.writeIdSet({ store: context.store, prefix: SEEN_PREFIX, ids: [...seen, ...fresh.map((invoice) => String(invoice.id))] });
        }
        return fresh
            .map((invoice) => turn14Orders.flattenInvoice({ invoice }))
            .sort((left, right) => String(left['date'] ?? '').localeCompare(String(right['date'] ?? '')));
    },
});

const MAX_PAGES = 50;
const TEST_LIMIT = 5;
const SEEN_PREFIX = 'turn14_invoice_seen';
