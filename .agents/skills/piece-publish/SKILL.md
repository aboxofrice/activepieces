---
name: piece-publish
description: Publishes an Activepieces piece to npm under the @vqnguyen1 scope and installs it on the local platform via the Install Piece API. Use when the user asks to publish a piece, release a piece to npm, install a piece from npm, or distribute a piece. Also use for piece version bumps that need republishing.
---

# Piece Publish & Install

Publishes a piece from `packages/pieces/{community,custom}/<name>/` to npm as `@vqnguyen1/piece-<name>`, then installs it on the local platform (localhost:8080) through the same path the Platform Admin → Pieces → Install Piece UI uses.

## Prerequisites (verify, don't recreate)

- `private-npmrc` at repo root holds the npm token (gitignored — NEVER commit or print it). It is also mounted read-only at `/root/.npmrc` in the `activepieces` container via `docker-compose.override.yml`.
- The user's EE platform API key (they paste it per session; don't store it).

## Step 1 — Decide the delivery mode (critical)

A piece can be **dev-mounted OR npm-installed, never both**. `getPieceNameFromAlias()` strips the scope and `piece-` prefix, so if the base folder name (e.g. `symxchange`) is in `AP_DEV_PIECES`, the worker skips the npm install of `@vqnguyen1/piece-symxchange` and the engine throws `PieceNotFoundError`.

Before installing from npm, remove the piece's folder name from `AP_DEV_PIECES` and delete its volume mount in `docker-compose.override.yml`, then `docker compose up -d activepieces`. Check first that no live flow still references the dev package name (`@activepieces/piece-<name>`):

```bash
docker exec postgres psql -U postgres -d activepieces -t -A -c \
  "select f.id, fv.state, fv.\"displayName\" from flow_version fv join flow f on f.id=fv.\"flowId\" where fv.trigger::text like '%piece-<name>%' group by f.id, fv.state, fv.\"displayName\";"
```

Flows pointing at the dev name must be repointed to the npm name — the two are different pieces to the platform.

## Step 2 — Build and prepare the publish copy

```bash
cd packages/pieces/community/<name>
# bump "version" in package.json first (npm rejects re-publishing an existing version)
npx tsc -p tsconfig.lib.json && cp package.json dist/
rm -rf dist-publish && cp -R dist dist-publish
```

Patch `dist-publish/package.json` (script it; don't hand-edit):
- `name` → `@vqnguyen1/piece-<name>`
- `main` → `./src/index.js`, `types` → `./src/index.d.ts` (dist folder becomes the package root)
- **Strip every `@activepieces/*` dependency** — the platform runtime provides framework/shared/common; `workspace:*` deps are invalid on npm and pinned fork versions (e.g. `^0.74.3`) don't exist there. Keep real third-party deps (e.g. `fast-xml-parser`).
- Remove `scripts`.

Logos: there's no CDN for private pieces — embed the image as a `data:image/webp;base64,...` URI in `logoUrl` in `src/index.ts` (keep it under ~30 KB). Warn if the logo is white-on-transparent (invisible on light theme).

## Step 3 — Publish

```bash
cd dist-publish && npm publish --access public --userconfig <repo-root>/private-npmrc
```

- Success line looks like `+ @vqnguyen1/piece-<name>@<version>`.
- **Brand-new packages 404 on the registry for ~5–15 min** (quarantine/indexing). Don't debug — poll `https://registry.npmjs.org/@vqnguyen1%2fpiece-<name>` until HTTP 200 (background watcher, 60s interval).
- `npm whoami` may 401 with a granular token even when publish works — ignore it; test auth with `curl -H "Authorization: Bearer <token>" https://registry.npmjs.org/-/whoami`.

## Step 4 — Install on the platform

```bash
curl -X POST http://localhost:8080/api/v1/pieces \
  -H "Authorization: Bearer $PLATFORM_API_KEY" -H 'Content-Type: application/json' \
  -d '{"packageType":"REGISTRY","scope":"PLATFORM","pieceName":"@vqnguyen1/piece-<name>","pieceVersion":"<exact version>"}'
```

- `201` = installed (the engine sandbox bun-installed the tarball and extracted metadata — this exercises the same path flow execution uses).
- `400 ENGINE_OPERATION_FAILURE` + `PieceNotFoundError` in `docker logs activepieces` = the dev-piece collision from Step 1.
- Verify: `GET /api/v1/pieces?searchQuery=<name>` shows the piece with `packageType: REGISTRY` and the right version/logo.

## Step 5 — Post-publish checks

```bash
npm view @vqnguyen1/piece-<name>@<version> main dependencies --json
```

`dependencies` must contain the real third-party deps and **no** `@activepieces/*` entries (empty-deps tarballs poison worker installs silently — the hubspot 0.8.5–0.8.7 bug). `main` must be `./src/index.js`.

## Updating a published piece

Bump version → rebuild → re-prepare `dist-publish` → publish → `POST /v1/pieces` with the new version. Existing flows stay pinned to the old version until edited; the picker offers the new one.
