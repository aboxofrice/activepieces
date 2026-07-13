import { AuthenticationType, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { PiecePropValueSchema } from '@activepieces/pieces-framework';
import { spreadIfDefined } from '@activepieces/shared';
import { cufxAuth } from '../auth';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function camel({ entity }: { entity: CufxEntity }): string {
    return entity.charAt(0).toLowerCase() + entity.slice(1);
}

function buildMessageContext({ auth }: { auth: CufxAuthValue }): Record<string, unknown> {
    return {
        cufxVersion: '5.0.0',
        ...spreadIfDefined('fiId', auth.props?.['fiId']),
        ...spreadIfDefined('vendorId', auth.props?.['vendorId']),
        ...spreadIfDefined('appId', auth.props?.['appId']),
        ...spreadIfDefined('dataSourceId', auth.props?.['dataSourceId']),
    };
}

async function sendMessage({ auth, entity, operation, payload }: {
    auth: CufxAuthValue,
    entity: CufxEntity,
    operation: CufxOperation,
    payload?: Record<string, unknown>,
}): Promise<Record<string, unknown>> {
    const baseUrl = (auth.props?.['baseUrl'] ?? '').replace(/\/+$/, '');
    if (!baseUrl) {
        throw new Error('The CUFX connection is missing the API Base URL.');
    }
    const { messageContext, ...messageBody } = payload ?? {};
    const body = {
        [`${camel({ entity })}Message`]: {
            messageContext: {
                ...buildMessageContext({ auth }),
                ...(isRecord(messageContext) ? messageContext : {}),
            },
            ...messageBody,
        },
    };
    // CUFX REST semantics: POST = read (filter in body), PUT = create/update,
    // and X-HTTP-METHOD-OVERRIDE expresses GET/DELETE where proxies block them
    const response = await httpClient.sendRequest<Record<string, unknown>>({
        method: operation === 'read' ? HttpMethod.POST : HttpMethod.PUT,
        url: `${baseUrl}/${entity}Message`,
        headers: {
            ...(operation === 'read' ? { 'X-HTTP-METHOD-OVERRIDE': 'GET' } : {}),
            ...(operation === 'delete' ? { 'X-HTTP-METHOD-OVERRIDE': 'DELETE' } : {}),
        },
        authentication: {
            type: AuthenticationType.BEARER_TOKEN,
            token: auth.access_token,
        },
        body,
    });
    return isRecord(response.body) ? response.body : {};
}

function asArray<T>({ value }: { value: T | T[] | undefined | null }): T[] {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function unwrapList({ body, entity }: { body: Record<string, unknown>, entity: CufxEntity }): unknown[] {
    const message = body[`${camel({ entity })}Message`];
    if (!isRecord(message)) {
        return [];
    }
    const list = message[`${camel({ entity })}List`];
    if (!isRecord(list)) {
        return [];
    }
    return asArray({ value: list[camel({ entity })] });
}

function valueList({ key, values }: { key: string, values: unknown[] | undefined }): Record<string, string[]> | undefined {
    const cleaned = (values ?? []).map((value) => String(value).trim()).filter((value) => value.length > 0);
    if (cleaned.length === 0) {
        return undefined;
    }
    return { [key]: cleaned };
}

export const cufxClient = {
    sendMessage,
    unwrapList,
    valueList,
    asArray,
    isRecord,
};

export const CUFX_ENTITIES = [
    'AccessProfile',
    'Account',
    'Activity',
    'App',
    'Application',
    'Artifact',
    'Bill',
    'BillPayee',
    'BillPaymentOccurrence',
    'BillPaymentRecurring',
    'Card',
    'Category',
    'Collateral',
    'Configuration',
    'Contact',
    'CredentialGroup',
    'CreditReport',
    'Deposit',
    'DepositFunding',
    'Document',
    'EligibilityRequirement',
    'FeeSchedule',
    'Field',
    'FinancialInstitution',
    'Hold',
    'Investment',
    'InvestmentHolding',
    'Loan',
    'LoanDisbursement',
    'Location',
    'MicroDepositFunding',
    'NetworkNode',
    'Note',
    'OverdraftPriority',
    'Party',
    'PartyAssociation',
    'PermissionList',
    'Preference',
    'ProductOffering',
    'ProductServiceEnrollment',
    'ProductServiceRequest',
    'RegisteredDevice',
    'Relationship',
    'RemoteDeposit',
    'SecureMessage',
    'SimpleValidationRequest',
    'SystemStatus',
    'Transaction',
    'TransferOccurrence',
    'TransferRecurring',
    'User',
    'Wire',
] as const;

export type CufxEntity = typeof CUFX_ENTITIES[number];

export type CufxOperation = 'read' | 'createOrUpdate' | 'delete';

type CufxAuthValue = PiecePropValueSchema<typeof cufxAuth>;
