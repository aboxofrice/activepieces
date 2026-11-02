import { Property } from '@activepieces/pieces-framework';

function conversationTypeProp({ required }: { required: boolean }) {
    return Property.StaticDropdown({
        displayName: 'Conversation Type',
        description: 'Messages from buyers/other members, or notifications sent by eBay.',
        required,
        defaultValue: 'FROM_MEMBERS',
        options: {
            options: [
                { label: 'From members (buyers)', value: 'FROM_MEMBERS' },
                { label: 'From eBay', value: 'FROM_EBAY' },
            ],
        },
    });
}

function flattenMessage({ message }: { message: EbayMessage | undefined }): FlatMessage {
    return {
        message_id: message?.messageId ?? null,
        subject: message?.subject ?? null,
        body: message?.messageBody ?? null,
        sender_username: message?.senderUsername ?? null,
        recipient_username: message?.recipientUsername ?? null,
        created_date: message?.createdDate ?? null,
        read: message?.readStatus ?? null,
        media: message?.messageMedia ?? [],
    };
}

function flattenConversation({ conversation }: { conversation: EbayConversation }): FlatConversation {
    const latest = flattenMessage({ message: conversation.latestMessage });
    return {
        conversation_id: conversation.conversationId,
        conversation_title: conversation.conversationTitle ?? null,
        conversation_type: conversation.conversationType ?? null,
        conversation_status: conversation.conversationStatus ?? null,
        created_date: conversation.createdDate ?? null,
        item_id: conversation.referenceType === 'LISTING' ? conversation.referenceId ?? null : null,
        unread_count: conversation.unreadCount ?? 0,
        latest_message_id: latest.message_id,
        latest_message_subject: latest.subject,
        latest_message_body: latest.body,
        latest_message_sender: latest.sender_username,
        latest_message_recipient: latest.recipient_username,
        latest_message_date: latest.created_date,
        latest_message_read: latest.read,
    };
}

export const messageCommon = {
    basePath: '/commerce/message/v1',
    conversationTypeProp,
    flattenMessage,
    flattenConversation,
};

export type EbayMessageMedia = {
    mediaName?: string;
    mediaType?: string;
    mediaUrl?: string;
};

export type EbayMessage = {
    messageId?: string;
    subject?: string;
    messageBody?: string;
    senderUsername?: string;
    recipientUsername?: string;
    createdDate?: string;
    readStatus?: boolean;
    messageMedia?: EbayMessageMedia[];
};

export type EbayConversation = {
    conversationId: string;
    conversationTitle?: string;
    conversationType?: string;
    conversationStatus?: string;
    createdDate?: string;
    referenceId?: string;
    referenceType?: string;
    unreadCount?: number;
    latestMessage?: EbayMessage;
};

export type EbayConversationsPage = {
    conversations?: EbayConversation[];
    total?: number;
    next?: string;
};

export type EbayConversationMessagesPage = {
    conversationTitle?: string;
    conversationType?: string;
    conversationStatus?: string;
    messages?: EbayMessage[];
    total?: number;
    next?: string;
};

export type FlatMessage = {
    message_id: string | null;
    subject: string | null;
    body: string | null;
    sender_username: string | null;
    recipient_username: string | null;
    created_date: string | null;
    read: boolean | null;
    media: EbayMessageMedia[];
};

export type FlatConversation = {
    conversation_id: string;
    conversation_title: string | null;
    conversation_type: string | null;
    conversation_status: string | null;
    created_date: string | null;
    item_id: string | null;
    unread_count: number;
    latest_message_id: string | null;
    latest_message_subject: string | null;
    latest_message_body: string | null;
    latest_message_sender: string | null;
    latest_message_recipient: string | null;
    latest_message_date: string | null;
    latest_message_read: boolean | null;
};
