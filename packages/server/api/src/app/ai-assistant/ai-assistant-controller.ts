import { AIAssistantChatRequest, AIAssistantChatResponse, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { aiAssistantService } from './ai-assistant-service'

export const aiAssistantController: FastifyPluginAsyncTypebox = async (app) => {
    app.post('/chat', ChatRequest, async (request) => {
        const platformId = request.principal.platform.id
        const projectId = request.principal.projectId
        return aiAssistantService(app.log).chat(platformId, projectId, request.body)
    })
}

const ChatRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        body: AIAssistantChatRequest,
        response: {
            [StatusCodes.OK]: AIAssistantChatResponse,
        },
    },
}
