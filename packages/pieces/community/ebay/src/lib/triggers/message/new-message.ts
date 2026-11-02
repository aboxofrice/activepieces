import { DedupeStrategy, HttpMethod, Polling, pollingHelper } from '@activepieces/pieces-common';
import { AppConnectionValueForAuthProperty, createTrigger, Property, StaticPropsValue, TriggerStrategy } from '@activepieces/pieces-framework';
import { ebayAuth } from '../../auth';
import { ebayClient, EbayAuthProps } from '../../common/client';
import { EbayConversation, EbayConversationsPage, messageCommon } from '../../common/message';

const props = {
    ignoreOwnMessages: Property.Checkbox({
        displayName: 'Ignore My Own Replies',
        description: 'Skip conversations whose latest message was sent by this seller account (e.g. your own or the chatbot\'s replies).',
        required: false,
        defaultValue: true,
    }),
};

const polling: Polling<AppConnectionValueForAuthProperty<typeof ebayAuth>, StaticPropsValue<typeof props>> = {
    strategy: DedupeStrategy.TIMEBASED,
    items: async ({ auth, propsValue, lastFetchEpochMS }) => {
        const sellerUsername = await ebayClient.getUsername({ auth: auth.props });
        const conversations = await fetchConversations({
            auth: auth.props,
            startTime: lastFetchEpochMS > 0 ? new Date(lastFetchEpochMS).toISOString() : undefined,
            maxPages: lastFetchEpochMS > 0 ? MAX_PAGES : 1,
        });
        return conversations
            .filter((conversation) => conversation.latestMessage?.createdDate)
            .filter((conversation) => propsValue.ignoreOwnMessages === false
                || conversation.latestMessage?.senderUsername?.toLowerCase() !== sellerUsername.toLowerCase())
            .map((conversation) => ({
                epochMilliSeconds: new Date(conversation.latestMessage?.createdDate ?? 0).getTime(),
                data: { ...messageCommon.flattenConversation({ conversation }), seller_username: sellerUsername },
            }));
    },
};

export const newMessage = createTrigger({
    auth: ebayAuth,
    name: 'message_new_message',
    displayName: 'Message · New Buyer Message',
    description: 'Fires when a buyer/member conversation gets a new latest message. If several arrive between polls, it fires once per conversation — use Get Conversation Messages for the full thread.',
    props,
    type: TriggerStrategy.POLLING,
    sampleData: {
        conversation_id: '1234567890',
        conversation_title: 'Question about item 123456789012',
        conversation_type: 'FROM_MEMBERS',
        conversation_status: 'ACTIVE',
        created_date: '2026-09-28T14:02:11.000Z',
        item_id: '123456789012',
        unread_count: 1,
        latest_message_id: '9876543210',
        latest_message_subject: 'Does this fit a 2019 Ram 1500?',
        latest_message_body: 'Hi, will this part fit my 2019 Ram 1500 Laramie?',
        latest_message_sender: 'buyer_username',
        latest_message_recipient: 'bproautoparts',
        latest_message_date: '2026-09-28T14:02:11.000Z',
        latest_message_read: false,
        seller_username: 'bproautoparts',
    },
    async test(context) {
        return await pollingHelper.test(polling, context);
    },
    async onEnable(context) {
        await pollingHelper.onEnable(polling, context);
    },
    async onDisable(context) {
        await pollingHelper.onDisable(polling, context);
    },
    async run(context) {
        return await pollingHelper.poll(polling, context);
    },
});

async function fetchConversations({ auth, startTime, maxPages }: { auth: EbayAuthProps; startTime: string | undefined; maxPages: number }): Promise<EbayConversation[]> {
    const pages = await fetchPages({ auth, startTime, offset: 0, remainingPages: maxPages });
    return pages.flatMap((page) => page.conversations ?? []);
}

async function fetchPages({ auth, startTime, offset, remainingPages }: { auth: EbayAuthProps; startTime: string | undefined; offset: number; remainingPages: number }): Promise<EbayConversationsPage[]> {
    const page = await ebayClient.request<EbayConversationsPage>({
        auth,
        method: HttpMethod.GET,
        path: `${messageCommon.basePath}/conversation`,
        queryParams: {
            conversation_type: 'FROM_MEMBERS',
            start_time: startTime,
            limit: PAGE_SIZE,
            offset,
        },
    });
    if (!page.next || remainingPages <= 1) {
        return [page];
    }
    return [page, ...await fetchPages({ auth, startTime, offset: offset + PAGE_SIZE, remainingPages: remainingPages - 1 })];
}

const PAGE_SIZE = 50;
const MAX_PAGES = 10;
