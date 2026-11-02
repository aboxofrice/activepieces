# Warehouse stack

Installer image + compose files for the warehouse server. The host needs only Docker; every
option is documented at the top of `install.sh` (`... ap-installer:<tag> --help`).

| File | What |
|---|---|
| `install.sh` | install / re-run / upgrade; `restore`, `backup-setup`, `--show-secrets` |
| `docker-compose.yml`, `compose.*.yml` | app + Postgres + Redis, ap-sync, backups |
| `pieces.txt` | custom npm pieces installed on every run |
| `hidden-pieces.txt` | pieces hidden from the picker in EE mode |
| `hidden_pieces.py` | builds the hide list (drops pieces flows use) |

Tests: `python3 -m unittest discover -s tests`.

## Images and release

Four images, all **private** on GHCR: the app image contains EE code (`packages/ee`), whose license
forbids distributing it, so none of them may be made public.

| Image | Built from |
|---|---|
| `ghcr.io/aboxofrice/activepieces` | repo root `Dockerfile` |
| `ghcr.io/aboxofrice/ap-installer` | `deploy/warehouse/installer/Dockerfile` (its default `AP_IMAGE` is the app image of the same release, by digest) |
| `ghcr.io/aboxofrice/ap-sync` | `tools/ap-deploy` |
| `ghcr.io/aboxofrice/ap-backup` | `deploy/warehouse/backup` |

Release flow:

1. Bump the helper tags to the new version `X.Y.Z` in `compose.ap-sync.yml` and
   `compose.backup.yml` (and in the docs that name them), commit.
