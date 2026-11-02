import { createAction, Property } from '@activepieces/pieces-framework';
import { cufxAuth } from '../auth';
import { CUFX_ENTITIES, CufxOperation, cufxClient } from '../common/client';

const OPERATION_OPTIONS: { label: string, value: CufxOperation }[] = [
    { label: 'Read / Search', value: 'read' },
    { label: 'Create or Update', value: 'createOrUpdate' },
    { label: 'Delete', value: 'delete' },
];

export const sendCufxMessage = createAction({
    auth: cufxAuth,
    name: 'send_cufx_message',
    displayName: 'Send CUFX Message',
    description: 'Call any of the 52 CUFX message endpoints with a raw message payload.',
    props: {
        entity: Property.StaticDropdown({
            displayName: 'Entity',
            description: 'The CUFX message endpoint to call, e.g. Account calls /AccountMessage.',
            required: true,
            options: {
                options: CUFX_ENTITIES.map((entity) => ({
                    label: entity.replace(/([a-z])([A-Z])/g, '$1 $2'),
                    value: entity,
                })),
            },
        }),
        operation: Property.StaticDropdown({
            displayName: 'Operation',
            required: true,
            defaultValue: 'read',
            options: {
                options: OPERATION_OPTIONS,
            },
        }),
        payload: Property.Json({
            displayName: 'Message Payload',
            description: 'The message content without the outer envelope — e.g. `{ "accountFilter": { "accountIdList": { "accountId": ["12345"] } } }`. The messageContext is injected from the connection automatically; include a `messageContext` key here to override individual fields.',
            required: false,
            defaultValue: {},
        }),
    },
    async run(context) {
        const { entity, operation, payload } = context.propsValue;
        if (payload !== undefined && !cufxClient.isRecord(payload)) {
            throw new Error('Message Payload must be a JSON object.');
        }
        return cufxClient.sendMessage({
            auth: context.auth,
            entity,
            operation,
            payload,
        });
    },
});
