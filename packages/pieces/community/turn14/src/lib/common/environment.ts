import { Property } from '@activepieces/pieces-framework';
import { Turn14AuthProps, turn14Client } from './client';

function orderEnvironmentProperty() {
    return Property.StaticDropdown({
        displayName: 'Order Environment',
        description: `Sent to Turn14 as data.environment. "${TESTING_LABEL}" is only accepted on a connection whose Environment setting is "${TESTING_HOST_LABEL}" - Turn14 does not document a test mode on the production host, so a "testing" request there could still be real. On a Production connection choose "${PRODUCTION_LABEL}".`,
        required: true,
        defaultValue: 'testing',
        options: {
            options: [
                { label: TESTING_LABEL, value: 'testing' },
                { label: PRODUCTION_LABEL, value: 'production' },
            ],
        },
    });
}

function confirmLiveOrderProperty() {
    return Property.Checkbox({
        displayName: CONFIRM_LIVE_LABEL,
        description: `Required when Order Environment is "${PRODUCTION_LABEL}". Without it the order is refused before anything is sent to Turn14.`,
        required: false,
        defaultValue: false,
    });
}

// Only the apitest host is known to be a sandbox. The data.environment flag on the production host
// comes from an unofficial example, so it is never relied on to keep an order from being real.
function resolveOrderEnvironment({ auth, requested, confirmLiveOrder, requireLiveConfirmation }: ResolveParams): OrderEnvironment {
    const environment: OrderEnvironment = requested === 'production' ? 'production' : 'testing';
    const testingHost = turn14Client.isTestingHost({ auth });
    if (testingHost && environment === 'production') {
        throw new Error(`Order Environment is "${PRODUCTION_LABEL}" but this connection's Environment setting is "${TESTING_HOST_LABEL}". Live orders need a connection set to "${PRODUCTION_HOST_LABEL}".`);
    }
    if (!testingHost && environment === 'testing') {
        throw new Error(`Order Environment "${TESTING_LABEL}" is only allowed on a connection whose Environment setting is "${TESTING_HOST_LABEL}". This connection uses "${PRODUCTION_HOST_LABEL}", where Turn14 does not document a test mode, so nothing was sent. Either switch to a Testing connection, or set Order Environment to "${PRODUCTION_LABEL}" and tick "${CONFIRM_LIVE_LABEL}".`);
    }
    if (environment === 'production' && requireLiveConfirmation && confirmLiveOrder !== true) {
        throw new Error(`Order Environment is "${PRODUCTION_LABEL}" but "${CONFIRM_LIVE_LABEL}" is not ticked, so nothing was sent to Turn14.`);
    }
    return environment;
}

// If Turn14 echoes an environment or a test flag, it has to agree with what was requested.
function echoedEnvironmentMismatches({ response, expected }: { response: unknown; expected: OrderEnvironment }): string[] {
    const root = turn14Client.isRecord(response) ? response : {};
    const data = turn14Client.isRecord(root['data']) ? root['data'] : {};
    const attributes = turn14Client.isRecord(data['attributes']) ? data['attributes'] : {};
    const meta = turn14Client.isRecord(root['meta']) ? root['meta'] : {};
    const sources: [string, Record<string, unknown>][] = [['', root], ['data.', data], ['data.attributes.', attributes], ['meta.', meta]];
    return sources.flatMap(([prefix, source]) => {
        const environment = source['environment'];
        const environmentMismatch = typeof environment === 'string' && environment.trim().toLowerCase() !== expected
            ? [`${prefix}environment is "${environment}"`]
            : [];
        const flagMismatches = TEST_FLAGS.filter((flag) => typeof source[flag] === 'boolean' && source[flag] !== (expected === 'testing'))
            .map((flag) => `${prefix}${flag} is ${String(source[flag])}`);
        return [...environmentMismatch, ...flagMismatches];
    });
}

function assertEchoedEnvironment({ response, expected, what }: { response: unknown; expected: OrderEnvironment; what: string }): void {
    const mismatches = echoedEnvironmentMismatches({ response, expected });
    if (mismatches.length > 0) {
        throw new Error(`Turn14 answered the ${what} with ${mismatches.join(', ')}, but "${expected}" was requested. Check the ${what} in Turn14 before doing anything else.`);
    }
}

const TESTING_LABEL = 'Testing';
const PRODUCTION_LABEL = 'Production (real purchase)';
const TESTING_HOST_LABEL = 'Testing (apitest.turn14.com)';
const PRODUCTION_HOST_LABEL = 'Production (api.turn14.com)';
const CONFIRM_LIVE_LABEL = 'I understand this places a real, billable order';
const TEST_FLAGS = ['test', 'is_test', 'test_order', 'testing'];

export const turn14Environment = {
    orderEnvironmentProperty,
    confirmLiveOrderProperty,
    resolveOrderEnvironment,
    echoedEnvironmentMismatches,
    assertEchoedEnvironment,
};

export type OrderEnvironment = 'testing' | 'production';

type ResolveParams = {
    auth: Turn14AuthProps;
    requested: unknown;
    confirmLiveOrder?: boolean;
    requireLiveConfirmation: boolean;
};
