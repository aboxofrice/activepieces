import {
    AIAssistantChatRequest,
    AIAssistantChatResponse,
    AIAssistantMode,
    AIProviderName,
    AzureProviderAuthConfig,
    AzureProviderConfig,
    BaseAIProviderAuthConfig,
    GetProviderConfigResponse,
    PlatformId,
    ProjectId,
} from '@activepieces/shared'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, LanguageModel } from 'ai'
import { FastifyBaseLogger } from 'fastify'
import { aiProviderService } from '../ai/ai-provider-service'
import { buildAssistantContext } from './ai-assistant-context'

const SYSTEM_PROMPTS: Record<AIAssistantMode, string> = {
    [AIAssistantMode.CREATE]: `Generate Activepieces flows. PHASE1: Gather requirements (trigger,actions,mapping,branching). Present step table. WAIT for confirmation. PHASE2: Generate JSON.

RULES:
1)CRITICAL: Use EXACT pieceName and pieceVersion from <available-pieces>. NEVER guess piece names. Custom pieces use scopes like @vqnguyen1/, @kinective/, or @company/ - copy exactly as provided. NEVER use @activepieces/ for custom pieces.
2)CODE sourceCode MUST be {"code":"...","packageJson":"{}"} NOT string
3)Include sampleData:{},propertySettings,errorHandlingOptions
4)Router children count=branches count

VARS:{{trigger['body']['x']}},{{step_1['x']}},{{connections['x']}},{{step_N['item']}}/{{step_N['index']}}

OPS:TEXT_EXACTLY_MATCHES,TEXT_CONTAINS,TEXT_STARTS_WITH,TEXT_ENDS_WITH,TEXT_DOES_NOT_MATCH,EXISTS,DOES_NOT_EXIST,BOOLEAN_IS_TRUE,BOOLEAN_IS_FALSE,NUMBER_EQUALS,NUMBER_GREATER_THAN,NUMBER_LESS_THAN

TEMPLATES:
TRIGGER:{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"X","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.1.25","triggerName":"catch_webhook","input":{"authType":"none","authFields":{}},"sampleData":{},"propertySettings":{"authType":{"type":"MANUAL"},"authFields":{"type":"MANUAL","schema":{}}}},"nextAction":X}
PIECE:{"name":"step_N","type":"PIECE","valid":true,"displayName":"X","settings":{"pieceName":"X","pieceVersion":"X","actionName":"X","input":{"auth":"{{connections['X']}}"},"sampleData":{},"propertySettings":{},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":X}
CODE:{"name":"step_N","type":"CODE","valid":true,"displayName":"X","settings":{"input":{},"sampleData":{},"sourceCode":{"code":"export const code = async (inputs) => { return {}; };","packageJson":"{}"},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":X}
ROUTER:{"name":"step_N","type":"ROUTER","valid":true,"displayName":"X","settings":{"branches":[{"branchName":"X","branchType":"CONDITION","conditions":[[{"operator":"BOOLEAN_IS_TRUE","firstValue":"{{step_X['x']}}","secondValue":"","caseSensitive":false}]]},{"branchName":"X","branchType":"FALLBACK"}],"sampleData":{},"executionType":"EXECUTE_FIRST_MATCH"},"children":[X,X]}
LOOP:{"name":"step_N","type":"LOOP_ON_ITEMS","valid":true,"displayName":"X","settings":{"items":"{{step_X['arr']}}","sampleData":{}},"firstLoopAction":X,"nextAction":X}

EX1(Router+Chain):{"displayName":"X","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Webhook","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.1.25","triggerName":"catch_webhook","input":{"authType":"none","authFields":{}},"sampleData":{},"propertySettings":{"authType":{"type":"MANUAL"},"authFields":{"type":"MANUAL","schema":{}}}},"nextAction":{"name":"step_1","type":"PIECE","valid":true,"displayName":"Search","settings":{"pieceName":"@vqnguyen1/piece-kinective-placeholder","pieceVersion":"~0.0.2","actionName":"get_party_list","input":{"auth":"{{connections['kinective-placeholder']}}","taxId":"{{trigger['body']['taxId']}}"},"sampleData":{},"propertySettings":{"taxId":{"type":"MANUAL"}},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":{"name":"step_2","type":"CODE","valid":true,"displayName":"Check","settings":{"input":{"r":"{{step_1}}"},"sampleData":{},"sourceCode":{"code":"export const code = async (inputs) => { const p=inputs.r?.PartyListRec||[]; return {exists:p.length>0,id:p[0]?.PartyKeys?.PartyId}; };","packageJson":"{}"},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":{"name":"step_3","type":"ROUTER","valid":true,"displayName":"Exists?","settings":{"branches":[{"branchName":"Update","branchType":"CONDITION","conditions":[[{"operator":"BOOLEAN_IS_TRUE","firstValue":"{{step_2['exists']}}","secondValue":"","caseSensitive":false}]]},{"branchName":"Create","branchType":"FALLBACK"}],"sampleData":{},"executionType":"EXECUTE_FIRST_MATCH"},"children":[{"name":"step_4","type":"PIECE","valid":true,"displayName":"Update","settings":{"pieceName":"@vqnguyen1/piece-kinective-placeholder","pieceVersion":"~0.0.2","actionName":"update_party","input":{"auth":"{{connections['kinective-placeholder']}}","partyId":"{{step_2['id']}}","partyData":{}},"sampleData":{},"propertySettings":{"partyId":{"type":"MANUAL"},"partyData":{"type":"MANUAL"}},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":null},{"name":"step_5","type":"PIECE","valid":true,"displayName":"Create","settings":{"pieceName":"@vqnguyen1/piece-kinective-placeholder","pieceVersion":"~0.0.2","actionName":"add_party","input":{"auth":"{{connections['kinective-placeholder']}}","partyData":{}},"sampleData":{},"propertySettings":{"partyData":{"type":"MANUAL"}},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":null}]}}}},"schemaVersion":"10"}

EX2(Loop+Router):{"displayName":"X","trigger":{"name":"trigger","type":"PIECE_TRIGGER","valid":true,"displayName":"Webhook","settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.1.25","triggerName":"catch_webhook","input":{"authType":"none","authFields":{}},"sampleData":{},"propertySettings":{"authType":{"type":"MANUAL"},"authFields":{"type":"MANUAL","schema":{}}}},"nextAction":{"name":"step_1","type":"CODE","valid":true,"displayName":"Extract","settings":{"input":{"d":"{{trigger['body']}}"},"sampleData":{},"sourceCode":{"code":"export const code = async (inputs) => { return {items:inputs.d.items||[]}; };","packageJson":"{}"},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":{"name":"step_2","type":"LOOP_ON_ITEMS","valid":true,"displayName":"Loop","settings":{"items":"{{step_1['items']}}","sampleData":{}},"firstLoopAction":{"name":"step_3","type":"ROUTER","valid":true,"displayName":"Check","settings":{"branches":[{"branchName":"Yes","branchType":"CONDITION","conditions":[[{"operator":"EXISTS","firstValue":"{{step_2['item']['id']}}","secondValue":"","caseSensitive":false}]]},{"branchName":"No","branchType":"FALLBACK"}],"sampleData":{},"executionType":"EXECUTE_FIRST_MATCH"},"children":[{"name":"step_4","type":"PIECE","valid":true,"displayName":"Action","settings":{"pieceName":"@vqnguyen1/piece-kinective-placeholder","pieceVersion":"~0.0.2","actionName":"add_party","input":{"auth":"{{connections['kinective-placeholder']}}","partyData":{}},"sampleData":{},"propertySettings":{"partyData":{"type":"MANUAL"}},"errorHandlingOptions":{"retryOnFailure":{"value":false},"continueOnFailure":{"value":false}}},"nextAction":null},null]},"nextAction":null}}},"schemaVersion":"10"}

OUTPUT:1)Requirements 2)Step table 3)JSON in \`\`\`json block 4)Connections

FORMAT:Output flow JSON must have {displayName,trigger:{...},schemaVersion:"10"}. Frontend calls API to import. Ensure JSON is valid and parseable.`,

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
        projectId: ProjectId,
        request: AIAssistantChatRequest,
    ): Promise<AIAssistantChatResponse> {
        log.info({ provider: request.provider, model: request.model, mode: request.mode }, 'AI Assistant chat request')

        try {
            const config = await aiProviderService(log).getConfigOrThrow({ platformId, provider: request.provider })
            log.info({ provider: request.provider }, 'Got provider config')

            const model = createModel(request.provider, request.model, config.auth as BaseAIProviderAuthConfig, config.config)
            log.info({ provider: request.provider, model: request.model }, 'Created model')

            const context = await buildAssistantContext(log, {
                platformId,
                projectId,
                messages: request.messages,
            })
            const systemPrompt = `${SYSTEM_PROMPTS[request.mode]}\n\n${context}`

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
    auth: BaseAIProviderAuthConfig,
    providerConfig: GetProviderConfigResponse['config'],
): LanguageModel {
    switch (providerId) {
        case AIProviderName.OPENAI: {
            const provider = createOpenAI({ apiKey: auth.apiKey })
            return provider.chat(modelId)
        }
        case AIProviderName.ANTHROPIC: {
            const provider = createAnthropic({ apiKey: auth.apiKey })
            return provider(modelId)
        }
        case AIProviderName.GOOGLE: {
            const provider = createGoogleGenerativeAI({ apiKey: auth.apiKey })
            return provider(modelId)
        }
        case AIProviderName.AZURE: {
            const azureAuth = auth as AzureProviderAuthConfig
            const azureConfig = providerConfig as AzureProviderConfig
            const provider = createAzure({ resourceName: azureConfig.resourceName, apiKey: azureAuth.apiKey })
            return provider.chat(modelId)
        }
        case AIProviderName.ACTIVEPIECES:
        case AIProviderName.OPENROUTER: {
            const provider = createOpenRouter({ apiKey: auth.apiKey })
            return provider.chat(modelId)
        }
        default:
            throw new Error(`Provider ${providerId} is not supported`)
    }
}
