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

// Elements declared as top-level refs in the service dto schema must be
// namespace-qualified; locally named elements must stay unqualified
function dtoTag({ name, value }: { name: string, value: string | number | undefined | null }): string {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    return `<dto:${name}>${escapeXml({ value: String(value) })}</dto:${name}>`;
}

function buildCredentialsXml({ auth }: { auth: SymxAuthProps }): string {
    if (auth.adminPassword) {
        return '<Credentials><AdministrativeCredentials>'
            + tag({ name: 'Password', value: auth.adminPassword })
            + '</AdministrativeCredentials></Credentials>';
    }
    if (auth.userNumber !== undefined && auth.userNumber !== null) {
        return '<Credentials><UserNumberCredentials>'
            + tag({ name: 'UserNumber', value: auth.userNumber })
            + tag({ name: 'Password', value: auth.userPassword })
            + '</UserNumberCredentials></Credentials>';
    }
    throw new Error('The SymXchange connection needs either an administrative password or a user number + password.');
}

function buildDeviceXml({ auth }: { auth: SymxAuthProps }): string {
    return `<DeviceInformation DeviceType="${escapeXml({ value: auth.deviceType })}" DeviceNumber="${escapeXml({ value: String(auth.deviceNumber) })}"/>`;
}

function buildRequestAttributes({ service, messageId }: { service: SymxServiceName, messageId: string }): string {
    const svc = SYMX_SERVICES[service];
    // crud services declare MessageId as a local (unqualified) attribute; the
    // noncrud dto schemas reference the global symxcommon attribute instead
    if (svc.style === 'crud') {
        return `MessageId="${escapeXml({ value: messageId })}"`
            + ` xmlns:cmn="${SYMX_COMMON_NS}"`
            + ` xmlns:retrieve="${svc.namespace}/dto/retrieve"`
            + ` xmlns:update="${svc.namespace}/dto/update"`;
    }
    return `cmn:MessageId="${escapeXml({ value: messageId })}"`
        + ` xmlns:cmn="${SYMX_COMMON_NS}"`
        + ` xmlns:dto="${svc.namespace}/dto"`;
}

function buildEnvelope({ service, operation, innerXml, messageId }: {
    service: SymxServiceName,
    operation: string,
    innerXml: string,
    messageId: string,
}): string {
    const svc = SYMX_SERVICES[service];
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <sym:${operation} xmlns:sym="${svc.namespace}">
      <Request ${buildRequestAttributes({ service, messageId })}>${innerXml}</Request>
    </sym:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseSoapBody({ xml }: { xml: string }): Record<string, unknown> {
    // parseTagValue: false keeps account numbers and ids as strings — numeric
    // parsing would strip the leading zeros Symitar account numbers carry
    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true,
        parseTagValue: false,
    });
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const envelope = parsed['Envelope'] as Record<string, unknown> | undefined;
    const body = envelope?.['Body'] as Record<string, unknown> | undefined;
    if (!body) {
        throw new Error(`SymXchange returned a response that is not a SOAP envelope: ${xml.slice(0, 500)}`);
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
    throw new Error(`SymXchange fault: ${JSON.stringify(reason)}${detail ? ` — detail: ${JSON.stringify(detail)}` : ''}`);
}

async function call({ auth, service, operation, innerXml, endpointOverride }: {
    auth: SymxAuthProps,
    service: SymxServiceName,
    operation: string,
    innerXml: string,
    endpointOverride?: string,
}): Promise<Record<string, unknown>> {
    const svc = SYMX_SERVICES[service];
    const baseUrl = auth.baseUrl.replace(/\/+$/, '');
    const url = endpointOverride || `${baseUrl}/${svc.path}`;
    const messageId = Date.now().toString();
    const envelope = buildEnvelope({ service, operation, innerXml, messageId });

    let responseXml: string;
    try {
        const response = await httpClient.sendRequest<string>({
            method: HttpMethod.POST,
            url,
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                SOAPAction: `"${svc.namespace}/${operation}"`,
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

// Response payloads sit inside a wrapper whose name varies by operation shape:
// SingleResponse (single-record lookups), PluralResponse (multi-record lookups),
// Response (transactions)
function unwrapResponse({ response }: { response: Record<string, unknown> }): Record<string, unknown> {
    const wrapper = response['SingleResponse'] ?? response['PluralResponse'] ?? response['Response'];
    if (typeof wrapper === 'object' && wrapper !== null && !Array.isArray(wrapper)) {
        return wrapper as Record<string, unknown>;
    }
    return response;
}

function asArray<T>({ value }: { value: T | T[] | undefined | null }): T[] {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

export const symxClient = {
    call,
    tag,
    dtoTag,
    buildCredentialsXml,
    buildDeviceXml,
    unwrapResponse,
    asArray,
};

const SYMX_COMMON_NS = 'http://www.symxchange.generated.symitar.com/symxcommon';

const SYMX_NS_BASE = 'http://www.symxchange.generated.symitar.com';

export const SYMX_SERVICES = {
    account: { path: 'account', namespace: `${SYMX_NS_BASE}/crud/account`, style: 'crud' },
    collateral: { path: 'collateral', namespace: `${SYMX_NS_BASE}/crud/collateral`, style: 'crud' },
    dealer: { path: 'dealer', namespace: `${SYMX_NS_BASE}/crud/dealer`, style: 'crud' },
    findby: { path: 'findby', namespace: `${SYMX_NS_BASE}/noncrud/findby`, style: 'noncrud' },
    generalledger: { path: 'generalledger', namespace: `${SYMX_NS_BASE}/crud/generalledger`, style: 'crud' },
    information: { path: 'information', namespace: `${SYMX_NS_BASE}/noncrud/information`, style: 'noncrud' },
    payee: { path: 'payee', namespace: `${SYMX_NS_BASE}/crud/payee`, style: 'crud' },
    transactions: { path: 'transactions', namespace: `${SYMX_NS_BASE}/noncrud/transactions`, style: 'noncrud' },
    user: { path: 'user', namespace: `${SYMX_NS_BASE}/crud/user`, style: 'crud' },
} as const;

export type SymxServiceName = keyof typeof SYMX_SERVICES;

export type SymxAuthProps = {
    baseUrl: string,
    deviceType: string,
    deviceNumber: number,
    adminPassword?: string,
    userNumber?: number,
    userPassword?: string,
};
