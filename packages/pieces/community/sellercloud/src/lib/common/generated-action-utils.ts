import { isNil } from '@activepieces/shared';

type QuerySpec = { key: string; name: string; isArray: boolean };
type BodyFieldSpec = { key: string; name: string };

const MODEL_PREFIX = 'model.';
// Every `model.*` operation in the spec exposes this, and SellerCloud needs at least
// one bound `model.*` value or it answers 400 "Arguments 'model' are missing".
const MODEL_FALLBACK = 'model.pageNumber';

// SellerCloud nests most query strings under a `model.` prefix, which is not a legal
// Activepieces prop key, so the generated actions carry the wire name alongside the key.
function buildRequest({ pathTemplate, pathParams, queryParams, bodyFields, bodyMode, propsValue }: BuildRequestParams): BuiltRequest {
    const values = propsValue as Record<string, unknown>;
    const basePath = pathParams.reduce(
        (acc, key) => acc.replace(`{${key}}`, encodeURIComponent(requirePathParam({ key, value: values[key] }))),
        stripApiPrefix({ pathTemplate }),
    );
    const resolved = queryParams
        .map((spec) => ({ spec, values: resolveQueryValues({ value: values[spec.key], spec }) }))
        .filter((entry) => entry.values.length > 0);

    return {
        // `collectionFormat: multi` means arrays repeat the key, which QueryParams
        // (a Record<string, string>) cannot express, so they go straight into the path.
        path: basePath + buildArrayQuery({ resolved }),
        queryParams: Object.fromEntries([
            ...resolved
                .filter((entry) => !entry.spec.isArray)
                .map((entry) => [entry.spec.name, entry.values[0]] as const),
            ...modelFallback({ queryParams, resolved }),
        ]),
        body: buildBody({ bodyFields, bodyMode, values }),
    };
}

// An empty path param would silently collapse the URL (/Companies//Settings) into a 404,
// so fail where the cause is still obvious.
function requirePathParam({ key, value }: { key: string; value: unknown }): string {
    if (isNil(value) || value === '') {
        throw new Error(`SellerCloud: "${key}" is required for this action but was empty.`);
    }
    return stringify({ value });
}


function modelFallback({ queryParams, resolved }: { queryParams: QuerySpec[]; resolved: ResolvedQuery[] }): [string, string][] {
    const hasModelParam = queryParams.some((spec) => spec.name.startsWith(MODEL_PREFIX));
    const boundModelParam = resolved.some((entry) => entry.spec.name.startsWith(MODEL_PREFIX));
    if (!hasModelParam || boundModelParam) {
        return [];
    }
    return [[MODEL_FALLBACK, '1']];
}

function buildArrayQuery({ resolved }: { resolved: ResolvedQuery[] }): string {
    const pairs = resolved
        .filter((entry) => entry.spec.isArray)
        .flatMap((entry) => entry.values.map((value) => `${encodeURIComponent(entry.spec.name)}=${encodeURIComponent(value)}`));
    return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

function buildBody({ bodyFields, bodyMode, values }: { bodyFields: BodyFieldSpec[]; bodyMode: BodyMode; values: Record<string, unknown> }): unknown {
    if (bodyMode === 'json') {
        return values['body'];
    }
    if (bodyMode === 'none') {
        return undefined;
    }
    return Object.fromEntries(
        bodyFields
            .map((spec) => [spec.name, values[spec.key]] as const)
            .filter(([, value]) => !isNil(value) && value !== ''),
    );
}

function resolveQueryValues({ value, spec }: { value: unknown; spec: QuerySpec }): string[] {
    if (isNil(value) || value === '') {
        return [];
    }
    const items = spec.isArray && Array.isArray(value) ? value : [value];
    return items.filter((item) => !isNil(item) && item !== '').map((item) => stringify({ value: item }));
}

function stringify({ value }: { value: unknown }): string {
    return value instanceof Date ? value.toISOString() : String(value);
}

// The client already appends /api to the configured REST endpoint.
function stripApiPrefix({ pathTemplate }: { pathTemplate: string }): string {
    return pathTemplate.replace(/^\/api/, '');
}

export const generatedActionUtils = { buildRequest };

type BodyMode = 'none' | 'fields' | 'json';

type ResolvedQuery = { spec: QuerySpec; values: string[] };

type BuildRequestParams = {
    pathTemplate: string;
    pathParams: string[];
    queryParams: QuerySpec[];
    bodyFields: BodyFieldSpec[];
    bodyMode: BodyMode;
    propsValue: unknown;
};

type BuiltRequest = {
    path: string;
    queryParams: Record<string, string>;
    body: unknown;
};
