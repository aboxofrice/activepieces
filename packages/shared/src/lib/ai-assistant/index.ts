import { Static, Type } from '@sinclair/typebox'
import { AIProviderName } from '../ai-providers'

export enum AIAssistantMode {
    CREATE = 'create',
    REVIEW = 'review',
}

export const AIAssistantMessage = Type.Object({
    role: Type.Union([Type.Literal('user'), Type.Literal('assistant'), Type.Literal('system')]),
    content: Type.String(),
})
export type AIAssistantMessage = Static<typeof AIAssistantMessage>

export const AIAssistantChatRequest = Type.Object({
    provider: Type.Enum(AIProviderName),
    model: Type.String(),
    mode: Type.Enum(AIAssistantMode),
    messages: Type.Array(AIAssistantMessage),
})
export type AIAssistantChatRequest = Static<typeof AIAssistantChatRequest>

export const AIAssistantChatResponse = Type.Object({
    message: AIAssistantMessage,
})
export type AIAssistantChatResponse = Static<typeof AIAssistantChatResponse>
