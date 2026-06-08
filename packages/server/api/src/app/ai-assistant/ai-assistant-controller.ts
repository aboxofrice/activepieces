import { AIAssistantMode, AIProviderName, Permission, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { ProjectResourceType } from '../core/security/authorization/common'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { aiAssistantService } from './ai-assistant-service'

export const aiAssistantController: FastifyPluginAsyncZod = async (app) => {
    app.post('/chat', ChatRequest, async (request) => {
        const platformId = request.principal.platform.id
        const projectId = request.projectId
        return aiAssistantService(app.log).chat(platformId, projectId, request.body)
    })
}

const AIAssistantMessageSchema = z.object({
    role: z.union([z.literal('user'), z.literal('assistant'), z.literal('system')]),
    content: z.string(),
})

const AIAssistantChatRequestSchema = z.object({
    projectId: z.string(),
    provider: z.nativeEnum(AIProviderName),
    model: z.string(),
    mode: z.nativeEnum(AIAssistantMode),
    messages: z.array(AIAssistantMessageSchema),
})

const AIAssistantChatResponseSchema = z.object({
    message: AIAssistantMessageSchema,
})

const ChatRequest = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_PROJECT, {
            type: ProjectResourceType.BODY,
            bodyKey: 'projectId',
        }),
    },
    schema: {
        body: AIAssistantChatRequestSchema,
        response: {
            [StatusCodes.OK]: AIAssistantChatResponseSchema,
        },
    },
}
