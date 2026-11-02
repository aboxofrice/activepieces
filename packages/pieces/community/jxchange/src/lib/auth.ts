import { PieceAuth, Property } from '@activepieces/pieces-framework';

export const jxchangeAuth = PieceAuth.CustomAuth({
    description: `Connect to a Jack Henry jXchange Third Party Gateway (TPG).

1. **Gateway URL** — the base ServiceGateway URL your institution was assigned, e.g. \`https://jxpilot.jackhenry.com/jxchange/2008/ServiceGateway\`. Service endpoints like \`Inquiry.svc\` are appended automatically.
2. **Username / Password** — the WS-Security credentials issued for your third-party consumer product.
3. **Institution Routing ID** — your bank's routing number (InstRtId) as enrolled with jXchange.
4. **Environment** — the target core environment (InstEnv), e.g. \`TEST\` or \`PROD\`, if your gateway requires it.
5. **Consumer Name / Product** — the ValidConsmName / ValidConsmProd values Jack Henry assigned to your integration, if required.`,
    required: true,
    props: {
        gatewayUrl: Property.ShortText({
            displayName: 'Gateway URL',
            description: 'Base TPG ServiceGateway URL, without the trailing service (.svc) segment.',
            required: true,
        }),
        username: Property.ShortText({
            displayName: 'Username',
            description: 'WS-Security username issued by Jack Henry.',
            required: true,
        }),
        password: PieceAuth.SecretText({
            displayName: 'Password',
            description: 'WS-Security password issued by Jack Henry.',
            required: true,
        }),
        instRtId: Property.ShortText({
            displayName: 'Institution Routing ID',
            description: 'The institution routing/transit number (InstRtId) enrolled with jXchange.',
            required: true,
        }),
        instEnv: Property.ShortText({
            displayName: 'Environment (InstEnv)',
            description: 'Target core environment, e.g. TEST or PROD. Leave empty if your gateway does not use it.',
            required: false,
        }),
        validConsmName: Property.ShortText({
            displayName: 'Consumer Name (ValidConsmName)',
            description: 'Consumer name assigned by Jack Henry, if required by your gateway.',
            required: false,
        }),
        validConsmProd: Property.ShortText({
            displayName: 'Consumer Product (ValidConsmProd)',
            description: 'Consumer product assigned by Jack Henry, if required by your gateway.',
            required: false,
        }),
        auditUsrId: Property.ShortText({
            displayName: 'Audit User ID',
            description: 'Value stamped into AuditUsrId on every request. Defaults to "activepieces".',
            required: false,
        }),
        auditWsId: Property.ShortText({
            displayName: 'Audit Workstation ID',
            description: 'Value stamped into AuditWsId on every request. Defaults to "activepieces".',
            required: false,
        }),
    },
});
