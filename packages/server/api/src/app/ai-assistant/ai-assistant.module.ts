import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { aiAssistantController } from './ai-assistant-controller'

export const aiAssistantModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(aiAssistantController, { prefix: '/v1/ai-assistant' })
}
