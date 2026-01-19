# Building Custom Pieces for Activepieces

This guide documents the common issues and solutions when building custom pieces for Activepieces.

## Standard Requirements for All Custom Pieces

### 1. Custom API Call Action (Required)

**Every custom piece MUST include a Custom API Call action** to allow users to interact with any endpoint not covered by specific actions.

**Implementation:**
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

**Features the Custom API Call provides:**
- Full URL or relative path support
- All HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
- Custom headers and query parameters
- JSON request body
- Binary response handling (PDFs, images, etc.)
- Failsafe mode (no error on failure)
- Configurable timeout
- Automatic authentication header injection

**Examples by Auth Type:**

**Bearer Token Auth:**
```typescript
createCustomApiCallAction({
  baseUrl: () => 'https://api.example.com',
  auth: yourAuth,
  authMapping: async (auth) => ({
    Authorization: `Bearer ${auth}`,  // For SecretText auth
  }),
})
```

**Custom Headers Auth (like Fiserv EFXHeader):**
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

**Optional/Conditional Auth:**
```typescript
createCustomApiCallAction({
  baseUrl: (auth) => (auth as any).baseUrl || 'https://api.example.com',
  auth: yourAuth,
  authMapping: async (auth) => {
    const apiKey = (auth as any).apiKey;
    if (apiKey) {
      return { Authorization: `Bearer ${apiKey}` };
    }
    return {};  // No auth headers if apiKey not provided
  },
})
```

### 2. Action Naming Convention

### Pattern: `{Resource} - {Operation}`

Actions should follow this pattern for consistency and clarity:

**Format:**
- **name**: `{resource}_{operation}` (snake_case)
- **displayName**: `{Resource} - {Operation}` (Title Case with dash separator)

**Examples:**
- Loan operations: `Loan - Create`, `Loan - Retrieve`, `Loan - Update`, `Loan - Delete`
- Document operations: `Document - Create`, `Document - Retrieve`, `Document - List`, `Document - Update`
- Field operations: `Loan - Manage Field Locks`

**Benefits:**
- Groups related actions together in UI
- Clear resource identification
- Consistent user experience
- Easy to search and filter

**Example Implementation:**
```typescript
export const createLoan = createAction({
  name: 'loan_create',  // snake_case: resource_operation
  displayName: 'Loan - Create',  // Title Case with dash
  description: 'Create a new loan in Encompass',
  // ... rest of action definition
});
```

## Critical: Correct package.json Structure

### Issue: "Cannot read properties of undefined (reading 'code')" Error

This error occurs when installing a piece with an incorrectly structured `package.json`. The most common cause is:
- Missing `"type": "commonjs"`
- `"main"` pointing to `.ts` file instead of `.js`
- Missing `"exports"` field
- Missing `tslib` dependency

### ❌ Incorrect package.json (Causes 500 Error on Install)

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

### ✅ Correct package.json (Works Properly)

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

### Key Fields Explained

| Field | Required | Description |
|-------|----------|-------------|
| `"type": "commonjs"` | Yes | Tells Node.js to use CommonJS modules |
| `"main": "./src/index.js"` | Yes | Entry point - MUST be `.js`, not `.ts` |
| `"types": "./src/index.d.ts"` | Yes | TypeScript type definitions |
| `"exports"` | Yes | Module export mapping |
| `"tslib": "^2.3.0"` | Yes | Required runtime dependency for compiled TypeScript |
| `"publishConfig.access": "public"` | Yes | Required for scoped packages (@yourscope/) |
| `peerDependencies` with `"*"` | Yes | Use wildcards, not specific versions |

## Root Cause Issues

### Issue 1: Version Mismatch Between Container and npm Packages

**Problem:**
- Activepieces container shows version `0.74.3` (platform version)
- npm packages (`@activepieces/pieces-framework`, `@activepieces/shared`, etc.) have versions like `0.20.1`, `0.22.0`
- Building pieces with `^0.74.3` fails because these versions don't exist in npm registry

