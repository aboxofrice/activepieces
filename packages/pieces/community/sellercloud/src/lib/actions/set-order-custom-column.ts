import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { sellercloudAuth, sellercloudAuthProps } from '../auth';
import { sellercloudClient } from '../common/client';
import { OrderCustomColumn, sellercloudDropdowns } from '../common/dropdowns';

export const setOrderCustomColumn = createAction({
    auth: sellercloudAuth,
    name: 'set_order_custom_column',
    displayName: 'Set Order Custom Column',
    description: 'Set the value of one custom column on a sales order.',
    props: {
        orderId: Property.Number({
            displayName: 'Order ID',
            description: 'The SellerCloud order ID. Custom columns load once it is entered.',
            required: true,
        }),
        column: sellercloudDropdowns.orderCustomColumn,
        value: Property.ShortText({
            displayName: 'Value',
            description: 'For Yes/No columns use true/false (or yes/no); numbers for Integer/Decimal columns. Leave empty to clear the column.',
            required: false,
        }),
    },
    async run(context) {
        const { orderId, column, value } = context.propsValue;
        const auth = sellercloudAuthProps(context.auth);
        const token = await sellercloudClient.getToken({ auth, store: context.store });
        const columns = await sellercloudDropdowns.listOrderCustomColumns({ auth, orderId, token });
        const target = columns.find((candidate) => candidate.ColumnName === column);
        if (!target) {
            throw new Error(`SellerCloud: order ${orderId} has no custom column "${column}". Available: ${columns.map((c) => c.ColumnName).join(', ')}`);
        }
        const coerced = coerceValue({ column: target, raw: value ?? '' });
        await sellercloudClient.request<unknown>({
            auth,
            token,
            method: HttpMethod.PUT,
            path: `/Orders/${orderId}/CustomColumns`,
            body: { ColumnName: target.ColumnName, Value: coerced },
        });
        return {
            success: true,
            order_id: orderId,
            column_name: target.ColumnName,
            column_display_name: target.DisplayName ?? target.ColumnName,
            previous_value: target.Value ?? null,
            new_value: coerced,
            note: 'SellerCloud applies writes asynchronously; a read straight after may still show the old value.',
        };
    },
});

function coerceValue({ column, raw }: { column: OrderCustomColumn; raw: string }): string | number | boolean | null {
    const text = raw.trim();
    if (text === '') {
        return column.DataType === BOOLEAN ? false : null;
    }
    if (column.DataType === BOOLEAN) {
        const lowered = text.toLowerCase();
        if (TRUE_WORDS.includes(lowered)) {
            return true;
        }
        if (FALSE_WORDS.includes(lowered)) {
            return false;
        }
        throw new Error(`SellerCloud: "${column.ColumnName}" is a Yes/No column; use true or false, not "${raw}".`);
    }
    if (column.DataType === INTEGER || column.DataType === DECIMAL) {
        const parsed = Number(text);
        if (Number.isNaN(parsed) || (column.DataType === INTEGER && !Number.isInteger(parsed))) {
            throw new Error(`SellerCloud: "${column.ColumnName}" needs ${column.DataType === INTEGER ? 'a whole number' : 'a number'}, not "${raw}".`);
        }
        return parsed;
    }
    if (column.DataLength && column.DataType === TEXT && text.length > column.DataLength) {
        throw new Error(`SellerCloud: "${column.ColumnName}" holds at most ${column.DataLength} characters (got ${text.length}).`);
    }
    return text;
}

const TEXT = 0;
const INTEGER = 1;
const DECIMAL = 2;
const BOOLEAN = 4;
const TRUE_WORDS = ['true', 'yes', 'y', '1'];
const FALSE_WORDS = ['false', 'no', 'n', '0'];
