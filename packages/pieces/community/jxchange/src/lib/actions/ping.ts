import { createAction } from '@activepieces/pieces-framework';
import { jxchangeAuth } from '../auth';
import { jxClient } from '../common/client';
import { jxProps } from '../common/props';

export const ping = createAction({
    auth: jxchangeAuth,
    name: 'ping',
    displayName: 'Ping',
    description: 'Test connectivity and credentials against a jXchange service.',
    props: {
        service: jxProps.serviceDropdown({
            description: 'Every jXchange service exposes a Ping operation — pick the one to test.',
        }),
    },
    async run(context) {
        const response = await jxClient.call({
            auth: context.auth.props,
            service: context.propsValue.service,
            operation: 'Ping',
            innerXml: jxClient.tag({ name: 'PingRq', value: 'activepieces connectivity check' }),
        });
        return response;
    },
});
