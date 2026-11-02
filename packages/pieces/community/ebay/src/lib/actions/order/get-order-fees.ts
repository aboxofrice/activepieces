import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { EbayAuthProps, ebayClient } from '../../common/client';
import { EbayAmount } from '../../common/order';

export const getOrderFees = createAction({
    auth: ebayAuth,
    name: 'order_get_fees',
    displayName: 'Order · Get Fees (Finances)',
    description: 'List Finances transactions — by default the Promoted Listings ad fees (AD_FEE) charged per order — between two dates. Needs the sell.finances scope.',
    props: {
        from: Property.DateTime({
            displayName: 'From',
            description: 'Transaction date range start.',
            required: true,
        }),
        to: Property.DateTime({
            displayName: 'To',
            description: 'Leave empty for "until now".',
            required: false,
        }),
        transactionType: Property.StaticDropdown({
            displayName: 'Transaction Type',
            required: true,
            defaultValue: 'NON_SALE_CHARGE',
            options: {
                options: [
                    { label: 'Non-sale charges (ad fees, etc.)', value: 'NON_SALE_CHARGE' },
                    { label: 'Sales', value: 'SALE' },
                    { label: 'Refunds', value: 'REFUND' },
                    { label: 'Shipping labels', value: 'SHIPPING_LABEL' },
                    { label: 'Credits', value: 'CREDIT' },
                    { label: 'Disputes', value: 'DISPUTE' },
                    { label: 'Transfers', value: 'TRANSFER' },
                    { label: 'Adjustments', value: 'ADJUSTMENT' },
                    { label: 'All types', value: 'ALL' },
                ],
            },
        }),
        feeType: Property.ShortText({
            displayName: 'Fee Type',
            description: 'Only keep transactions with this fee type (default AD_FEE). Clear it to keep every transaction.',
            required: false,
            defaultValue: 'AD_FEE',
        }),
        orderId: Property.ShortText({
            displayName: 'Order ID',
            description: 'Optional: only transactions for this order.',
            required: false,
        }),
    },
    async run(context) {
        const { from, to, transactionType, feeType, orderId } = context.propsValue;
        const filter = [
            `transactionDate:[${new Date(from).toISOString()}..${new Date(to ?? Date.now()).toISOString()}]`,
            transactionType !== 'ALL' ? `transactionType:{${transactionType}}` : null,
            orderId ? `orderId:{${orderId.trim()}}` : null,
        ].filter((part): part is string => part !== null).join(',');
        const { transactions, truncated } = await fetchTransactions({ auth: context.auth.props, filter, offset: 0, pagesLeft: MAX_PAGES });
        const rows = transactions
            .filter((transaction) => !feeType || transaction.feeType === feeType)
            .map((transaction) => flattenTransaction({ transaction }));
        return {
            count: rows.length,
            total_amount: Math.round(rows.reduce((sum, row) => sum + (row.amount ?? 0), 0) * 100) / 100,
            // More transactions matched than the 10 pages read; narrow the date range.
            truncated,
            transactions: rows,
        };
    },
});

async function fetchTransactions({ auth, filter, offset, pagesLeft }: { auth: EbayAuthProps; filter: string; offset: number; pagesLeft: number }): Promise<{ transactions: EbayTransaction[]; truncated: boolean }> {
    const page = await ebayClient.request<EbayTransactionsPage>({
        auth,
        method: HttpMethod.GET,
        host: 'apiz',
        path: '/sell/finances/v1/transaction',
        queryParams: { filter, limit: PAGE_SIZE, offset },
    });
    const transactions = page.transactions ?? [];
    if (!page.next || transactions.length === 0) {
        return { transactions, truncated: false };
    }
    if (pagesLeft <= 1) {
        return { transactions, truncated: true };
    }
    const rest = await fetchTransactions({ auth, filter, offset: offset + transactions.length, pagesLeft: pagesLeft - 1 });
    return { transactions: [...transactions, ...rest.transactions], truncated: rest.truncated };
}

function flattenTransaction({ transaction }: { transaction: EbayTransaction }): FlatTransaction {
    const value = Number(transaction.amount?.value);
    return {
        transaction_id: transaction.transactionId ?? null,
        transaction_type: transaction.transactionType ?? null,
        transaction_status: transaction.transactionStatus ?? null,
        transaction_date: transaction.transactionDate ?? null,
        order_id: transaction.orderId
            ?? transaction.references?.find((reference) => reference.referenceType === 'ORDER_ID')?.referenceId
            ?? null,
        fee_type: transaction.feeType ?? null,
        booking_entry: transaction.bookingEntry ?? null,
        amount: Number.isFinite(value) ? value : null,
        currency: transaction.amount?.currency ?? null,
        memo: transaction.transactionMemo ?? null,
    };
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

type EbayTransaction = {
    transactionId?: string;
    transactionType?: string;
    transactionStatus?: string;
    transactionDate?: string;
    orderId?: string;
    feeType?: string;
    bookingEntry?: string;
    amount?: EbayAmount;
    transactionMemo?: string;
    references?: { referenceId?: string; referenceType?: string }[];
};

type EbayTransactionsPage = {
    transactions?: EbayTransaction[];
    total?: number;
    next?: string;
};

type FlatTransaction = {
    transaction_id: string | null;
    transaction_type: string | null;
    transaction_status: string | null;
    transaction_date: string | null;
    order_id: string | null;
    fee_type: string | null;
    booking_entry: string | null;
    amount: number | null;
    currency: string | null;
    memo: string | null;
};
