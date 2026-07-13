import { createAction, Property } from '@activepieces/pieces-framework';
import { jxchangeAuth } from '../auth';
import { jxClient } from '../common/client';
import { jxProps } from '../common/props';

export const callOperation = createAction({
    auth: jxchangeAuth,
    name: 'call_operation',
    displayName: 'Call jXchange Operation',
    description: 'Call any operation on any TPG service — the escape hatch for the ~600 operations without a dedicated action.',
    props: {
        service: jxProps.serviceDropdown({
            description: 'The TPG service that owns the operation (matches the WSDL name, e.g. Inquiry for AcctSrch).',
        }),
        operation: Property.ShortText({
            displayName: 'Operation',
            description: 'Exact operation name from the WSDL, e.g. StopChkAdd, WireTrnInq, AcctSrch.',
            required: true,
        }),
        headerType: Property.StaticDropdown({
            displayName: 'Request Header',
            description: 'Inquiry/add/mod operations use MsgRqHdr; search operations (…Srch) use SrchMsgRqHdr; Ping uses none.',
            required: true,
            defaultValue: 'MsgRqHdr',
            options: {
                options: [
                    { label: 'Standard (MsgRqHdr)', value: 'MsgRqHdr' },
                    { label: 'Search (SrchMsgRqHdr)', value: 'SrchMsgRqHdr' },
                    { label: 'None', value: 'none' },
                ],
            },
        }),
        maxRecords: Property.Number({
            displayName: 'Max Records',
            description: 'Only used with the Search header.',
            required: false,
            defaultValue: 100,
        }),
        bodyXml: Property.LongText({
            displayName: 'Request Body XML',
            description: 'The operation-specific elements that follow the header, e.g. `<CustId>12345</CustId>`. The envelope, WS-Security header, and jXchangeHdr are added for you.',
            required: false,
        }),
        endpointOverride: Property.ShortText({
            displayName: 'Endpoint Override',
            description: 'Full service URL to use instead of Gateway URL + Service, for gateways with non-standard paths.',
            required: false,
        }),
    },
    async run(context) {
        const { service, operation, headerType, maxRecords, bodyXml, endpointOverride } = context.propsValue;

        let header = '';
        if (headerType === 'MsgRqHdr') {
            header = jxClient.buildMsgRqHdr({ auth: context.auth.props });
        }
        else if (headerType === 'SrchMsgRqHdr') {
            header = jxClient.buildSrchMsgRqHdr({ auth: context.auth.props, maxRec: maxRecords ?? 100 });
        }

        const response = await jxClient.call({
            auth: context.auth.props,
            service,
            operation,
            innerXml: header + (bodyXml ?? ''),
            endpointOverride,
        });
        return response;
    },
});
