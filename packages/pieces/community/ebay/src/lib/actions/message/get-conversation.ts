import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { EbayConversationMessagesPage, messageCommon } from '../../common/message';

export const getConversation = createAction({
    auth: ebayAuth,
    name: 'message_get_conversation',
    displayName: 'Message · Get Conversation Messages',
    description: 'Get the messages in one conversation — use this to give a chatbot the full thread.',
    props: {
        conversationId: Property.ShortText({
            displayName: 'Conversation ID',
            description: 'From the New Message trigger or Get Conversations.',
            required: true,
        }),
        conversationType: messageCommon.conversationTypeProp({ required: true }),
        limit: Property.Number({
            displayName: 'Limit',
            description: 'Max messages to return (1–50).',
            required: false,
            defaultValue: 50,
        }),
        offset: Property.Number({
            displayName: 'Offset',
            required: false,
            defaultValue: 0,
        }),
    },
    async run(context) {
        const { conversationId, conversationType, limit, offset } = context.propsValue;
        const page = await ebayClient.request<EbayConversationMessagesPage>({
            auth: context.auth.props,
            method: HttpMethod.GET,
            path: `${messageCommon.basePath}/conversation/${encodeURIComponent(conversationId)}`,
            queryParams: {
                conversation_type: conversationType,
                limit,
                offset,
            },
        });
        return {
            conversation_id: conversationId,
            conversation_title: page.conversationTitle ?? null,
            conversation_status: page.conversationStatus ?? null,
            total: page.total ?? 0,
            has_more: Boolean(page.next),
            messages: (page.messages ?? []).map((message) => messageCommon.flattenMessage({ message })),
        };
    },
});
