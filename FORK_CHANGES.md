# Fork Changes & Upstream Merge Guide

> Inventory of everything this fork adds on top of upstream ActivePieces, plus a
> runbook for pulling in upstream updates **without losing custom work**.
>
> Generated 2026-06-08. Regenerate the data with the commands in each section.

## 1. Fork origin

| | |
|---|---|
| **Upstream repo** | https://github.com/activepieces/activepieces |
| **Forked from version** | **v0.74.3** |
| **Fork-base commit** | `d17885049b` — *"feat: neverbounce (#10550)"* (recorded in `tools/fork-baseline/fork-base-commit.txt`) |
| **Your remote** | `origin` → `aboxofrice/activepieces` |
| **Upstream remote** | `upstream` → `activepieces/activepieces` (added 2026-06-08) |
| **Divergence (as of 2026-06-08)** | `main` is **11 commits ahead**, **~1,805 commits / 8 minor releases behind** (upstream at v0.82.1) |

The merge-base between `main` and `upstream/main` is exactly the fork-base commit, so
`git diff upstream/main...main` shows **only** the fork's changes.

## 2. The golden rule that protects custom work

A merge can **only** conflict when *both* sides change the *same lines of the same file*.

- **~95% of this fork is additive** — brand-new files (custom pieces, AI assistant,
  docs, tools) that upstream never touches. These merge with **zero conflicts**.
- Only **17 files modify existing upstream code**. Those are the only places a merge
  needs hand-resolution, and they are fully documented in §5 + preserved as a patch in
  `tools/fork-baseline/modified-upstream-files.patch`.

## 3. Custom commits (11)

See `tools/fork-baseline/custom-commits.txt`. Summary:

- `5211dd3e` feat: remove paywall and refactor admin UI  ← **highest merge risk**
- `b1457a5d` feat: add plaid and ncino pieces
- `6e1d25dc` feat: add backup flow tool
- `146448d3` feat: add Sageworks piece and update existing pieces
- `86e93042` feat: add Fiserv piece and related shared utilities
- `43d5ba42` feat: update Fiserv Premier piece + tools (delete-piece.js, icemortgage-encompass)
- `0fa60549` feat: add Fiserv Premier and Gelato custom pieces
- (+ 4 merge commits)

> Note: branches `feat/jxchange-addition`, `feat/ai-assistant`, `feat/fis`, etc. contain
> additional pieces (jxchange, fis-horizon, fis-ibs, fis-ibs-cards, kinective-placeholder)
> and the **AI assistant** feature that are **not yet merged to `main`**.

## 4. Custom pieces (all additive — safe)

Live under `packages/pieces/custom/` (a directory that does **not** exist upstream — stock
ActivePieces only has `packages/pieces/community/`). One piece (`fiserv`) also sits under
`community/`.

| Piece | Package | Version |
|---|---|---|
| Fiserv Premier | `@vqnguyen1/piece-fiserv-premier` | 0.0.14 |
| Fiserv | `@vqnguyen1/piece-fiserv` (under `community/`) | 0.0.4 |
| Sageworks | `@vqnguyen1/piece-sageworks` | 0.0.2 |
| Narmi | `@vqnguyen1/piece-narmi` | 0.0.6 |
| Plaid | `@vqnguyen1/piece-plaid` | 0.0.2 |
| nCino | `@vqnguyen1/piece-ncino` | 0.0.3 |
| Gelato | `@vqnguyen1/piece-gelato` | 0.0.3 |
| ICE Mortgage / Encompass | `@vqnguyen1/piece-icemortgage-encompass` | 0.0.9 |
| FIS Horizon | `@vqnguyen1/piece-fis-horizon` | 0.0.8 |
| FIS IBS | `@vqnguyen1/piece-fis-ibs` | 0.0.7 |
| FIS IBS Cards | `@vqnguyen1/piece-fis-ibs-cards` | 0.0.7 |
| Kinective (placeholder) | `@vqnguyen1/piece-kinective-placeholder` | 0.0.3 |
| _docs & swagger samples_ | `packages/pieces/custom/docs-and-samples/` | — |

**Merge risk: NONE (additive).** ⚠️ But after the merge they may need code fixes — they
import from `@activepieces/pieces-framework`, whose API changed between v0.74 → v0.82.
Budget a "recompile custom pieces against new framework" pass.

## 5. AI Assistant feature (additive — safe)

Entirely a fork addition (does not exist upstream):

- Backend: `packages/server/api/src/app/ai-assistant/` (controller, service, `ai-assistant-context.ts`)
- Frontend: `/ai-assistant` route + flow wizard
- Registered via a 1-line edit to `app.ts` (see §6) — that registration is the only
  conflict-prone part.

**Merge risk: NONE for the feature files** (new). The `app.ts` registration is covered in §6.

## 6. The 17 modified upstream files — THE MERGE PUNCH LIST

Full diffs preserved in **`tools/fork-baseline/modified-upstream-files.patch`**.
Regenerate intent diff: `git diff upstream/main...main -- <file>`.

### 🔴 High risk (heavily changed upstream)

| File | Your change | Re-apply strategy |
|---|---|---|
| `package.json` | Removed `prebuild: install-bun.js` script | Trivial — re-remove after taking upstream's version |
| `Dockerfile` | Added `nx build shared` step before react-ui/server build | Re-add; note upstream build steps may differ |
| `docker-compose.yml` | Build locally instead of pulling `:0.74.3` image; expose postgres `5432` + redis `6379`; mount `./dist/packages/pieces` | Re-apply; update the version reference |
| `packages/server/api/src/app/app.ts` | Registers `globalConnectionModule` in the community switch case (paywall removal) **+ AI assistant module registration** | Re-add both registrations after merge |
| `packages/ee/shared/src/lib/billing/index.ts` | **Paywall removal**: flipped ~20 plan flags to `true` (embedding, globalConnections, customRoles, environments, auditLog, managePieces, manageTemplates, customAppearance, projectRoles, customDomains, apiKeys, sso) in `STANDARD_CLOUD_PLAN` + `OPEN_SOURCE_PLAN` | ⚠️ **File moved upstream to `packages/shared/src/lib/ee/billing/index.ts`.** Re-apply the flag flips by intent, not by patch. |

### 🟠 Medium risk — Admin UI refactor (`/platform/*` → `/admin/*`)

> ⚠️ **CRITICAL:** Upstream renamed the entire `packages/react-ui` package to
> `packages/web`. All files below **moved**. A naive merge reports them as
> "modify/delete" and **strands your edits in a deleted folder**. Re-apply these by
> intent against the new `packages/web/...` paths.

The "refactor admin UI" commit renames all platform-admin routes from `/platform/*` to
`/admin/*` and removes Billing/Branding/Projects nav entries. Affected files:

| File (old `react-ui` path) | Your change |
|---|---|
| `app/guards/index.tsx` | Rewrote route table: `/platform/*` → `/admin/*`, removed Billing/Branding/Projects routes, added connectors/globalconnections routes, added `/platform/*` → `/admin` redirect |
| `app/components/sidebar/platform/index.tsx` | Sidebar nav: `/platform` → `/admin` links, removed Billing/Branding/Pieces, added Connectors + "Global Connections 2", "Exit platform admin" → "Exit admin" |
| `app/components/sidebar/sidebar-user.tsx` | `/platform` → `/admin`; "Platform Admin" label → "Admin" |
| `app/routes/explore/index.tsx` | `navigate('/platform/setup/templates')` → `/admin/...` |
| `app/routes/platform/security/project-role/project-role-users-table.tsx` | `/platform/...` → `/admin/...` |
| `app/routes/platform/security/project-role/project-roles-table.tsx` | `/platform/...` → `/admin/...` |
| `app/builder/pieces-selector/ai-tab-content/ai-actions-list.tsx` | `navigate('/platform/setup/ai')` → `/admin/setup/ai` |

### 🟠 Medium risk — Sortable data tables (feature add)

| File | Your change |
|---|---|
| `components/ui/data-table/data-table-column-header.tsx` | Added optional `sortable` prop with asc/desc/clear toggle UI (ArrowUp/ArrowDown/ChevronsUpDown) |
| `components/ui/data-table/index.tsx` | Wired `getSortedRowModel` + `SortingState` into `DataTable` |
| `app/routes/platform/setup/pieces/index.tsx` | Passes `sortable={true}` on Pieces table columns |

### 🟢 No risk (upstream never touched these)

| File | Your change |
|---|---|
| `tools/reset.sh` | Made executable (mode 644 → 755) |
| `tools/reset-dev.sh` | Made executable (mode 644 → 755) |

## 7. Upstream merge runbook

**Never merge on `main` directly.** A safety tag already exists: `pre-upstream-merge-baseline`.

```bash
# 0. Make sure upstream is current
git fetch upstream main --no-tags

# 1. Branch off main for the merge work
git switch main
git switch -c chore/merge-upstream-0.82

# 2. (Recommended) merge incrementally, release by release, instead of all 1,805 commits.
#    Find release tags between your base and HEAD, merge to each, test, repeat:
git log upstream/main --oneline | grep -iE 'feat: release' | tail -20
#    e.g. git merge <commit-of-0.75.0>  -> resolve -> build -> git merge <0.76.0> ...

#    Or, one shot (heavier conflict batch):
git merge upstream/main
```

When conflicts appear:

1. **Additive files** (custom pieces, ai-assistant): no conflicts — leave them.
2. **Lockfiles** (`package-lock.json`, `bun.lockb`): don't hand-merge — `git checkout --theirs <lockfile>` then regenerate (`npm install` / `bun install`).
3. **The 17 files in §6**: re-apply *intent* using `tools/fork-baseline/modified-upstream-files.patch` as reference. Remember:
   - billing moved → `packages/shared/src/lib/ee/billing/index.ts`
   - `react-ui` → `web`: apply UI edits under `packages/web/...`
4. **Re-register** in `app.ts`: `globalConnectionModule` **and** the AI assistant module.

After the merge:

```bash
# Rebuild & boot to verify
bash tools/rebuild.sh
# Recompile/fix custom pieces against the new pieces-framework API
nx run-many --target=build --projects=$(ls packages/pieces/custom | tr '\n' ',')
```

5. Only after it builds, boots, paywall stays removed, custom pieces load, and the AI
   assistant works → fast-forward `main` to the merge branch.

## 8. Hygiene recommendation

Committed build artifacts inflate every diff. Consider `.gitignore`-ing:
`**/dist-publish/`, `benchmark_results/`, and regenerating lockfiles instead of committing
merge-resolved ones. This makes future `git diff upstream/main...main` readable.
