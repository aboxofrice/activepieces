#!/bin/sh
# One-time Google Drive authorization for the nightly backup. POSIX sh; needs only `docker compose`.
# Run through the installer image: ... ghcr.io/aboxofrice/ap-installer:<tag> backup-setup
# All the work happens in the backup image (`backup setup`): it asks for the token from `rclone authorize "drive"` (input hidden), writes
# the rclone config into the root-only `backup_config` volume and checks Drive is reachable.
# Nothing secret is printed.
set -eu
cd "${DATA_DIR:-$(dirname "$0")}"
[ -f .env ] || { echo "ERROR: .env not found; run install.sh first" >&2; exit 1; }
if [ -z "${COMPOSE_FILE:-}" ]; then
    # Same file set install.sh uses, so helper services (ap-sync) are stopped and started too.
    COMPOSE_FILE=docker-compose.yml
    for f in compose.*.yml; do [ -f "$f" ] && COMPOSE_FILE="$COMPOSE_FILE:$f"; done
    export COMPOSE_FILE
fi
docker compose --env-file .env up -d postgres
docker compose --env-file .env run --rm backup setup
docker compose --env-file .env up -d backup
echo "Backups are set up. The next nightly run is at BACKUP_TIME (default 03:30)."
