import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { aiAssistantController } from './ai-assistant-controller'

export const aiAssistantModule: FastifyPluginAsyncZod = async (app) => {
    await app.register(aiAssistantController, { prefix: '/v1/ai-assistant' })
}