**Example Error:**
```
No matching version found for @activepieces/pieces-framework@^0.74.3
```

**Root Cause:**
The version `0.74.3` is the **Activepieces platform version**, not the individual package versions. The packages used internally have different version numbers (0.20.x, 0.22.x).

**Solution:** Use `peerDependencies` with `"*"` wildcards.

### Issue 2: 500 Error "Cannot read properties of undefined (reading 'code')"

**Problem:**
Installing a piece returns:
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Cannot read properties of undefined (reading 'code')"
}
```

**Root Cause:**
The `package.json` is missing required fields or has incorrect values. Common issues:
1. `"main"` points to `.ts` instead of `.js`
2. Missing `"type": "commonjs"`
3. Missing `"exports"` field
4. Missing `tslib` dependency

**Solution:** Use the correct package.json structure shown above.

## Fix Imports

Use the correct import paths for HTTP client and **do NOT include file extensions for relative imports**:

**❌ Incorrect:**
```typescript
import { httpClient } from '@activepieces/pieces-framework';
import { myAction } from './lib/actions/my-action.js';  // NO extensions!
import { myAction } from './lib/actions/my-action.ts';  // NO extensions!
```

**✅ Correct:**
```typescript
import { httpClient } from '@activepieces/pieces-common';
import { myAction } from './lib/actions/my-action';  // No extension
```

**Note:** Do NOT include file extensions (`.js` or `.ts`) in relative imports. TypeScript will compile them correctly to CommonJS `require()` statements without extensions.

## Auth Property Access

For CustomAuth, TypeScript needs explicit casting:

```typescript
const auth = context.auth as any;
const baseUrl = auth.baseUrl;
const organizationId = auth.organizationId;
```

## Building with Nx

Activepieces requires **compiled JavaScript files**, not TypeScript source. Your package must contain `.js`, `.d.ts`, and `.js.map` files.

```bash
# Build with Nx
bunx nx build pieces-your-piece

# The output will be in: dist/packages/pieces/custom/your-piece/
# It will contain:
# - src/index.js (compiled JavaScript)
# - src/index.d.ts (TypeScript definitions)
# - src/lib/actions/*.js (compiled actions)
# - package.json (copied from source)
# - README.md, logo files, etc.

# Navigate to built output
cd dist/packages/pieces/custom/your-piece

# Verify the files are JavaScript
ls -la src/  # Should see .js, .d.ts, .js.map files

# Publish
npm publish --access public
```

## Testing Your Piece

Install via curl to your Activepieces container:

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

### "No matching version found"
- Check that you're using `peerDependencies` with `"*"` wildcards
- Verify you're not using specific version numbers like `^0.74.3`

### "Cannot find module '@activepieces/pieces-framework'"
- Run `bun install` in the workspace root
- Check that peerDependencies are correctly defined

### "Cannot find name 'httpClient'"
- Import from `@activepieces/pieces-common` not `pieces-framework`
- Example: `import { httpClient } from '@activepieces/pieces-common';`

### "Cannot read properties of undefined (reading 'code')" (500 Error)
- Ensure `package.json` has `"type": "commonjs"`
- Ensure `"main"` points to `.js` file, not `.ts`
- Ensure `"exports"` field is present
- Ensure `tslib` is in dependencies

### Auth property access errors
- Cast context.auth to `any`: `const auth = context.auth as any;`
- Then access properties: `auth.baseUrl`, `auth.apiKey`, etc.

## Summary

The key takeaways:

1. **Activepieces container version (0.74.3) ≠ npm package versions (0.20.x, 0.22.x)** - Use `peerDependencies` with `"*"` wildcards
2. **package.json must be properly structured** - Include `type`, `main`, `types`, `exports`, and `tslib`
3. **Import `httpClient` from `@activepieces/pieces-common`**
4. **Cast `context.auth` to `any` for property access**
5. **Build with Nx before publishing**

This ensures your pieces work across different Activepieces versions without version conflicts or installation errors.
