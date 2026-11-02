import { InvalidCronExpressionError } from '@activepieces/shared'
import { scheduleOptionsUtils } from '../../src/lib/helper/schedule-options'

describe('scheduleOptionsUtils.toCronSchedule', () => {
    it('keeps a valid cron expression and defaults the timezone to UTC', () => {
        expect(scheduleOptionsUtils.toCronSchedule({ cronExpression: '*/10 * * * *' })).toEqual({ cronExpression: '*/10 * * * *', timezone: 'UTC' })
        expect(scheduleOptionsUtils.toCronSchedule({ cronExpression: '0 8 * * *', timezone: 'America/New_York' })).toEqual({ cronExpression: '0 8 * * *', timezone: 'America/New_York' })
    })

    it('maps intervalMs (piece-schedule >= 0.1.20 Every X Minutes) to cron', () => {
        expect(scheduleOptionsUtils.toCronSchedule({ intervalMs: 5 * 60_000 })).toEqual({ cronExpression: '*/5 * * * *', timezone: 'UTC' })
        expect(scheduleOptionsUtils.toCronSchedule({ intervalMs: 60_000 }).cronExpression).toBe('* * * * *')
        expect(scheduleOptionsUtils.toCronSchedule({ intervalMs: 60 * 60_000 }).cronExpression).toBe('0 * * * *')
        expect(scheduleOptionsUtils.toCronSchedule({ intervalMs: 3 * 60 * 60_000 }).cronExpression).toBe('0 */3 * * *')
    })

    it('rejects invalid input', () => {
        expect(() => scheduleOptionsUtils.toCronSchedule({ cronExpression: 'not a cron' })).toThrow(InvalidCronExpressionError)
        expect(() => scheduleOptionsUtils.toCronSchedule({ intervalMs: 90_000 })).toThrow(InvalidCronExpressionError)
    })
})
