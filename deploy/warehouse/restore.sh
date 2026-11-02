#!/bin/sh
# Restore the Activepieces database from an encrypted Drive backup. POSIX sh; needs only
# `docker compose`, so it also runs inside the installer container.
#
#   ./restore.sh                 list backups and pick one
#   ./restore.sh <path>          restore that backup, e.g. nightly/activepieces-20261101T023000-nightly.dump
#
# Steps: confirm -> safety backup of the current database (manual/...-pre-restore) -> stop the app
# services -> restore into a temporary database and swap it in (the backup image does this and
# refuses while anything is still connected) -> start the app services again.
# The replaced database is kept as <db>__before_restore until the next restore.
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo "ERROR: .env not found" >&2; exit 1; }
if [ -z "${COMPOSE_FILE:-}" ]; then
    if grep -qE '^  backup:' docker-compose.yml; then COMPOSE_FILE=docker-compose.yml
    else COMPOSE_FILE=docker-compose.yml:compose.backup.yml; fi
    export COMPOSE_FILE
fi
dc() { docker compose --env-file .env "$@" < /dev/null; }
db=$(grep -E '^AP_POSTGRES_DATABASE=' .env | head -n 1 | cut -d= -f2-)
db=${db:-activepieces}

dc up -d postgres >/dev/null

path=${1:-}
if [ -z "$path" ]; then
    list=$(dc run --rm -T backup list --plain) || { echo "ERROR: could not list backups" >&2; exit 1; }
    [ -n "$list" ] || { echo "No backups found." >&2; exit 1; }
    echo "Available backups (newest first):"
    printf '%s\n' "$list" | sort -t/ -k2 -r | awk -F'\t' '{ printf "  %3d) %-62s %8.1f MB\n", NR, $1, $2 / 1048576 }'
    printf 'Number to restore: '
    read -r n
    path=$(printf '%s\n' "$list" | sort -t/ -k2 -r | awk -F'\t' -v n="$n" 'NR == n { print $1 }')
    [ -n "$path" ] || { echo "ERROR: no backup number '$n'" >&2; exit 1; }
fi

cat <<EOF

  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  !!  THIS REPLACES THE CURRENT ACTIVEPIECES DATABASE ($db)
  !!  with backup: $path
  !!  Everything changed since that backup (flows, connections, runs, flow
  !!  store records) is lost. Activepieces is stopped while this runs.
  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

EOF
printf 'Type the database name (%s) to continue: ' "$db"
read -r answer
[ "$answer" = "$db" ] || { echo "Not confirmed; nothing changed."; exit 1; }

echo "==> Safety backup of the current database"
if ! dc run --rm -T backup now pre-restore; then
    printf 'Safety backup FAILED. Type CONTINUE to restore anyway: '
    read -r answer
    [ "$answer" = CONTINUE ] || { echo "Aborted; nothing changed."; exit 1; }
fi

app_services=$(dc config --services | grep -vxE 'postgres|redis|backup' || true)
[ -n "$app_services" ] || { echo "ERROR: no app services found in the compose config" >&2; exit 1; }
echo "==> Stopping: $(echo $app_services)"
# shellcheck disable=SC2086
dc stop $app_services

echo "==> Restoring $path"
rc=0
dc run --rm -T backup restore "$path" --confirm --disconnect || rc=$?

echo "==> Starting: $(echo $app_services)"
# shellcheck disable=SC2086
dc up -d $app_services
if [ "$rc" -ne 0 ]; then
    echo "RESTORE FAILED (exit $rc). The previous database is still in place." >&2
    exit "$rc"
fi
echo "Restore complete. Previous database kept as ${db}__before_restore; drop it once you are happy:"
echo "  docker compose exec postgres psql -U <user> -d postgres -c 'DROP DATABASE \"${db}__before_restore\"'"
