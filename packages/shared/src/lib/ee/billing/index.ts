import { z } from 'zod'
import { isNil, Nullable } from '../../core/common'
import { AiCreditsAutoTopUpState, PlanName, PlatformPlanWithOnlyLimits, PlatformUsageMetric, TeamProjectsLimit } from '../../management/platform'
import { PiecesFilterType } from '../../management/project'

export const PRICE_PER_EXTRA_ACTIVE_FLOWS = 5

export type ProjectPlanLimits = {
    nickname?: string
    locked?: boolean
    pieces?: string[]
    aiCredits?: number | null
    piecesFilterType?: PiecesFilterType
}

export enum ApSubscriptionStatus {
    ACTIVE = 'active',
    CANCELED = 'canceled',
}

export const METRIC_TO_LIMIT_MAPPING = {
    [PlatformUsageMetric.ACTIVE_FLOWS]: 'activeFlowsLimit',
} as const

export const METRIC_TO_USAGE_MAPPING = {
    [PlatformUsageMetric.ACTIVE_FLOWS]: 'activeFlows',
} as const

export const UpdateActiveFlowsAddonParamsSchema = z.object({
    newActiveFlowsLimit: z.number(),
})
export type UpdateActiveFlowsAddonParams = z.infer<typeof UpdateActiveFlowsAddonParamsSchema>

export const CreateCheckoutSessionParamsSchema = z.object({
    newActiveFlowsLimit: z.number(),
})
export type CreateSubscriptionParams = z.infer<typeof CreateCheckoutSessionParamsSchema>

export const CreateAICreditCheckoutSessionParamsSchema = z.object({
    aiCredits: z.number(),
})
export type CreateAICreditCheckoutSessionParamsSchema = z.infer<typeof CreateAICreditCheckoutSessionParamsSchema>

export const UpdateAICreditsAutoTopUpParamsSchema = z.union([
    z.object({
        state: z.literal(AiCreditsAutoTopUpState.ENABLED),
        minThreshold: z.number(),
        creditsToAdd: z.number(),
        maxMonthlyLimit: Nullable(z.number()),
    }),
    z.object({
        state: z.literal(AiCreditsAutoTopUpState.DISABLED),
    }),
])
export type UpdateAICreditsAutoTopUpParamsSchema = z.infer<typeof UpdateAICreditsAutoTopUpParamsSchema>

export enum PRICE_NAMES {
    AI_CREDITS = 'ai-credit',
    ACTIVE_FLOWS = 'active-flow',
}

export const PRICE_ID_MAP = {
    [PRICE_NAMES.AI_CREDITS]: {
        dev: 'price_1SfgNxKTWXpWeD7hmDBG4YMZ',
        prod: 'price_1Rnj5bKZ0dZRqLEKQx2gwL7s',
    },
    [PRICE_NAMES.ACTIVE_FLOWS]: {
        dev: 'price_1SQbbYQN93Aoq4f8WK2JC4sf',
        prod: 'price_1SQbcvKZ0dZRqLEKHV5UepRx',
    },
}

export const STANDARD_CLOUD_PLAN: PlatformPlanWithOnlyLimits = {
    plan: 'standard',
    tablesEnabled: true,
    eventStreamingEnabled: true,
    includedAiCredits: 200,
    activeFlowsLimit: 10,
    projectsLimit: 1,
    aiCreditsAutoTopUpState: AiCreditsAutoTopUpState.DISABLED,
    embeddingEnabled: true,
    agentsEnabled: true,
    aiProvidersEnabled: true,
    chatEnabled: true,
    dataManipulationEnabled: true,
    globalConnectionsEnabled: true,
    customRolesEnabled: true,
    environmentsEnabled: true,
    analyticsEnabled: true,
    showPoweredBy: false,
    auditLogEnabled: true,
    managePiecesEnabled: true,
    manageTemplatesEnabled: true,
    customAppearanceEnabled: true,
    teamProjectsLimit: TeamProjectsLimit.ONE,
    projectRolesEnabled: true,
    apiKeysEnabled: true,
    ssoEnabled: true,
    secretManagersEnabled: true,
    scimEnabled: true,
    dedicatedWorkers: null,
    canary: false,
    customDomainsEnabled: true,
}

export const OPEN_SOURCE_PLAN: PlatformPlanWithOnlyLimits = {
    tablesEnabled: true,
    embeddingEnabled: true,
    agentsEnabled: true,
    aiProvidersEnabled: true,
    chatEnabled: true,
    dataManipulationEnabled: true,
    globalConnectionsEnabled: true,
    customRolesEnabled: true,
    includedAiCredits: 0,
    environmentsEnabled: true,
    eventStreamingEnabled: true,
    analyticsEnabled: true,
    showPoweredBy: false,
    auditLogEnabled: true,
    managePiecesEnabled: true,
    manageTemplatesEnabled: true,
    customAppearanceEnabled: true,
    teamProjectsLimit: TeamProjectsLimit.ONE,
    projectRolesEnabled: true,
    apiKeysEnabled: true,
    ssoEnabled: true,
    secretManagersEnabled: true,
    scimEnabled: true,
    stripeCustomerId: undefined,
    stripeSubscriptionId: undefined,
    stripeSubscriptionStatus: undefined,
    aiCreditsAutoTopUpState: AiCreditsAutoTopUpState.DISABLED,
    dedicatedWorkers: null,
    canary: false,
    customDomainsEnabled: true,
}

export const APPSUMO_PLAN = (planName: PlanName): PlatformPlanWithOnlyLimits => ({
    ...STANDARD_CLOUD_PLAN,
    plan: planName,
    eventStreamingEnabled: false,
    activeFlowsLimit: undefined,
})

export const isCloudPlanButNotEnterprise = (plan?: string | null): boolean => {
    if (isNil(plan)) {
        return false
    }

    return plan === PlanName.STANDARD
}
