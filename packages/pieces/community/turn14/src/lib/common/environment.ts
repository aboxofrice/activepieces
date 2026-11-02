import { Property } from '@activepieces/pieces-framework';
import { Turn14AuthProps } from './client';
import { OrderEnvironment } from './quotes';

function orderEnvironmentProperty() {
    return Property.StaticDropdown({
        displayName: 'Order Environment',
        description: 'Sent to Turn14 as data.environment. Keep "testing" while building the flow; "production" places a real, billable order. A connection set to the Testing host always sends "testing".',
        required: true,
        defaultValue: 'testing',
        options: {
            options: [
                { label: 'Testing', value: 'testing' },
                { label: 'Production (real purchase)', value: 'production' },
            ],
        },
    });
}

function resolveEnvironment({ auth, requested }: { auth: Turn14AuthProps; requested: unknown }): OrderEnvironment {
    return auth.environment === 'testing' || requested !== 'production' ? 'testing' : 'production';
}

export const turn14Environment = { orderEnvironmentProperty, resolveEnvironment };
