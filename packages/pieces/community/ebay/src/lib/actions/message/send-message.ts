import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { messageCommon } from '../../common/message';

export const sendMessage = createAction({
    auth: ebayAuth,
    name: 'message_send_message',
    displayName: 'Message · Send Message',
    description: 'Reply in an existing conversation, or start a new one with a buyer.',
    props: {
        conversationId: Property.ShortText({
            displayName: 'Conversation ID',
            description: 'Set this to reply in an existing conversation.',
            required: false,
        }),
        otherPartyUsername: Property.ShortText({
            displayName: 'Buyer Username',
            description: 'Set this (instead of Conversation ID) to start a new conversation.',
            required: false,
        }),
        messageText: Property.LongText({
            displayName: 'Message',
            description: 'Max 2000 characters.',
            required: true,
        }),
        itemId: Property.ShortText({
            displayName: 'Item ID',
            description: 'Listing the message is about (optional).',
            required: false,
        }),
        emailCopyToSender: Property.Checkbox({
            displayName: 'Email Me a Copy',
            required: false,
            defaultValue: false,
        }),
        media: Property.Array({
            displayName: 'Attachments',
            description: 'Up to 5 HTTPS-hosted files.',
            required: false,
            properties: {
                mediaName: Property.ShortText({ displayName: 'Name', required: true }),
                mediaType: Property.StaticDropdown({
                    displayName: 'Type',
                    required: true,
                    options: {
                        options: ['IMAGE', 'PDF', 'DOC', 'TXT'].map((value) => ({ label: value, value })),
                    },
                }),
                mediaUrl: Property.ShortText({ displayName: 'HTTPS URL', required: true }),
            },
        }),
    },
    async run(context) {
        const { conversationId, otherPartyUsername, messageText, itemId, emailCopyToSender, media } = context.propsValue;
        if (!conversationId && !otherPartyUsername) {
            throw new Error('Set either Conversation ID (to reply) or Buyer Username (to start a conversation).');
        }
        if (messageText.length > MAX_MESSAGE_LENGTH) {
            throw new Error(`Message is ${messageText.length} characters; eBay allows at most ${MAX_MESSAGE_LENGTH}.`);
        }
        const response = await ebayClient.request<{ conversationId?: string; messageId?: string; createdDate?: string }>({
            auth: context.auth.props,
            method: HttpMethod.POST,
            path: `${messageCommon.basePath}/send_message`,
            body: {
                conversationId: conversationId || undefined,
                otherPartyUsername: conversationId ? undefined : otherPartyUsername,
                messageText,
                emailCopyToSender: emailCopyToSender ?? false,
                reference: itemId ? { referenceType: 'LISTING', referenceId: itemId } : undefined,
                messageMedia: media && media.length > 0 ? media : undefined,
            },
        });
        return {
            conversation_id: response.conversationId ?? conversationId ?? null,
            message_id: response.messageId ?? null,
            created_date: response.createdDate ?? null,
        };
    },
});

const MAX_MESSAGE_LENGTH = 2000;
