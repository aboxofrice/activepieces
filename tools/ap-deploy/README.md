# ap-deploy

Git-driven flow deploys. Flows built on the Mac are exported to the flows repo
(`aboxofrice/activepieces-flows`); `ap-sync` on the server pulls the repo and applies them.
Python 3 stdlib only.

## Flows repo layout

```
managed/<deploy-key>.json    # exported by `ap_deploy.py export`; git is the source of truth
warehouse-made/<slug>.json   # staff flows, written nightly by ap-sync (read-only copy)
deploy.json                  # per server: which managed flows exist there, and on/off
status/<target>.json         # written nightly by ap-sync: backup last success/failure, managed flow states
```

`deploy.json`:

```json
{ "warehouse": { "vin-request-email": { "enabled": false } } }
```

Each flow file holds `deployKey`, `displayName`, `schemaVersion`, `notes`, the `trigger` step tree,
and the derived `pieces` (name + version) and `connections` (names) it uses. Ids, owners,
timestamps and sample data are stripped; keys are sorted so diffs stay clean.
Staff exports add `warehouseFlowId` and `status`, with `deployKey: null`.

Staff exports are **redacted** before they are committed: values that look like credentials are
replaced with `<redacted-by-ap-sync>` (fields named like `*token*`, `*secret*`, `*password*`,
`*apikey*`, `Authorization`; `Bearer …`/`Basic …` values; `password = "…"` in code; known token
formats such as `sk-…`, `ghp_…`, `AKIA…`; long random-looking strings). Template references like
`{{connections['x']}}` are kept. The file then lists the touched fields under `redacted`, and
ap-sync logs a `WARNING export-staff …` line naming the flow and step. A redacted export is history,
not a working copy: move the credential into a connection on the server.

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
`sourceHash` (hash of the file applied), `deployHash` (hash of the resulting flow on the server),
`deployVersionId` + `deploySchemaVersion` (the published version it produced), `deployedStatus`
(on/off as left by the apply) and `hashVersion`.

Hashes leave out `schemaVersion`. After an image upgrade Activepieces migrates flow versions in
place (same version id, newer `schemaVersion`, sometimes a rewritten trigger); apply recognises
that (same `deployVersionId`, newer schema) and re-records the baseline instead of flagging drift.
A staff edit always creates a new version id, so it is still flagged. Metadata written by an older
ap-deploy (`hashVersion` 1) is compared the old way once and then re-recorded.

`"enabled": false` in deploy.json always wins: it turns the flow off even when the flow is
drifted, missing deps or its file is broken. The other way round is not automatic: if a flow
that apply left **on** is turned **off** in the UI (an emergency stop), apply flags it as drifted
and leaves it off. Accept the stop with `"enabled": false`, or turn it back on in the UI.

Apply takes a lock per target (a file in the temp dir), so a manual
`docker compose exec ap-sync python3 ap_deploy.py --repo /data/flows apply` never races the loop.
Each deploy key is evaluated on its own: a broken flow file or deploy.json entry marks only that
key `error`; a deploy.json that is not valid JSON stops the pass (logged, retried next pass).

| State | Meaning | Apply does |
|---|---|---|
| `new` | listed, not on the server | create in folder "Managed (from git)", import, publish, set on/off (default off) |
| `changed` | file differs from `sourceHash`, or a previous apply did not finish | import, publish, set on/off |
| `in-sync` | nothing changed | only fixes on/off if it differs from deploy.json |
| `drifted` | flow on the server no longer matches `deployHash` (edited there), or was turned off there | skips and flags; never overwrites, never turns back on |
| `missing-deps` | a piece version or connection name is not on the server | skips and flags |
| `unlisted` | carries a deployKey but is not in deploy.json for this server | nothing (never deleted) |
| `error` | file missing or not a flow, bad deploy.json entry or key, or two flows share a deployKey | skips and flags |

Any flagged flow that deploy.json wants off is still turned off (`pending: disable`).

To resolve a drifted flow: export it into git (accept the edit), or clear `deployHash` in its
metadata (let git win on the next apply). For a flow turned off on the server, see above.

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
| `GITHUB_TOKEN` | ap-sync | fine-grained token, contents read/write on the flows repo only; passed by a credential helper scoped to the `FLOWS_REPO_URL` host, never written to `.git/config` |
| `BACKUP_STATUS_FILE` | ap-sync | default `/backup-status/status` (backup service's status volume, read-only) |
| `FLOWS_DIR`, `STATE_FILE` | ap-sync | default `/data/flows`, `/data/ap-sync-state.json` (named volume) |
| `SYNC_INTERVAL_MINUTES` | ap-sync | default 5 |
| `EXPORT_HOUR`, `TZ` | ap-sync | nightly staff export runs on the first pass at/after this local hour |

## Container

```bash
docker build -t ghcr.io/aboxofrice/ap-sync:<tag> tools/ap-deploy
```

Service definition: `deploy/warehouse/compose.ap-sync.yml` (named volume only; gets `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `GITHUB_TOKEN` from the stack `.env` and nothing else). Image upgrades via
`release.json` are not implemented yet: `check_release_upgrade()` in `ap_sync.py` is the hook.

Tests (no server needed): `cd tools/ap-deploy && python3 -m unittest discover -s tests`.

## Known limits

- Piece and connection checks are by exact piece version and connection name; connections are
  never created or copied (logins stay on each server).
- ap-sync signs in as the admin (Community has no API keys, and adding a second user needs the
  invitation flow). If someone changes the admin password in the UI, ap-sync logs
  `sign-in as … was rejected` until `ADMIN_PASSWORD` in the server `.env` is updated and the
  installer is re-run (Community has no password reset).
- Redaction is pattern-based: it errs on the side of hiding values, and can still miss a secret in
  an unusual shape. Keep credentials in connections.
