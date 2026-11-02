import { SeenEntry } from './poller';

// Watching a warehouse only asks SellerCloud for products at or below the threshold, so a
// product that recovers never shows up again and its "low" state would block the next
// drop for the whole retention period. Re-read the products remembered as low that this
// poll did not return, least recently checked first and a bounded number per poll, so a
// recovery is recorded and the next drop fires.
function skusToRecheck({ seen, returned, warehouseId }: { seen: Readonly<Record<string, SeenEntry>>; returned: Set<string>; warehouseId: number }): string[] {
    const suffix = `|${warehouseId}`;
    return Object.entries(seen)
        .filter(([key, entry]) => entry[0] === 'low' && key.endsWith(suffix) && !returned.has(key))
        .sort((a, b) => a[1][1] - b[1][1])
        .slice(0, MAX_RECHECK_PER_POLL)
        .map(([key]) => key.slice(0, -suffix.length));
}

// One /Inventory call per 50 SKUs, so this is at most four extra calls per poll.
const MAX_RECHECK_PER_POLL = 200;

export const lowStock = { skusToRecheck, MAX_RECHECK_PER_POLL };
