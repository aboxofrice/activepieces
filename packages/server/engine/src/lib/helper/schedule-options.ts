import { InvalidCronExpressionError } from '@activepieces/shared'
import { isValidCron } from 'cron-validator'

// Newer piece releases (e.g. @activepieces/piece-schedule >= 0.1.20 "Every X Minutes") call
// ctx.setSchedule({ intervalMs }) while still declaring compatibility with this engine, which only
// stores cron schedules. Whole-minute and whole-hour intervals map onto an equivalent cron.
function toCronSchedule(request: ScheduleRequest): CronSchedule {
    const timezone = request.timezone ?? 'UTC'
    if ('intervalMs' in request && typeof request.intervalMs === 'number') {
        return { cronExpression: intervalToCron(request.intervalMs), timezone }
    }
    const cronExpression = 'cronExpression' in request ? request.cronExpression : undefined
    if (typeof cronExpression !== 'string' || !isValidCron(cronExpression)) {
        throw new InvalidCronExpressionError(String(cronExpression))
    }
    return { cronExpression, timezone }
}

function intervalToCron(intervalMs: number): string {
    const minutes = intervalMs / 60_000
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 59) {
        return minutes === 1 ? '* * * * *' : `*/${minutes} * * * *`
    }
    const hours = minutes / 60
    if (Number.isInteger(hours) && hours >= 1 && hours <= 23) {
        return hours === 1 ? '0 * * * *' : `0 */${hours} * * *`
    }
    if (hours === 24) {
        return '0 0 * * *'
    }
    throw new InvalidCronExpressionError(`intervalMs=${intervalMs}`)
}

export const scheduleOptionsUtils = { toCronSchedule }

export type ScheduleRequest =
    | { cronExpression: string, timezone?: string }
    | { intervalMs: number, timezone?: string }

type CronSchedule = {
    cronExpression: string
    timezone: string
}
