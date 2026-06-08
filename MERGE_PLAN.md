# Post-Merge Completion Plan (v0.82.1)

Companion to `FORK_CHANGES.md`. Tracks the work to turn the WIP merge checkpoint
(`chore/merge-upstream-0.82`, merge commit `1118c5de45`) into a working build.

## Context discovered during investigation

- Upstream moved the build system **nx → turbo** and renamed `packages/react-ui` → `packages/web`.
- Custom pieces under `packages/pieces/custom/*` still carry **nx `project.json`** configs
  (merged in unchanged) and must be converted to turbo build scripts. Upstream ships a
  converter: `tools/scripts/migrate-custom-piece-to-turbo.ts`. **This migration unblocks both #1 and #3.**
- The upstream Dockerfile (now in use) does `rm -rf packages/pieces/core packages/pieces/custom`
  and keeps only 4 community pieces (slack, square, facebook-leads, intercom).
- `docker-compose.yml` (fork's, kept) mounts `./dist/packages/pieces` into the container.
- Runtime loads pieces from filesystem when `AP_DEV_PIECES` is set (+ dist present), else from DB.
- Workspaces already include `packages/pieces/custom/*`.

Execution order: **migrate piece build configs → #1 delivery → #3 validate → #2 UI.**

---

## #1 — Custom pieces into build & runtime (turbo + Docker)

Delivery options (pick one):
- **A. Dev-pieces mount** (current fork setup): build on host → `./dist/packages/pieces` → mount + `AP_DEV_PIECES`.
- **B. Bake into image**: edit Dockerfile trim line to keep `packages/pieces/custom`.
- **C. Publish to DB**: run `publish-pieces.sh` to register pieces in DB.

Steps:
1. Run `migrate-custom-piece-to-turbo.ts` on all custom pieces.
2. `turbo run build --filter='@vqnguyen1/*'` → confirm dist output.
3. Wire chosen delivery (Dockerfile edit for B / mount + `AP_DEV_PIECES` for A / publish for C); update `tools/rebuild.sh` for turbo.
4. Boot and confirm pieces appear.

## #2 — Admin-UI customization (re-apply against packages/web)

- Route rename `/platform → /admin`: NOT upstream → re-apply in `packages/web/src/app/routes/platform-routes.tsx` + redirect.
- Remove Billing/Branding/Projects sidebar entries: `packages/web/src/app/components/sidebar/platform/index.tsx`.
- Sortable data tables: **already in upstream** (getSortedRowModel/SortingState/sortable prop). Only optional `sortable` props on the Pieces page remain.

Decision: re-apply `/platform→/admin` (re-conflicts every future merge) OR adopt upstream `/platform` and drop the customization.

## #3 — Validate custom pieces vs new framework

Risk LOW — framework APIs the pieces use are unchanged v0.74→0.82; sageworks type-check showed no piece-level errors.
1. `bun install`.
2. Migrate build configs (shared with #1).
3. `turbo run build --filter='@vqnguyen1/*'`; fix minimal errors.
4. Runtime spot-check.

Est. effort ~1–2 hours, likely few/no code changes.

---

## Progress (2026-06-08, branch chore/merge-upstream-0.82)

- ✅ **Piece build configs migrated nx→turbo** (7 custom pieces + community/fiserv) via `migrate-custom-piece-to-turbo.ts`.
- ✅ **#3 DONE — all custom pieces build clean** against the new framework. Required: bun upgraded to **1.3.3** (was 1.0.1, too old; pinned in package.json `packageManager`), then `bun install --ignore-scripts` (skips the `couchbase` native postinstall that needs CMake), then `turbo run build --filter='@vqnguyen1/*'` → 11/11 tasks OK. **No piece code changes needed.**
- ✅ **#2 DONE — sidebar cleaned**: removed Billing/Branding/Projects from `packages/web/src/app/components/sidebar/platform/index.tsx` (+ dead imports). Adopted upstream `/platform` (no rename). Sortable tables already shipped by upstream (nothing to do).
- 🟡 **#1 partial**: fixed the `docker-compose.yml` mount (old nx `./dist/packages/pieces` → `./packages/pieces/custom`, where the turbo loader scans). REMAINING (deployment-specific):
  1. **`AP_DEV_PIECES` must use FOLDER names**, not package names. Change `.env` from
     `@vqnguyen1/piece-fiserv-premier,...` to `fiserv-premier,gelato,icemortgage-encompass,narmi,ncino,plaid,sageworks`
     (+ `fiserv` if mounting community/fiserv). The loader matches `path.endsWith('/<name>/dist')`.
  2. **Build pieces on host before `docker compose up`**: `turbo run build --filter='@vqnguyen1/*'`.
  3. ⚠️ **npm-dep caveat**: the upstream Dockerfile aggressively trims (`rm -rf packages/pieces/custom` + keeps only 4 community pieces + `bun install`), so the container's node_modules will NOT contain custom pieces' external npm deps. A mounted piece whose `dist/index.js` imports an external package (an SDK, etc.) will fail to `require` it at runtime. If any custom piece has external deps, either relax the Dockerfile trim to keep `packages/pieces/custom` and let bun install them (effectively option B), or publish to DB (option C). Pieces using only framework/common/std-lib are fine under the mount.
  4. `tools/rebuild.sh` lives on `feat/jxchange-addition`, not here — bring it over (and update for turbo) when reconciling branches.

## Decisions (locked 2026-06-08)
1. **Piece delivery for #1: A — dist-mount + `AP_DEV_PIECES`.** Build pieces on host into
   `./dist/packages/pieces`, keep the docker-compose mount, list pieces in `AP_DEV_PIECES`.
   Do NOT bake into the image (leave upstream Dockerfile trim as-is).
2. **Admin route for #2: adopt upstream `/platform`.** Drop the `/platform→/admin` rename
   entirely. Re-apply ONLY the sidebar cleanups (remove Billing/Branding/Projects). No redirect.
