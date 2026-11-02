# ap-deploy

Git-driven flow deploys. Flows built on the Mac are exported to the flows repo
(`aboxofrice/activepieces-flows`); `ap-sync` on the server pulls the repo and applies them.
Python 3 stdlib only.

ap-sync is **pull-only**: it never commits or pushes, so its GitHub token needs read access only
(fine-grained, Contents: Read on the flows repo). Flows staff build on the server are not exported
to git; they live in the database and are protected by the encrypted Drive backups
(`deploy/warehouse/compose.backup.yml`).

## Flows repo layout

```
managed/<deploy-key>.json    # exported by `ap_deploy.py export`; git is the source of truth
deploy.json                  # per server: which managed flows exist there, and on/off
```

`deploy.json`:

```json
{ "warehouse": { "vin-request-email": { "enabled": false } } }
```

Optional per flow: `"overwrite": "<any new string>"` (see "To resolve a drifted flow").

Each flow file holds `deployKey`, `displayName`, `schemaVersion`, `notes`, the `trigger` step tree,
and the derived `pieces` (name + version) and `connections` (names) it uses. Ids, owners,
timestamps and sample data are stripped; keys are sorted so diffs stay clean.
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

# Helper loop (normally the ap-sync container)
python3 ap_sync.py [--once]
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
| `changed` | file differs from `sourceHash`, or a previous apply did not finish (see below) | import, publish, set on/off |
| `in-sync` | nothing changed | only fixes on/off if it differs from deploy.json |
| `drifted` | flow on the server no longer matches `deployHash` (edited there), or was turned off there | skips and flags; never overwrites, never turns back on |
| `missing-deps` | a piece version or connection name is not on the server | skips and flags |
| `unlisted` | carries a deployKey but is not in deploy.json for this server | nothing (never deleted) |
| `error` | file missing or not a flow, bad deploy.json entry or key, or two flows share a deployKey | skips and flags |

Any flagged flow that deploy.json wants off is still turned off (`pending: disable`).

Interrupted applies: apply writes `applyingSourceHash` before IMPORT_FLOW and `applyingHash` (the
imported version's hash) right after it, and clears both when the apply completes. If publish
fails, the next pass sees a flow that still matches `applyingHash` and finishes the apply instead
of flagging it as drifted. If the server rejects the import with an HTTP error, nothing was
imported and the pending hash is cleared at once; on a timeout or connection error it is kept,
because the import may have gone through.

To resolve a drifted flow without reaching the server:
- **Keep the staff edit:** restore the latest Drive backup onto a local test stack on the Mac
  (installer `restore`, with the warehouse's `BACKUP_PASSWORD`/`BACKUP_SALT` and
  `AP_ENCRYPTION_KEY` in that stack's `.env`), run `ap_deploy.py export <key>` against it, commit.
- **Discard it (let git win):** add a new `"overwrite"` token to the flow's deploy.json entry, e.g.
  `{"enabled": true, "overwrite": "2026-11-02"}`, and push. The next pass re-imports the git
  version once (also undoing a stop made in the UI) and records the token, so later edits are
  flagged again; a new token is needed to overwrite again.

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
| `GITHUB_TOKEN` | ap-sync | fine-grained token, **read-only** (Contents: Read) on the flows repo; passed by a credential helper scoped to the `FLOWS_REPO_URL` host, never written to `.git/config`. Empty for a public repo |
| `SYNC_HEALTHCHECK_URL` | ap-sync | optional healthchecks.io-style URL: GET after every good pass, `<url>/fail` after a failed one (separate check from the backup's `HEALTHCHECK_URL`) |
| `FLOWS_DIR` | ap-sync | checkout, default `/data/flows` (named volume); reset to `origin/<branch>` every pass |
| `SYNC_INTERVAL_MINUTES` | ap-sync | default 5 (an invalid value logs a warning and uses the default) |
| `TZ` | ap-sync | log timestamps only |

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
- Staff-built flows have no git history; to see or recover an older version, restore a backup
  (onto a test instance if only one flow is needed).
