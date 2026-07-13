import {
  Property,
  TriggerStrategy,
  createTrigger,
} from '@activepieces/pieces-framework';
import {
  MarkdownVariant,
  USE_DRAFT_QUERY_PARAM_NAME,
  ChatFormResponse,
} from '@activepieces/shared';

const responseMarkdown = `
This trigger sets up a chat interface. Ensure that **Respond on UI** is used in your flow`;

const markdown = `
**Published Chat URL:**
\`\`\`text
{{chatUrl}}
\`\`\`
Use this for production, views the published version of the chat flow.
<br>
<br>
`;

export const onChatSubmission = createTrigger({
  name: 'chat_submission',
  displayName: 'Chat UI',
  description: 'Trigger the flow by sending a message',
  props: {
    about: Property.MarkDown({
      value: markdown,
      variant: MarkdownVariant.BORDERLESS,
    }),
    responseMarkdown: Property.MarkDown({
      value: responseMarkdown,
      variant: MarkdownVariant.WARNING,
    }),
    botName: Property.ShortText({
      displayName: 'Bot Name',
      description: 'The name of the chatbot',
      required: true,
      defaultValue: 'AI Bot',
    }),
    welcomeMessage: Property.LongText({
      displayName: 'Welcome Message',
      description:
        'Shown above the suggested topics before the first message, e.g. what the bot can do.',
      required: false,
    }),
    suggestedTopics: Property.Array({
      displayName: 'Suggested Topics',
      description:
        'Quick-start topics shown as buttons before the first message. Clicking one sends it as the message.',
      required: false,
    }),
  },
  sampleData: undefined,
  type: TriggerStrategy.WEBHOOK,
  async onEnable() {
    return;
  },
  async onDisable() {
    return;
  },
  async run(ctx) {
    const item = ctx.payload.body as { chatId?: string; message?: string };
    if (!item.chatId) {
      throw new Error('Chat ID is required');
    }
    if (!item.message) {
      throw new Error('Message is required');
    }
    const files = Object.entries(item)
      .filter(([key]) => key.startsWith('file'))
      .map(([key, value]) => {
        const index = Number(key.split('[')[1].split(']')[0]);
        return [index, value] as const;
      })
      .sort(([indexA], [indexB]) => indexA - indexB)
      .map(([_, value]) => value);

    const response: ChatFormResponse = {
      sessionId: item.chatId,
      message: item.message,
      files,
    }
    return [response];
  },
});
