import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient } from '../../common/client';
import { messageCommon } from '../../common/message';

export const updateConversation = createAction({
    auth: ebayAuth,
    name: 'message_update_conversation',
    displayName: 'Message · Update Conversation',
    description: 'Mark a conversation read/unread, or archive, restore or delete it.',
    props: {
        conversationId: Property.ShortText({
            displayName: 'Conversation ID',
            required: true,
        }),
        conversationType: messageCommon.conversationTypeProp({ required: true }),
        update: Property.StaticDropdown({
            displayName: 'Change',
            required: true,
            defaultValue: 'READ',
            options: {
                options: [
                    { label: 'Mark as read', value: 'READ' },
                    { label: 'Mark as unread', value: 'UNREAD' },
                    { label: 'Archive', value: 'ARCHIVE' },
                    { label: 'Move back to active', value: 'ACTIVE' },
                    { label: 'Delete', value: 'DELETE' },
                ],
            },
        }),
    },
    async run(context) {
        const { conversationId, conversationType, update } = context.propsValue;
        // eBay ignores conversationStatus when `read` is present, so send exactly one of them.
        const change = update === 'READ' || update === 'UNREAD'
            ? { read: update === 'READ' }
            : { conversationStatus: update };
        await ebayClient.request<unknown>({
            auth: context.auth.props,
            method: HttpMethod.POST,
            path: `${messageCommon.basePath}/update_conversation`,
            body: { conversationId, conversationType, ...change },
        });
        return { conversation_id: conversationId, updated: update };
    },
});
