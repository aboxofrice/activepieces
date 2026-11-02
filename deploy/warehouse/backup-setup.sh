#!/bin/sh
# One-time Google Drive authorization for the nightly backup. POSIX sh; needs only `docker compose`,
# so it also runs inside the installer container. All the work happens in the backup image
# (`backup setup`): it asks for the token from `rclone authorize "drive"` (input hidden), writes
# the rclone config into the root-only `backup_config` volume and checks Drive is reachable.
# Nothing secret is printed.
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo "ERROR: .env not found; run install.sh first" >&2; exit 1; }
if [ -z "${COMPOSE_FILE:-}" ]; then
    if grep -qE '^  backup:' docker-compose.yml; then COMPOSE_FILE=docker-compose.yml
    else COMPOSE_FILE=docker-compose.yml:compose.backup.yml; fi
    export COMPOSE_FILE
fi
docker compose --env-file .env up -d postgres
docker compose --env-file .env run --rm backup setup
docker compose --env-file .env up -d backup
echo "Backups are set up. Run one now with: docker compose run --rm backup now"
