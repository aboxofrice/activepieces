---
name: building-custom-pieces
description: Authoritative guide for building, debugging, and publishing custom ActivePieces pieces. Covers the required `createCustomApiCallAction`, action naming conventions, the correct `package.json` structure (commonjs + tslib + exports), common install/build errors (500 "code" error, version mismatches, import paths), nx build workflow, and curl-based install testing. Use when the user is creating a new custom piece, debugging a piece that won't install or build, fixing package.json for a piece, or troubleshooting ActivePieces piece errors like "No matching version found" or "Cannot read properties of undefined (reading 'code')".
---

# Building Custom Pieces for ActivePieces

This skill is the canonical reference for authoring custom pieces in the ActivePieces monorepo. Apply it whenever you scaffold a new piece, modify an existing one, or debug install/build failures.

## When to use this skill

- User asks to create/scaffold a new custom piece under `packages/pieces/custom/`
- User is debugging a piece that fails to install (500 errors, version errors)
- User is fixing `package.json` for a piece
- User is writing or reviewing actions, auth, or imports in a custom piece
- User mentions errors like "No matching version found", "Cannot read properties of undefined (reading 'code')", "Cannot find module '@activepieces/pieces-framework'"

## Standard requirements for every custom piece

### 1. Custom API Call action (REQUIRED)

Every custom piece MUST include `createCustomApiCallAction` so users can hit any endpoint not covered by specific actions.

```typescript
import { createCustomApiCallAction } from '@activepieces/pieces-common';

export const yourPiece = createPiece({
  displayName: 'Your Piece',
  auth: yourAuth,
  actions: [
    // ... your specific actions
    createCustomApiCallAction({
      baseUrl: (auth) => (auth as any).baseUrl || 'https://api.example.com',
      auth: yourAuth,
      authMapping: async (auth) => ({
        Authorization: `Bearer ${(auth as any).apiKey}`,
      }),
    }),
  ],
});
```

**Auth variants:**

Bearer token (SecretText auth):
```typescript
createCustomApiCallAction({
  baseUrl: () => 'https://api.example.com',
  auth: yourAuth,
  authMapping: async (auth) => ({
    Authorization: `Bearer ${auth}`,
  }),
})
```

Custom headers (e.g. Fiserv EFXHeader):
```typescript
createCustomApiCallAction({
  baseUrl: (auth) => (auth as any).baseUrl,
  auth: yourAuth,
  authMapping: async (auth) => ({
    'EFXHeader': JSON.stringify({
      OrganizationId: (auth as any).organizationId,
      TrnId: crypto.randomUUID(),
    }),
  }),
})
```

Optional/conditional auth:
```typescript
createCustomApiCallAction({
  baseUrl: (auth) => (auth as any).baseUrl || 'https://api.example.com',
  auth: yourAuth,
  authMapping: async (auth) => {
    const apiKey = (auth as any).apiKey;
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  },
})
```

### 2. Action naming convention: `{Resource} - {Operation}`

- `name`: `{resource}_{operation}` (snake_case)
- `displayName`: `{Resource} - {Operation}` (Title Case, dash separator)

Examples: `Loan - Create`, `Loan - Retrieve`, `Document - List`, `Loan - Manage Field Locks`.

```typescript
export const createLoan = createAction({
  name: 'loan_create',
  displayName: 'Loan - Create',
  description: 'Create a new loan in Encompass',
  // ...
});
```

This groups related actions in the UI and keeps the UX consistent.

## Critical: correct `package.json` structure

Getting this wrong produces the 500 error `Cannot read properties of undefined (reading 'code')` on install.

### ❌ Incorrect (causes 500 on install)

```json
{
  "name": "@yourscope/piece-name",
  "version": "0.0.1",
  "license": "MIT",
  "main": "src/index.ts",
  "peerDependencies": {
    "@activepieces/pieces-framework": "*",
    "@activepieces/pieces-common": "*",
    "@activepieces/shared": "*"
  },
  "dependencies": {}
}
```

### ✅ Correct

```json
{
  "name": "@yourscope/piece-name",
  "version": "0.0.1",
  "license": "MIT",
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "exports": {
    ".": "./src/index.js"
  },
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {
    "tslib": "^2.3.0"
  },
  "peerDependencies": {
    "@activepieces/pieces-framework": "*",
    "@activepieces/pieces-common": "*",
    "@activepieces/shared": "*"
  }
}
```

