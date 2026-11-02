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

Build: `docker build -f installer/Dockerfile --build-arg AP_IMAGE=<app image> -t <installer tag> .`
(from this folder). Tests: `python3 -m unittest discover -s tests`.

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