2. Tag that commit `warehouse-vX.Y.Z` and push the tag. `.github/workflows/warehouse-images.yml`
   checks that the compose files pin `X.Y.Z`, builds all four images from that commit and pushes
   them as `X.Y.Z` and `sha-<short>` (never `latest`), with OCI revision/source/version labels,
   then runs a report-only vulnerability scan. It can also be started by hand (Actions, "Warehouse
   images", optional version). After the first push, check each package is **Private** under the
   account's Packages settings. A version is never pushed twice: if a release run fails partway,
   use "Re-run failed jobs" (not "Re-run all jobs", which stops on the images already pushed).
3. On the warehouse, re-run the new installer and move the app image:
   `... -e AP_IMAGE=ghcr.io/aboxofrice/activepieces:X.Y.Z ghcr.io/aboxofrice/ap-installer:X.Y.Z`
   (`.env` keeps its `AP_IMAGE` otherwise; the installer's built-in default only applies to a
   first install). A changed app image is an upgrade: a pre-upgrade backup is taken first (when
   backups are set up), then the containers are recreated. The helpers move to `X.Y.Z` through the
   new installer's compose files, unless `.env` overrides `AP_SYNC_IMAGE` / `AP_BACKUP_IMAGE`.

Registry access for the warehouse: create a **classic** personal access token (GitHub, Settings,
Developer settings, Personal access tokens, Tokens (classic)) with only the `read:packages` scope,
from an account that can read the packages, with an expiry you will track. Pass it once:
`-e GHCR_USER=<that github user> -e GHCR_TOKEN=<token>`. It is saved in `.env` (mode 600), used
for `docker login ghcr.io` before every pull, and never printed. Fine-grained tokens do not cover
GHCR packages. Without a token, images already on the machine still work (local builds on a Mac).

Local build (repo root), e.g. for a Mac test; tags matching the compose pins are used as-is when
they cannot be pulled:

```bash
rev=$(git rev-parse HEAD)
docker build --build-arg REVISION=$rev -t ghcr.io/aboxofrice/ap-sync:1.2.0 tools/ap-deploy
docker build --build-arg REVISION=$rev -t ghcr.io/aboxofrice/ap-backup:1.2.0 deploy/warehouse/backup
docker build --build-arg REVISION=$rev --build-arg AP_IMAGE=<app image> \
  -f deploy/warehouse/installer/Dockerfile -t ghcr.io/aboxofrice/ap-installer:<tag> deploy/warehouse
```

A new installer that reuses existing helper tags gets
`--build-arg HELPER_REVISION=<commit the helpers were built from>`.

On every run the installer pulls each image of the stack and then:

- stops before starting anything when an image can neither be pulled nor found on the machine,
  naming the image and the setting that picks it;
- says so when a pull failed and it uses a copy already on the machine;
- warns when a helper image's `org.opencontainers.image.revision` label differs from the revision
  the installer was built for (or the label is missing), i.e. the tag was rebuilt from other code.

Each shipped `compose.*.yml` starts with `# managed-by: ap-installer`. A file in the data folder is
removed only when it carries that marker, is one an earlier installer shipped (`PREVIOUSLY_SHIPPED`
in `install.sh`; keep a dropped file's name there) and the current installer no longer ships it.
Your own `compose.*.yml` overrides are never touched.

## First run and the admin account

The first user to sign up becomes the admin, so until the installer has created it the app port is
published on the server itself only (`127.0.0.1`); the installer signs up over the stack's internal
network, then republishes the port on the LAN (the app restarts once, about a minute). This applies
until a run has finished; later runs publish the port right away.

## Backups

Nightly backups (`compose.backup.yml`, after `backup-setup`) go to encrypted folders in Drive, each
with its own retention:

| Folder | Written by | Kept (setting, default) |
|---|---|---|
| `nightly/` | nightly run | `BACKUP_KEEP_NIGHTLY`, 14 |
| `weekly/` | copy of a nightly once a week | `BACKUP_KEEP_WEEKLY`, 8 |
| `manual/` | `backup now [label]` | `BACKUP_KEEP_MANUAL`, 10 |
| `pre-upgrade/` | installer, before a new app image migrates the database | `BACKUP_KEEP_PRE_UPGRADE`, 5 |
| `pre-restore/` | `restore`, before replacing the database | `BACKUP_KEEP_PRE_RESTORE`, 5 |

A one-shot backup prunes only its own folder, so safety backups never delete each other or other
kinds; the restore safety backup prunes nothing at all, so it cannot delete the backup being
restored. The nightly run applies every folder's retention.

## Restore a warehouse backup on another machine

For example on the Mac, when the warehouse server is lost. Needs Docker, the installer image (same
tag as the warehouse) and the warehouse secrets block from the password manager.

1. Put the warehouse's values in a file, e.g. `~/ap-restore.env` (mode 600, one `KEY=value` per
   line, no quotes; Docker reads the values literally):
   `AP_ENCRYPTION_KEY`, `BACKUP_PASSWORD`, `BACKUP_SALT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
   - encryption key: saved connections cannot be decrypted without it;
   - backup password and salt: the backups cannot be decrypted without them;
   - admin email and password: the restored database holds the warehouse admin, and ap-sync and
     installer re-runs sign in with these values.
2. Fresh install into a new folder, passing that file. These values are read on a **first** run only
   (before `.env` exists) and are not printed; a later run may pass the same values but stops if one
   differs from `.env`. Use another stack name and port if anything else runs
   on the machine; if the warehouse used a non-default `BACKUP_DRIVE_FOLDER`, pass the same one:
   ```
   docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock -v ~/ap-restore:/data \
     --env-file ~/ap-restore.env -e COMPOSE_PROJECT_NAME=aprestore -e AP_HTTP_PORT=8092 \
     -e AP_FRONTEND_URL=http://<mac-lan-ip>:8092 ghcr.io/aboxofrice/ap-installer:<tag>
   ```
   Then delete `~/ap-restore.env`. (Without `--env-file`: install normally, ignore the secrets block
   it prints, and before step 3 replace those 5 values in `~/ap-restore/.env` by hand.)
3. `... ap-installer:<tag> backup-setup`, signing in to Google as the account that holds the
   warehouse backups. Do this after step 2: it builds the decryption config from `BACKUP_PASSWORD`
   / `BACKUP_SALT` in `.env`.
4. `... ap-installer:<tag> restore`, pick a backup and type `activepieces`.
5. Sign in at `http://<mac-lan-ip>:8092` with the **warehouse** admin login.

Cautions, if the warehouse is still running or will come back:

- Flows that were enabled in the backup start running right after the restore, and ap-sync applies
  git too: PDC, VIN and polling flows would run on both machines and write twice (e.g. SellerCloud
  imports). Turn them off in the UI right after the restore, or stop ap-sync
  (`docker compose stop ap-sync`) if the warehouse keeps deploying.
- This copy's backup service writes into the warehouse's Drive folder, and its nightly run prunes
  that folder's oldest backups. Right after the restore run `docker compose stop backup` in
  `~/ap-restore` (a later installer run starts it again), or set a different
  `BACKUP_DRIVE_FOLDER` (re-run the installer with `-e BACKUP_DRIVE_FOLDER=...`; no new
  backup-setup needed) before it next runs.

## Edition

Community (`AP_EDITION=ce`) is the default. For this dev/test server, EE can be chosen on the first
run with `-e AP_EDITION=ee`; it is saved to `.env`. Passing it again on a re-run switches edition.
The installer only sets `AP_EDITION`: no license key, no plan or feature flags. Running EE outside
dev/test needs a license (`packages/ee/LICENSE`).

## Hidden pieces (EE only)

In EE mode every installer run sets the platform's piece filter (`filteredPieceNames`, behavior
`BLOCKED`) through `POST /api/v1/platforms/<id>` from `hidden-pieces.txt`:

- Pieces are hidden, not uninstalled. The list ships inside the installer image (the copy in the
  data folder is refreshed every run), so to show a piece again remove its line here, build a new
  installer image and re-run it.
- The whole list is replaced on each run, so filter changes made in the UI are overwritten.
- A piece referenced by any flow version of the platform is never hidden (a hidden piece cannot be
  loaded, so its flows would break), including flows made while the server ran Community. The
  installer logs each one it keeps visible. It applies the list right after signing in, before
  installing pieces.
- ap-sync covers flows deployed later: before each apply it unhides exactly the pieces the flows in
  `deploy.json` need (`unhid X (needed by flow Y)`). Once the flow exists, later installer runs keep
  those pieces visible. If unhiding fails, only those flows are skipped (logged, retried next pass).
- If the hide step fails, the installer warns and finishes; the filter stays as it was.
- Community ignores the setting, so the list is not applied there.

Managed flows (ap-sync) are created disabled unless `deploy.json` sets `"enabled": true`; see
`tools/ap-deploy/README.md`.
