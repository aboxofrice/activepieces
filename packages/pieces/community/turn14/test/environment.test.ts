import { describe, expect, it } from 'vitest';
import { turn14Environment } from '../src/lib/common/environment';

const prodAuth = { clientId: 'id', clientSecret: 'secret', environment: 'production' };
const testAuth = { clientId: 'id', clientSecret: 'secret', environment: 'testing' };

describe('turn14Environment.resolveOrderEnvironment', () => {
    it('allows testing orders on a Testing (apitest) connection', () => {
        expect(turn14Environment.resolveOrderEnvironment({ auth: testAuth, requested: 'testing', requireLiveConfirmation: true })).toBe('testing');
    });

    it('refuses testing orders on a Production connection and names the setting', () => {
        expect(() => turn14Environment.resolveOrderEnvironment({ auth: prodAuth, requested: 'testing', requireLiveConfirmation: true }))
            .toThrow(/only allowed on a connection whose Environment setting is "Testing \(apitest\.turn14\.com\)"/);
    });

    it('treats a missing order environment as testing, which a Production connection refuses', () => {
        expect(() => turn14Environment.resolveOrderEnvironment({ auth: prodAuth, requested: undefined, requireLiveConfirmation: true })).toThrow(/Testing/);
    });

    it('refuses production orders on a Testing connection', () => {
        expect(() => turn14Environment.resolveOrderEnvironment({ auth: testAuth, requested: 'production', confirmLiveOrder: true, requireLiveConfirmation: true }))
            .toThrow(/Live orders need a connection set to "Production \(api\.turn14\.com\)"/);
    });

    it('requires the live-order confirmation for production orders', () => {
        expect(() => turn14Environment.resolveOrderEnvironment({ auth: prodAuth, requested: 'production', confirmLiveOrder: false, requireLiveConfirmation: true }))
            .toThrow(/I understand this places a real, billable order/);
        expect(turn14Environment.resolveOrderEnvironment({ auth: prodAuth, requested: 'production', confirmLiveOrder: true, requireLiveConfirmation: true })).toBe('production');
    });

    it('does not ask a production quote for the live-order confirmation', () => {
        expect(turn14Environment.resolveOrderEnvironment({ auth: prodAuth, requested: 'production', requireLiveConfirmation: false })).toBe('production');
    });
});

describe('turn14Environment.echoedEnvironmentMismatches', () => {
    it('accepts a response that echoes nothing or the same environment', () => {
        expect(turn14Environment.echoedEnvironmentMismatches({ response: { data: { id: '1' } }, expected: 'production' })).toEqual([]);
        expect(turn14Environment.echoedEnvironmentMismatches({ response: { data: { id: '1', attributes: { environment: 'Testing' } } }, expected: 'testing' })).toEqual([]);
        expect(turn14Environment.echoedEnvironmentMismatches({ response: null, expected: 'testing' })).toEqual([]);
    });

    it('reports an echoed environment or test flag that disagrees', () => {
        expect(turn14Environment.echoedEnvironmentMismatches({ response: { data: { attributes: { environment: 'production' } } }, expected: 'testing' }))
            .toEqual(['data.attributes.environment is "production"']);
        expect(turn14Environment.echoedEnvironmentMismatches({ response: { meta: { test: true } }, expected: 'production' }))
            .toEqual(['meta.test is true']);
        expect(() => turn14Environment.assertEchoedEnvironment({ response: { data: { environment: 'testing' } }, expected: 'production', what: 'order' }))
            .toThrow(/data\.environment is "testing"/);
    });
});
