import { HttpMethod } from '@activepieces/pieces-common';
import { AmazonSellerAuthProps, spApiClient } from './client';

async function getAvailableMessageTypes({ auth, orderId, marketplaceId }: OrderScope): Promise<string[]> {
    const response = await spApiClient.request<MessagingActionsResponse>({
        auth,
        method: HttpMethod.GET,
        path: `/messaging/v1/orders/${encodeURIComponent(orderId.trim())}`,
        queryParams: { marketplaceIds: [marketplaceId] },
    });
    const linked = response._links?.actions ?? [];
    const embedded = response._embedded?.actions ?? [];
    return [...new Set([...linked, ...embedded].map((action) => action.name).filter((name): name is string => typeof name === 'string'))];
}

async function getBuyerAttributes({ auth, orderId, marketplaceId }: OrderScope): Promise<{ buyer_locale: string | null }> {
    const response = await spApiClient.request<{ buyer?: { locale?: string } }>({
        auth,
        method: HttpMethod.GET,
        path: `/messaging/v1/orders/${encodeURIComponent(orderId.trim())}/attributes`,
        queryParams: { marketplaceIds: [marketplaceId] },
    });
    return { buyer_locale: response.buyer?.locale ?? null };
}

// Amazon decides per order which message types are allowed (order state, age, channel), and
// a disallowed POST fails with a terse 403. Checking first turns that into an actionable error.
async function sendTextMessage({ auth, orderId, marketplaceId, messageType, text }: SendTextMessageParams): Promise<SentMessage> {
    const allowed = await getAvailableMessageTypes({ auth, orderId, marketplaceId });
    if (!allowed.includes(messageType)) {
        const available = allowed.length > 0 ? allowed.join(', ') : 'none';
        throw new Error(`Amazon does not allow "${labelFor({ messageType })}" (${messageType}) for order ${orderId} right now. Types currently allowed for this order: ${available}.`);
    }
    await spApiClient.request<unknown>({
        auth,
        method: HttpMethod.POST,
        path: `/messaging/v1/orders/${encodeURIComponent(orderId.trim())}/messages/${messageType}`,
        queryParams: { marketplaceIds: [marketplaceId] },
        body: { text },
    });
    return { amazon_order_id: orderId.trim(), message_type: messageType, sent: true };
}

function labelFor({ messageType }: { messageType: string }): string {
    return TEXT_MESSAGE_TYPES.find((type) => type.value === messageType)?.label ?? messageType;
}

export const amazonMessaging = { getAvailableMessageTypes, getBuyerAttributes, sendTextMessage, labelFor };

export const TEXT_MESSAGE_TYPES = [
    { label: 'Confirm Order Details (ask the buyer a question before shipping)', value: 'confirmOrderDetails' },
    { label: 'Unexpected Problem (tell the buyer about an issue fulfilling the order)', value: 'unexpectedProblem' },
    { label: 'Confirm Delivery Details (arrange delivery with the buyer)', value: 'confirmDeliveryDetails' },
];

export const MAX_MESSAGE_TEXT_LENGTH = 2000;

type OrderScope = {
    auth: AmazonSellerAuthProps;
    orderId: string;
    marketplaceId: string;
};

type SendTextMessageParams = OrderScope & {
    messageType: string;
    text: string;
};

type SentMessage = {
    amazon_order_id: string;
    message_type: string;
    sent: boolean;
};

type MessagingActionsResponse = {
    _links?: { actions?: { href?: string; name?: string }[] };
    _embedded?: { actions?: { name?: string }[] };
};