### Required fields

| Field | Why |
|-------|-----|
| `"type": "commonjs"` | Tells Node to use CommonJS modules |
| `"main": "./src/index.js"` | Entry point — MUST be `.js`, not `.ts` |
| `"types": "./src/index.d.ts"` | TypeScript type definitions |
| `"exports"` | Module export mapping |
| `"tslib": "^2.3.0"` in dependencies | Runtime dependency for compiled TypeScript |
| `"publishConfig.access": "public"` | Required for scoped packages (`@yourscope/`) |
| `peerDependencies` with `"*"` | Use wildcards, NOT pinned versions |

## Root cause: version mismatch

The ActivePieces **platform version** (e.g. `0.74.3`) is NOT the same as the **npm package versions** for `@activepieces/pieces-framework` / `@activepieces/shared` (which sit around `0.20.x`–`0.22.x`).

Using `^0.74.3` in dependencies fails with:
```
No matching version found for @activepieces/pieces-framework@^0.74.3
```

**Always use `peerDependencies` with `"*"` wildcards.**

## Imports: no file extensions, correct packages

- Import `httpClient` from `@activepieces/pieces-common`, NOT `pieces-framework`
- Never include `.js` or `.ts` extensions on relative imports

```typescript
// ❌ WRONG
import { httpClient } from '@activepieces/pieces-framework';
import { myAction } from './lib/actions/my-action.js';
import { myAction } from './lib/actions/my-action.ts';

// ✅ CORRECT
import { httpClient } from '@activepieces/pieces-common';
import { myAction } from './lib/actions/my-action';
```

## Auth property access (CustomAuth)

TypeScript needs an explicit cast to read custom auth fields:

```typescript
const auth = context.auth as any;
const baseUrl = auth.baseUrl;
const organizationId = auth.organizationId;
```

## Building with Nx

ActivePieces installs **compiled JavaScript**, not TypeScript source.

```bash
# Build
bunx nx build pieces-your-piece

# Output lands in: dist/packages/pieces/custom/your-piece/
#   src/index.js
#   src/index.d.ts
#   src/lib/actions/*.js
#   package.json (copied)
#   README.md, logos, etc.

cd dist/packages/pieces/custom/your-piece
ls -la src/     # verify .js / .d.ts / .js.map are present
npm publish --access public
```

## Testing a piece install

```bash
curl -X POST http://localhost/api/v1/pieces \
  -H "Content-Type: application/json" \
  -d '{
    "packageType": "REGISTRY",
    "pieceName": "@yourscope/piece-name",
    "pieceVersion": "0.0.1"
  }'
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `No matching version found` | Switch to `peerDependencies` with `"*"` wildcards; remove pinned versions |
| `Cannot find module '@activepieces/pieces-framework'` | Run `bun install` at workspace root; verify peerDependencies |
| `Cannot find name 'httpClient'` | Import from `@activepieces/pieces-common`, not `pieces-framework` |
| `Cannot read properties of undefined (reading 'code')` (500) | Fix `package.json`: add `type: commonjs`, `main` → `.js`, `exports`, and `tslib` dependency |
| Auth property access errors | Cast `context.auth` to `any` before reading fields |

## Summary checklist

When creating or fixing a piece, verify:

1. ☐ `createCustomApiCallAction` is included in the piece's actions list
2. ☐ Actions follow `{Resource} - {Operation}` naming
3. ☐ `package.json` has `type: commonjs`, `main` → `.js`, `exports`, `tslib`, `publishConfig.access: public`
4. ☐ `peerDependencies` use `"*"` wildcards (no pinned versions)
5. ☐ `httpClient` is imported from `@activepieces/pieces-common`
6. ☐ Relative imports have no file extensions
7. ☐ `context.auth` is cast to `any` before property access
8. ☐ Built with `bunx nx build pieces-your-piece` before publish/install

## Canonical source

The long-form reference lives at `packages/pieces/custom/BUILDING_CUSTOM_PIECES.md` in the ActivePieces repo. If this skill seems out of date, read that file and update this skill.
