import { Store } from '@activepieces/pieces-framework';

export function memoryStore(): MemoryStore {
    const data = new Map<string, unknown>();
    const log: string[] = [];
    return {
        data,
        log,
        async put<T>(key: string, value: T, scope?: string): Promise<T> {
            log.push(`put:${key}`);
            data.set(`${scope ?? 'FLOW'}:${key}`, value);
            return value;
        },
        async get<T>(key: string, scope?: string): Promise<T | null> {
            const value = data.get(`${scope ?? 'FLOW'}:${key}`);
            // A JSON round trip, as the real store does over HTTP.
            return value === undefined ? null : JSON.parse(JSON.stringify(value));
        },
        async delete(key: string, scope?: string): Promise<void> {
            log.push(`delete:${key}`);
            data.delete(`${scope ?? 'FLOW'}:${key}`);
        },
    };
}

export function jsonResponse({ status = 200, body, headers = {} }: { status?: number; body?: unknown; headers?: Record<string, string> }): Response {
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export function requestUrl({ input }: { input: unknown }): string {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.toString();
    }
    if (input instanceof Request) {
        return input.url;
    }
    return '';
}

export type MemoryStore = Store & { data: Map<string, unknown>; log: string[] };
