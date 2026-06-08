import { ActionBase, PieceMetadataModel, PiecePropertyMap, TriggerBase } from '@activepieces/pieces-framework'
import {
    AIAssistantMessage,
    flowStructureUtil,
    FlowVersionState,
    isNil,
    PlatformId,
    ProjectId,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { flowService } from '../flows/flow/flow.service'
import { pieceMetadataService } from '../pieces/metadata/piece-metadata-service'

const CATALOG_TTL_MS = 5 * 60 * 1000
const MAX_CATALOG_PIECES = 500
const MAX_MENTIONED_PIECES = 6
const MAX_PROJECT_FLOWS = 30

type CatalogCacheEntry = {
    catalog: string
    pieceNames: string[]
    expires: number
}

const catalogCache = new Map<string, CatalogCacheEntry>()

type BuildContextParams = {
    platformId: PlatformId
    projectId: ProjectId
    messages: AIAssistantMessage[]
}

/**
 * Builds the dynamic context block that is appended to the AI assistant system
 * prompt. It tells the model:
 *  1. <available-pieces>        - a compact catalog of every installed piece
 *  2. <mentioned-piece-details> - full action/trigger props for @-mentioned pieces
 *  3. <project-flows>           - a structural summary of every flow in the project
 */
export async function buildAssistantContext(
    log: FastifyBaseLogger,
    { platformId, projectId, messages }: BuildContextParams,
): Promise<string> {
    const { catalog, pieceNames } = await getPieceCatalog(log, platformId, projectId)

    const mentioned = extractMentionedPieces(messages, pieceNames)
    const mentionedDetails = await renderMentionedPieceDetails(log, platformId, projectId, mentioned)

    const projectFlows = await renderProjectFlows(log, projectId)

    return [catalog, mentionedDetails, projectFlows].filter((s) => s.length > 0).join('\n\n')
}

async function getPieceCatalog(
    log: FastifyBaseLogger,
    platformId: PlatformId,
    projectId: ProjectId,
): Promise<{ catalog: string, pieceNames: string[] }> {
    const cacheKey = `${platformId}:${projectId}`
    const cached = catalogCache.get(cacheKey)
    if (!isNil(cached) && cached.expires > Date.now()) {
        return { catalog: cached.catalog, pieceNames: cached.pieceNames }
    }

    // Filtered list (respects platform/project allow-lists) for names + versions.
    const summaries = await pieceMetadataService(log).list({
        includeHidden: false,
        platformId,
        projectId,
    })

    const truncated = summaries.length > MAX_CATALOG_PIECES
    const visible = truncated ? summaries.slice(0, MAX_CATALOG_PIECES) : summaries

    // Fetch full metadata (actions/triggers) for each visible piece.
    const fullMetadataList = await Promise.all(
        visible.map((s) => pieceMetadataService(log).get({ name: s.name, platformId, projectId })),
    )

    const lines: string[] = []
    const pieceNames: string[] = []
    for (let i = 0; i < visible.length; i++) {
        const summary = visible[i]
        pieceNames.push(summary.name)
        const meta = fullMetadataList[i]
        const triggerNames = meta ? renderMemberList(meta.triggers) : ''
        const actionNames = meta ? renderMemberList(meta.actions) : ''
        const description = (summary.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)

        lines.push(`- ${summary.name} (${summary.displayName}) v${summary.version}${description ? ` — ${description}` : ''}`)
        if (triggerNames.length > 0) {
            lines.push(`    triggers: ${triggerNames}`)
        }
        if (actionNames.length > 0) {
            lines.push(`    actions: ${actionNames}`)
        }
    }

    if (truncated) {
        log.warn({ total: summaries.length, shown: MAX_CATALOG_PIECES }, 'AI Assistant piece catalog truncated')
        lines.push(`- ...and ${summaries.length - MAX_CATALOG_PIECES} more pieces not shown (catalog truncated).`)
    }

    const catalog = `<available-pieces>\nUse the EXACT name and version below when building flows.\n${lines.join('\n')}\n</available-pieces>`

    catalogCache.set(cacheKey, {
        catalog,
        pieceNames,
        expires: Date.now() + CATALOG_TTL_MS,
    })

    return { catalog, pieceNames }
}

function renderMemberList(members: Record<string, ActionBase | TriggerBase>): string {
    return Object.entries(members)
        .map(([name, member]) => `${name} (${member.displayName})`)
        .join(', ')
}

function extractMentionedPieces(messages: AIAssistantMessage[], pieceNames: string[]): string[] {
    // Only look at user-authored text to decide which pieces to expand.
    const userText = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n')

    const mentioned: string[] = []
    for (const name of pieceNames) {
        if (userText.includes(name) && !mentioned.includes(name)) {
            mentioned.push(name)
        }
    }
    return mentioned.slice(0, MAX_MENTIONED_PIECES)
}

async function renderMentionedPieceDetails(
    log: FastifyBaseLogger,
    platformId: PlatformId,
    projectId: ProjectId,
    pieceNames: string[],
): Promise<string> {
    if (pieceNames.length === 0) {
        return ''
    }

    const blocks: string[] = []
    for (const name of pieceNames) {
        const meta = await pieceMetadataService(log).get({ name, platformId, projectId })
        if (isNil(meta)) {
            continue
        }
        blocks.push(renderPieceDetail(meta))
    }

    if (blocks.length === 0) {
        return ''
    }

    return `<mentioned-piece-details>\nFull capabilities of the pieces the user referenced:\n${blocks.join('\n')}\n</mentioned-piece-details>`
}

function renderPieceDetail(meta: PieceMetadataModel): string {
    const lines: string[] = []
    const description = (meta.description ?? '').replace(/\s+/g, ' ').trim()
    lines.push(`# ${meta.name} (${meta.displayName}) v${meta.version}`)
    if (description.length > 0) {
        lines.push(`  ${description}`)
    }

    for (const [name, trigger] of Object.entries(meta.triggers)) {
        lines.push(`  trigger ${name} (${trigger.displayName}): ${oneLine(trigger.description)}`)
        lines.push(...renderProps(trigger.props))
    }
    for (const [name, action] of Object.entries(meta.actions)) {
        lines.push(`  action ${name} (${action.displayName}): ${oneLine(action.description)}`)
        lines.push(...renderProps(action.props))
    }
    return lines.join('\n')
}

function renderProps(props: PiecePropertyMap): string[] {
    return Object.entries(props).map(([propName, prop]) => {
        const required = prop.required ? 'required' : 'optional'
        return `      - ${propName} (${prop.displayName}) [${prop.type}] ${required}`
    })
}

async function renderProjectFlows(log: FastifyBaseLogger, projectId: ProjectId): Promise<string> {
    const page = await flowService(log).list({
        projectIds: [projectId],
        versionState: FlowVersionState.DRAFT,
        limit: MAX_PROJECT_FLOWS,
        includeTriggerSource: false,
    })

    if (page.data.length === 0) {
        return ''
    }

    const blocks = page.data.map((flow) => {
        const version = flow.version
        const steps = flowStructureUtil.getAllSteps(version.trigger)
        const stepLines = steps.map((step) => {
            const settings = step.settings as { pieceName?: string, actionName?: string, triggerName?: string } | undefined
            const op = settings?.actionName ?? settings?.triggerName
            const piece = settings?.pieceName ? `${settings.pieceName}${op ? `:${op}` : ''}` : step.type
            return `    - ${step.name} "${step.displayName}" (${piece})`
        })
        return `Flow "${version.displayName}" [status: ${flow.status}]:\n${stepLines.join('\n')}`
    })

    return `<project-flows>\nExisting flows in this project (draft versions). Reference these when the user asks about what a flow does:\n${blocks.join('\n')}\n</project-flows>`
}

function oneLine(value: string | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim()
}
