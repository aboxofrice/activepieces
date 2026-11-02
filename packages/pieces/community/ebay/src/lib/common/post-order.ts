import { HttpMethod } from '@activepieces/pieces-common';
import { EbayAuthProps, ebayClient } from './client';

async function postOrderRequest<T>({ auth, method, path, queryParams, body }: PostOrderRequest): Promise<T> {
    return ebayClient.request<T>({ auth, method, path: `${BASE_PATH}${path}`, queryParams, body, authScheme: 'IAF' });
}

function flattenReturn({ summary }: { summary: EbayReturnSummary }): FlatReturn {
    const creation = summary.creationInfo;
    const refund = summary.sellerTotalRefund?.estimatedRefundAmount ?? summary.sellerTotalRefund?.actualRefundAmount;
    return {
        return_id: summary.returnId ?? null,
        order_id: summary.orderId ?? null,
        buyer_username: summary.buyerLoginName ?? null,
        state: summary.state ?? null,
        status: summary.status ?? null,
        return_type: summary.currentType ?? null,
        item_id: creation?.item?.itemId ?? null,
        transaction_id: creation?.item?.transactionId ?? null,
        return_quantity: creation?.item?.returnQuantity ?? null,
        reason: creation?.reason ?? null,
        reason_type: creation?.reasonType ?? null,
        buyer_comments: creation?.comments?.content ?? null,
        creation_date: creation?.creationDate?.value ?? null,
        seller_respond_by: summary.sellerResponseDue?.respondByDate?.value ?? null,
        seller_action_due: summary.sellerResponseDue?.activityDue ?? null,
        refund_amount: refund?.value ?? null,
        refund_currency: refund?.currency ?? null,
    };
}

function flattenCancellation({ cancellation }: { cancellation: EbayCancellation }): FlatCancellation {
    return {
        cancel_id: cancellation.cancelId ?? null,
        order_id: cancellation.legacyOrderId ?? null,
        cancel_state: cancellation.cancelState ?? null,
        cancel_status: cancellation.cancelStatus ?? null,
        cancel_reason: cancellation.cancelReason ?? null,
        requestor_type: cancellation.requestorType ?? null,
        request_date: cancellation.cancelRequestDate?.value ?? null,
        close_date: cancellation.cancelCloseDate?.value ?? null,
        refund_status: cancellation.paymentStatus ?? null,
    };
}

function toPostOrderDate({ value }: { value: string | undefined }): string | undefined {
    return value ? new Date(value).toISOString() : undefined;
}

const BASE_PATH = '/post-order/v2';

export const postOrderCommon = {
    request: postOrderRequest,
    flattenReturn,
    flattenCancellation,
    toPostOrderDate,
};

export type EbayDateValue = { value?: string };

export type EbayReturnSummary = {
    returnId?: string;
    orderId?: string;
    buyerLoginName?: string;
    state?: string;
    status?: string;
    currentType?: string;
    creationInfo?: {
        item?: { itemId?: string; transactionId?: string; returnQuantity?: number };
        reason?: string;
        reasonType?: string;
        comments?: { content?: string };
        creationDate?: EbayDateValue;
    };
    sellerResponseDue?: { activityDue?: string; respondByDate?: EbayDateValue };
    sellerTotalRefund?: {
        estimatedRefundAmount?: { value?: number; currency?: string };
        actualRefundAmount?: { value?: number; currency?: string };
    };
};

export type EbayCancellation = {
    cancelId?: string;
    legacyOrderId?: string;
    cancelState?: string;
    cancelStatus?: string;
    cancelReason?: string;
    requestorType?: string;
    paymentStatus?: string;
    cancelRequestDate?: EbayDateValue;
    cancelCloseDate?: EbayDateValue;
};

export type FlatReturn = {
    return_id: string | null;
    order_id: string | null;
    buyer_username: string | null;
    state: string | null;
    status: string | null;
    return_type: string | null;
    item_id: string | null;
    transaction_id: string | null;
    return_quantity: number | null;
    reason: string | null;
    reason_type: string | null;
    buyer_comments: string | null;
    creation_date: string | null;
    seller_respond_by: string | null;
    seller_action_due: string | null;
    refund_amount: number | null;
    refund_currency: string | null;
};

export type FlatCancellation = {
    cancel_id: string | null;
    order_id: string | null;
    cancel_state: string | null;
    cancel_status: string | null;
    cancel_reason: string | null;
    requestor_type: string | null;
    request_date: string | null;
    close_date: string | null;
    refund_status: string | null;
};

type PostOrderRequest = {
    auth: EbayAuthProps;
    method: HttpMethod;
    path: string;
    queryParams?: Record<string, string | number | undefined | null>;
    body?: unknown;
};
