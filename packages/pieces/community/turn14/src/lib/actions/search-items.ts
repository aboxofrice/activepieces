import { createAction, Property } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Items } from '../common/items';
import { turn14Props } from '../common/props';

export const searchItems = createAction({
    auth: turn14Auth,
    name: 'search_items',
    displayName: 'Search Items',
    description: 'Find Turn14 catalog items by brand, part number / manufacturer part number, or recent updates. Turn14 has no part-number search, so this reads catalog pages (1,000 items each), keeps only matches and stops as soon as Max Results matches are found - pick a brand to keep it fast.',
    props: {
        brandId: turn14Props.brandDropdown({ required: false, description: 'Strongly recommended: limits the scan to one brand (usually 1-30 pages instead of ~830).' }),
        partNumber: Property.ShortText({
            displayName: 'Part Number',
            description: 'Turn14 part number (e.g. rad20-0262) or manufacturer part number (e.g. 20-0262). Dashes, dots and spaces are ignored.',
            required: false,
        }),
        matchMode: Property.StaticDropdown({
            displayName: 'Part Number Match',
            required: true,
            defaultValue: 'exact',
            options: {
                options: [
                    { label: 'Exact', value: 'exact' },
                    { label: 'Contains', value: 'contains' },
                ],
            },
        }),
        updatedWithinDays: Property.Number({
            displayName: 'Updated Within (days)',
            description: 'Only items Turn14 changed in the last N days (1-15). Leave empty to search the whole catalog.',
            required: false,
        }),
        activeOnly: Property.Checkbox({
            displayName: 'Active Items Only',
            required: false,
            defaultValue: true,
        }),
        maxPages: Property.Number({
            displayName: 'Max Pages to Scan',
            description: 'Each page is 1,000 items (about a third of a second). Capped at 200 pages (200,000 items) per run; the whole catalog is ~830 pages, so an unfiltered search cannot cover it - pick a brand (usually under 30 pages). The output says whether every page was scanned.',
            required: true,
            defaultValue: 30,
        }),
        limit: Property.Number({
            displayName: 'Max Results',
            description: 'The scan stops once this many matches are found.',
            required: true,
            defaultValue: 100,
        }),
    },
    async run(context) {
        const { brandId, partNumber, matchMode, updatedWithinDays, activeOnly, maxPages, limit } = context.propsValue;
        if (updatedWithinDays !== undefined && updatedWithinDays !== null && (updatedWithinDays < 1 || updatedWithinDays > 15)) {
            throw new Error('Updated Within must be between 1 and 15 days (a Turn14 limit).');
        }
        return turn14Items.searchItems({
            auth: turn14AuthProps(context.auth),
            brandId: brandId ? String(brandId) : undefined,
            partNumber: partNumber?.trim() || undefined,
            matchMode: matchMode === 'contains' ? 'contains' : 'exact',
            updatedWithinDays: updatedWithinDays ?? undefined,
            activeOnly: activeOnly !== false,
            maxPages: Math.min(turn14Items.MAX_SEARCH_PAGES, Math.max(1, Math.floor(maxPages ?? 30))),
            limit: Math.max(1, Math.floor(limit ?? 100)),
        });
    },
});
