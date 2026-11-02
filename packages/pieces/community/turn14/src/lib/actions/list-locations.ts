import { createAction } from '@activepieces/pieces-framework';
import { turn14Auth, turn14AuthProps } from '../auth';
import { turn14Props } from '../common/props';

export const listLocations = createAction({
    auth: turn14Auth,
    name: 'list_locations',
    displayName: 'List Warehouses',
    description: 'List Turn14 warehouse locations and their IDs (the keys used in inventory results).',
    props: {},
    async run(context) {
        const locations = await turn14Props.listLocations({ auth: turn14AuthProps(context.auth) });
        return locations.map((location) => ({
            location_id: location.id,
            name: location.attributes?.Name ?? null,
            street: location.attributes?.Street ?? null,
            city: location.attributes?.City ?? null,
            state: location.attributes?.State ?? null,
            country: location.attributes?.Country ?? null,
            zip_code: location.attributes?.ZipCode ?? null,
        }));
    },
});
