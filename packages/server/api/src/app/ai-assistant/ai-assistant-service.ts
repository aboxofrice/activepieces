import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
    AIAssistantChatRequest,
    AIAssistantChatResponse,
    AIAssistantMode,
    AIProviderConfig,
    AIProviderName,
    AzureProviderConfig,
    PlatformId,
} from '@activepieces/shared'
import { generateText, LanguageModel } from 'ai'
import { FastifyBaseLogger } from 'fastify'
import { aiProviderService } from '../ai/ai-provider-service'

const SYSTEM_PROMPTS: Record<AIAssistantMode, string> = {
    [AIAssistantMode.CREATE]: `You are an AI assistant that generates Activepieces automation flows. Your goal is to help users create integrations between different systems.

IMPORTANT: When the user describes what they want to build, analyze their message to extract:
- Source system (e.g., Stripe, HubSpot, Salesforce, webhook)
- Destination system (e.g., Salesforce, Slack, database)
- Trigger event (e.g., new customer created, deal updated, scheduled)
- Data to sync (e.g., customer info, deal data)

If the user has provided enough information (source, destination, and trigger), proceed to generate the flow. Only ask clarifying questions if critical information is missing.

## Common Pieces and Triggers

Here are some common Activepieces pieces:
- @activepieces/piece-stripe: Triggers include "New Customer", "New Payment", "New Subscription". Actions include "Create Customer", "Create Invoice"
- @activepieces/piece-salesforce: Triggers include "New Record", "Updated Record". Actions include "Create Record", "Update Record", "Find Records"
- @activepieces/piece-hubspot: Triggers include "New Contact", "New Deal", "Updated Deal". Actions include "Create Contact", "Update Contact", "Create Deal"
- @activepieces/piece-slack: Actions include "Send Message", "Send Direct Message"
- @activepieces/piece-schedule: Triggers include "Every X Minutes", "Cron Expression"
- @activepieces/piece-webhook: Triggers include "Catch Webhook"

## Flow JSON Structure

When generating a flow, produce valid JSON:

\`\`\`json
{
  "name": "Flow Name",
  "type": "SHARED",
  "summary": "Brief description",
  "description": "Detailed description",
  "pieces": ["@activepieces/piece-stripe", "@activepieces/piece-salesforce"],
  "status": "PUBLISHED",
  "flows": [{
    "displayName": "Main Flow",
    "trigger": {
      "name": "trigger",
      "valid": true,
      "displayName": "Trigger Name",
      "type": "PIECE_TRIGGER",
      "settings": {
        "pieceName": "@activepieces/piece-stripe",
        "pieceVersion": "~0.4.0",
        "triggerName": "new_customer",
        "input": {
          "auth": "{{connections['stripe']}}"
        }
      },
      "nextAction": {
        "name": "step_1",
        "type": "PIECE",
        "valid": true,
        "displayName": "Create Salesforce Record",
        "settings": {
          "pieceName": "@activepieces/piece-salesforce",
          "pieceVersion": "~0.8.0",
          "actionName": "create_record",
          "input": {
            "auth": "{{connections['salesforce']}}",
            "object": "Contact",
            "fields": {
              "Email": "{{trigger['email']}}",
              "FirstName": "{{trigger['name']}}"
            }
          }
        },
        "nextAction": null
      }
    },
    "valid": true,
    "schemaVersion": "10"
  }]
}
\`\`\`

## Variable References

- Trigger output: \`{{trigger['fieldName']}}\`
- Previous step: \`{{step_1['fieldName']}}\`
- Connection: \`{{connections['connection_name']}}\`

When you have enough information, generate the complete flow JSON. Explain what the flow does and how to use it after import.`,

    [AIAssistantMode.REVIEW]: `You are an AI assistant that reviews and modifies Activepieces automation flows.

When users paste a flow JSON:
1. Parse and analyze the structure
2. Identify the trigger type and all actions
3. Check for issues like broken nextAction chains, invalid references, or missing inputs
4. Provide a summary of what the flow does
5. Suggest improvements if applicable

When users request changes:
1. Understand the modification needed
2. Generate the updated flow JSON
3. Highlight what was changed

Common issues to check:
- nextAction chain must end with null
- Step names must be unique (step_1, step_2, etc.)
- Variable references must point to existing steps
- Connection placeholders should be descriptive

Be specific and actionable in your analysis. If you see issues, explain how to fix them.`,
}

export const aiAssistantService = (log: FastifyBaseLogger) => ({
    async chat(
        platformId: PlatformId,
        request: AIAssistantChatRequest,
    ): Promise<AIAssistantChatResponse> {
        log.info({ provider: request.provider, model: request.model, mode: request.mode }, 'AI Assistant chat request')

        try {
            const config = await aiProviderService(log).getConfig(platformId, request.provider)
            log.info({ provider: request.provider }, 'Got provider config')

            const model = createModel(request.provider, request.model, config)
            log.info({ provider: request.provider, model: request.model }, 'Created model')

            const systemPrompt = SYSTEM_PROMPTS[request.mode]

            const messages = request.messages.map(m => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content,
            }))

            log.info({ messageCount: messages.length }, 'Calling generateText')
            const result = await generateText({
                model,
                system: systemPrompt,
                messages,
            })
            log.info({ textLength: result.text.length }, 'generateText completed')

            return {
                message: {
                    role: 'assistant',
                    content: result.text,
                },
            }
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorStack = error instanceof Error ? error.stack : undefined
            log.error({ error: errorMessage, stack: errorStack, provider: request.provider, model: request.model }, 'AI Assistant error')
            throw error
        }
    },
})

function createModel(
    providerId: AIProviderName,
    modelId: string,
    config: AIProviderConfig,
): LanguageModel {
    switch (providerId) {
        case AIProviderName.OPENAI: {
            const provider = createOpenAI({ apiKey: config.apiKey })
            return provider.chat(modelId)
        }
        case AIProviderName.ANTHROPIC: {
            const provider = createAnthropic({ apiKey: config.apiKey })
            return provider(modelId)
        }
        case AIProviderName.GOOGLE: {
            const provider = createGoogleGenerativeAI({ apiKey: config.apiKey })
            return provider(modelId)
        }
        case AIProviderName.AZURE: {
            const { apiKey, resourceName } = config as AzureProviderConfig
            const provider = createAzure({ resourceName, apiKey })
            return provider.chat(modelId)
        }
        case AIProviderName.ACTIVEPIECES:
        case AIProviderName.OPENROUTER: {
            const provider = createOpenRouter({ apiKey: config.apiKey })
            return provider.chat(modelId)
        }
        default:
            throw new Error(`Provider ${providerId} is not supported`)
    }
}
