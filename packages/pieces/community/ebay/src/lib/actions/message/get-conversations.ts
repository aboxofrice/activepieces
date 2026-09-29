import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { EbayConversationsPage, messageCommon } from '../../common/message';

export const getConversations = createAction({
    auth: ebayAuth,
    name: 'message_get_conversations',
    displayName: 'Message · Get Conversations',
    description: 'List message conversations (one row per conversation, with its latest message).',
    props: {
        conversationType: messageCommon.conversationTypeProp({ required: true }),
        conversationStatus: Property.StaticDropdown({
            displayName: 'Status',
            required: false,
            options: {
                options: [
                    { label: 'Active', value: 'ACTIVE' },
                    { label: 'Archived', value: 'ARCHIVE' },
                    { label: 'Deleted', value: 'DELETE' },
                    { label: 'Read', value: 'READ' },
                    { label: 'Unread', value: 'UNREAD' },
                ],
            },
        }),
        otherPartyUsername: Property.ShortText({
            displayName: 'Buyer Username',
            description: 'Only conversations with this eBay user.',
            required: false,
        }),
        itemId: Property.ShortText({
            displayName: 'Item ID',
            description: 'Only conversations about this listing (the number in the listing URL).',
            required: false,
        }),
        startTime: Property.DateTime({
            displayName: 'Messages After',
            description: 'Only applies to conversations from members.',
            required: false,
        }),
        endTime: Property.DateTime({
            displayName: 'Messages Before',
            required: false,
        }),
        limit: Property.Number({
            displayName: 'Limit',
            description: 'Max conversations to return (1–50).',
            required: false,
            defaultValue: 25,
        }),
        offset: Property.Number({
            displayName: 'Offset',
            required: false,
            defaultValue: 0,
        }),
    },
    async run(context) {
        const { conversationType, conversationStatus, otherPartyUsername, itemId, startTime, endTime, limit, offset } = context.propsValue;
        const page = await ebayClient.request<EbayConversationsPage>({
            auth: context.auth.props,
            method: HttpMethod.GET,
            path: `${messageCommon.basePath}/conversation`,
            queryParams: {
                conversation_type: conversationType,
                conversation_status: conversationStatus,
                other_party_username: otherPartyUsername,
                reference_id: itemId,
                reference_type: itemId ? 'LISTING' : undefined,
                start_time: startTime,
                end_time: endTime,
                limit,
                offset,
            },
        });
        return {
            total: page.total ?? 0,
            has_more: Boolean(page.next),
            conversations: (page.conversations ?? []).map((conversation) => messageCommon.flattenConversation({ conversation })),
        };
    },
});
