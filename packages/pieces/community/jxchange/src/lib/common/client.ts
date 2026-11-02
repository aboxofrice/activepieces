import { HttpError, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { XMLParser } from 'fast-xml-parser';

function escapeXml({ value }: { value: string }): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function tag({ name, value }: { name: string, value: string | number | undefined | null }): string {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    return `<${name}>${escapeXml({ value: String(value) })}</${name}>`;
}

function buildJxchangeHdr({ auth }: { auth: JxchangeAuthProps }): string {
    const consumerParts = [auth.validConsmName, auth.validConsmProd].some((v) => v)
        ? '<Ver_3/><Ver_4/><Ver_5/>'
            + tag({ name: 'ValidConsmName', value: auth.validConsmName })
            + tag({ name: 'ValidConsmProd', value: auth.validConsmProd })
        : '';
    return '<jXchangeHdr>'
        + tag({ name: 'AuditUsrId', value: auth.auditUsrId || 'activepieces' })
        + tag({ name: 'AuditWsId', value: auth.auditWsId || 'activepieces' })
        + '<Ver_1/><Ver_2/>'
        + tag({ name: 'InstRtId', value: auth.instRtId })
        + tag({ name: 'InstEnv', value: auth.instEnv })
        + consumerParts
        + '</jXchangeHdr>';
}

function buildMsgRqHdr({ auth }: { auth: JxchangeAuthProps }): string {
    return `<MsgRqHdr>${buildJxchangeHdr({ auth })}</MsgRqHdr>`;
}

function buildSrchMsgRqHdr({ auth, maxRec, cursor }: { auth: JxchangeAuthProps, maxRec: number, cursor?: string }): string {
    return '<SrchMsgRqHdr>'
        + buildJxchangeHdr({ auth })
        + tag({ name: 'MaxRec', value: maxRec })
        + tag({ name: 'Cursor', value: cursor })
        + '</SrchMsgRqHdr>';
}

function buildAccountId({ name, acctId, acctType }: { name: string, acctId: string, acctType: string }): string {
    return `<${name}>${tag({ name: 'AcctId', value: acctId })}${tag({ name: 'AcctType', value: acctType })}</${name}>`;
}

function buildEnvelope({ auth, operation, innerXml }: { auth: JxchangeAuthProps, operation: string, innerXml: string }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" soapenv:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml({ value: auth.username })}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml({ value: auth.password })}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <${operation} xmlns="${JX_NAMESPACE}">${innerXml}</${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseSoapBody({ xml }: { xml: string }): Record<string, unknown> {
    // parseTagValue: false keeps account numbers and routing ids as strings — numeric
    // parsing would strip leading zeros from banking identifiers
    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true,
        parseTagValue: false,
    });
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const envelope = parsed['Envelope'] as Record<string, unknown> | undefined;
    const body = envelope?.['Body'] as Record<string, unknown> | undefined;
    if (!body) {
        throw new Error(`jXchange returned a response that is not a SOAP envelope: ${xml.slice(0, 500)}`);
    }
    return body;
}

function throwIfFault({ body }: { body: Record<string, unknown> }): void {
    const fault = body['Fault'] as Record<string, unknown> | undefined;
    if (!fault) {
        return;
    }
    const reason = fault['faultstring'] ?? (fault['Reason'] as Record<string, unknown> | undefined)?.['Text'] ?? 'Unknown SOAP fault';
    const detail = fault['detail'] ?? fault['Detail'];
    throw new Error(`jXchange fault: ${JSON.stringify(reason)}${detail ? ` — detail: ${JSON.stringify(detail)}` : ''}`);
}

async function call({ auth, service, operation, innerXml, endpointOverride }: {
    auth: JxchangeAuthProps,
    service: JxService,
    operation: string,
    innerXml: string,
    endpointOverride?: string,
}): Promise<Record<string, unknown>> {
    const baseUrl = auth.gatewayUrl.replace(/\/+$/, '');
    const url = endpointOverride || `${baseUrl}/${service}.svc`;
    const envelope = buildEnvelope({ auth, operation, innerXml });

    let responseXml: string;
    try {
        const response = await httpClient.sendRequest<string>({
            method: HttpMethod.POST,
            url,
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                SOAPAction: `${SOAP_ACTION_PREFIX}${operation}`,
            },
            body: envelope,
        });
        responseXml = String(response.body);
    }
    catch (e) {
        // SOAP faults arrive as HTTP 500 with a fault envelope in the body —
        // surface the fault reason instead of a generic HTTP error
        if (e instanceof HttpError && typeof e.response.body === 'string' && e.response.body.includes('Envelope')) {
            const faultBody = parseSoapBody({ xml: e.response.body });
            throwIfFault({ body: faultBody });
        }
        throw e;
    }

    const body = parseSoapBody({ xml: responseXml });
    throwIfFault({ body });
    const operationResponse = body[`${operation}Response`] as Record<string, unknown> | undefined;
    return operationResponse ?? body;
}

function asArray<T>({ value }: { value: T | T[] | undefined | null }): T[] {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

export const jxClient = {
    call,
    tag,
    buildMsgRqHdr,
    buildSrchMsgRqHdr,
    buildAccountId,
    asArray,
};

export const JX_NAMESPACE = 'http://jackhenry.com/jxchange/TPG/2008';

const SOAP_ACTION_PREFIX = 'http://jackhenry.com/ws/';

export const JX_SERVICES = [
    'ACH',
    'BillPay',
    'BrdCst',
    'CrCard',
    'Custom',
    'Customer',
    'Deposit',
    'ENS',
    'IMS',
    'Image',
    'Inquiry',
    'Loan',
    'Report',
    'Teller',
    'Transaction',
    'Wire',
    'Workflow',
] as const;

export type JxService = typeof JX_SERVICES[number];

export type JxchangeAuthProps = {
    gatewayUrl: string,
    username: string,
    password: string,
    instRtId: string,
    instEnv?: string,
    validConsmName?: string,
    validConsmProd?: string,
    auditUsrId?: string,
    auditWsId?: string,
};
