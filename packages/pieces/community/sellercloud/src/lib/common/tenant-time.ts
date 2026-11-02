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
};

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };
