# ap-deploy

Git-driven flow deploys. Flows built on the Mac are exported to the flows repo
(`aboxofrice/activepieces-flows`); `ap-sync` on the server pulls the repo and applies them.
Python 3 stdlib only.

## Flows repo layout

```
managed/<deploy-key>.json    # exported by `ap_deploy.py export`; git is the source of truth
warehouse-made/<slug>.json   # staff flows, written nightly by ap-sync (read-only copy)
deploy.json                  # per server: which managed flows exist there, and on/off
```

`deploy.json`:

```json
{ "warehouse": { "vin-request-email": { "enabled": false } } }
```

Each flow file holds `deployKey`, `displayName`, `schemaVersion`, `notes`, the `trigger` step tree,
and the derived `pieces` (name + version) and `connections` (names) it uses. Ids, owners,
timestamps and sample data are stripped; keys are sorted so diffs stay clean.
Staff exports add `warehouseFlowId` and `status`, with `deployKey: null`.

## Commands

```bash
# Mac: export (first time picks the source flow; also stamps metadata.deployKey on it)
AP_SOURCE_URL=http://localhost:8080 AP_SOURCE_API_KEY=sk-... AP_SOURCE_PROJECT_ID=... \
  python3 ap_deploy.py --repo ~/activepieces-flows export vin-request-email --flow-id <id>   # or --name "<display name>"
# later re-exports find the flow by its deployKey
python3 ap_deploy.py --repo ~/activepieces-flows export vin-request-email pdc-inventory-email

# Any target (AP_* env + AP_DEPLOY_TARGET)
python3 ap_deploy.py --repo <checkout> plan          # what apply would do
python3 ap_deploy.py --repo <checkout> apply
python3 ap_deploy.py --repo <checkout> status        # table: state, on/off, wanted, flow id
python3 ap_deploy.py --repo <checkout> export-staff  # flows without a deployKey -> warehouse-made/

# Helper loop (normally the ap-sync container)
python3 ap_sync.py [--once] [--export-now] [--no-push]
```

Exit codes: `0` ok, `1` something skipped/flagged/failed, `2` fatal (auth, missing deploy.json).

## How apply decides

Flows are matched by `metadata.deployKey`. After each apply the flow's metadata also gets
`sourceHash` (hash of the file applied) and `deployHash` (hash of the resulting flow on the server).

| State | Meaning | Apply does |
|---|---|---|
| `new` | listed, not on the server | create in folder "Managed (from git)", import, publish, set on/off (default off) |
| `changed` | file differs from `sourceHash`, or a previous apply did not finish | import, publish, set on/off |
| `in-sync` | nothing changed | only fixes on/off if it differs from deploy.json |
| `drifted` | flow on the server no longer matches `deployHash` (edited there) | skips and flags; never overwrites |
| `missing-deps` | a piece version or connection name is not on the server | skips and flags |
| `unlisted` | carries a deployKey but is not in deploy.json for this server | nothing (never deleted) |
| `error` | file missing, or two flows share a deployKey | skips and flags |

To resolve a drifted flow: export it into git (accept the edit), or clear `deployHash` in its
metadata (let git win on the next apply).

## Environment

| Var | Used by | Notes |
|---|---|---|
| `AP_URL` | all target commands | e.g. `http://activepieces:8080` |
| `AP_EMAIL` / `AP_PASSWORD` | target | Community has no API keys: signs in via `/api/v1/authentication/sign-in` |
| `AP_API_KEY` | target | alternative to email/password (EE platform key) |
| `AP_PROJECT_ID` | target | optional with email/password (taken from sign-in); required with an API key |
| `AP_SOURCE_*` | `export` | same names with `AP_SOURCE_` prefix; each falls back to the `AP_*` one |
| `AP_DEPLOY_TARGET` | plan/apply/status, ap-sync | key in deploy.json (ap-sync default `warehouse`) |
| `AP_FLOWS_REPO` | ap_deploy.py | repo checkout (default `.`); `--repo` overrides |
| `FLOWS_REPO_URL`, `FLOWS_BRANCH` | ap-sync | HTTPS clone URL, default branch `main` |
| `GITHUB_TOKEN` | ap-sync | fine-grained token, contents read/write on the flows repo only; passed by a credential helper, never written to `.git/config` |
| `FLOWS_DIR`, `STATE_FILE` | ap-sync | default `/data/flows`, `/data/ap-sync-state.json` (named volume) |
| `SYNC_INTERVAL_MINUTES` | ap-sync | default 5 |
| `EXPORT_HOUR`, `TZ` | ap-sync | nightly staff export runs on the first pass at/after this local hour |

## Container

```bash
docker build -t ghcr.io/aboxofrice/ap-sync:<tag> tools/ap-deploy
```

Service definition: `deploy/warehouse/compose.ap-sync.yml` (named volume only; reads `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `GITHUB_TOKEN` from the stack `.env`). Image upgrades via `release.json` are not
implemented yet: `check_release_upgrade()` in `ap_sync.py` is the hook.

## Known limits

- Piece and connection checks are by exact piece version and connection name; connections are
  never created or copied (logins stay on each server).
