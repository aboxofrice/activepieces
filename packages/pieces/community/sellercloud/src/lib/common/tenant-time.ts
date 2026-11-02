// SellerCloud stores and returns timestamps as tenant wall-clock time with no zone marker
// (e.g. "2026-11-01T20:04:22.02" means 20:04 Eastern), but its list filters accept a UTC
// instant with a trailing Z. Writes such as a ship date are read as tenant-local time.

function toFilterValue({ date }: { date: Date }): string {
    return `${date.toISOString().slice(0, 19)}Z`;
}

function toTenantLocal({ date }: { date: Date }): string {
    const parts = wallClockParts({ instantMs: date.getTime() });
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

// A user-entered date for a write. A bare date ("2026-11-01") means that day in the
// tenant's zone; parsing it as UTC midnight would land on the previous evening Eastern.
// A date-time without a zone is likewise taken as tenant wall-clock time, and one with a
// zone is converted. Returns null when the value is not a date.
function userInputToTenantLocal({ value }: { value: string }): string | null {
    const trimmed = value.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnly) {
        return isRealDate({ year: Number(dateOnly[1]), month: Number(dateOnly[2]), day: Number(dateOnly[3]) }) ? `${trimmed}T00:00:00` : null;
    }
    const zoneless = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(trimmed);
    if (zoneless) {
        if (!isRealDate({ year: Number(zoneless[1]), month: Number(zoneless[2]), day: Number(zoneless[3]) }) || Number(zoneless[4]) > 23 || Number(zoneless[5]) > 59) {
            return null;
        }
        return `${zoneless[1]}-${zoneless[2]}-${zoneless[3]}T${zoneless[4]}:${zoneless[5]}:${zoneless[6] ?? '00'}`;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : toTenantLocal({ date: new Date(parsed) });
}

function isRealDate({ year, month, day }: { year: number; month: number; day: number }): boolean {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Interprets a zone-less SellerCloud timestamp as tenant time and returns the UTC instant.
function tenantLocalToUtc({ value }: { value: string | null | undefined }): string | null {
    if (!value) {
        return null;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(value);
    if (!match) {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
    }
    const millis = match[7] ? Math.round(Number(match[7]) * 1000) : 0;
    const asIfUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]), millis);
    const firstGuess = asIfUtc - offsetMs({ instantMs: asIfUtc });
    const refined = asIfUtc - offsetMs({ instantMs: firstGuess });
    return new Date(refined).toISOString();
}

function offsetMs({ instantMs }: { instantMs: number }): number {
    const parts = wallClockParts({ instantMs });
    const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

function wallClockParts({ instantMs }: { instantMs: number }): WallClock {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TENANT_TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(instantMs));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

const TENANT_TIME_ZONE = 'America/New_York';

export const tenantTime = {
    toFilterValue,
    toTenantLocal,
    tenantLocalToUtc,
    userInputToTenantLocal,
};

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };
