#!/bin/sh
# Restore the Activepieces database from an encrypted Drive backup. POSIX sh; needs only
# `docker compose`. Run it through the installer image (it uses the copy baked into the image,
# never a copy in the data folder):
#
#   docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock -v ~/activepieces:/data \
#     ghcr.io/aboxofrice/ap-installer:<tag> restore [<path>]
#
#   no path    list backups and pick one
#   <path>     restore that backup, e.g. nightly/activepieces-20261101T033000-nightly.dump
#
# Steps: confirm -> safety backup of the current database (pre-restore/..., its own folder and
# retention, and pruning skipped so it cannot delete the backup being restored) -> stop the app services -> restore into a
# temporary database and swap it in (the backup image does this and refuses while anything is
# still connected) -> clear Redis -> start the app services again.
# The replaced database is kept as <db>__before_restore_<timestamp> until you drop it.
#
# Why Redis is cleared: it holds the BullMQ jobs (polling-trigger schedules, webhook renewals,
# queued runs) for the database being replaced. Activepieces rebuilds polling and webhook-renewal
# jobs from the database only when the Redis key `worker_jobs_version` is missing
# (packages/server/api/src/app/workers/migrations/queue-migration-runner.ts), and system jobs and
# paused runs on every start. Without the flush, flows that are enabled in the restored database
# but were turned off after the backup would never poll again.
set -eu
cd "${DATA_DIR:-$(dirname "$0")}"
[ -f .env ] || { echo "ERROR: .env not found" >&2; exit 1; }
if [ -z "${COMPOSE_FILE:-}" ]; then
    # Same file set install.sh uses, so helper services (ap-sync) are stopped and started too.
    COMPOSE_FILE=docker-compose.yml
    for f in compose.*.yml; do [ -f "$f" ] && COMPOSE_FILE="$COMPOSE_FILE:$f"; done
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
if ! dc run --rm -T backup now pre-restore --no-prune; then
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
if [ "$rc" -eq 0 ]; then
    echo "==> Clearing Redis (jobs of the replaced database; rebuilt from the restored one on start)"
    dc up -d redis >/dev/null
    dc exec -T redis redis-cli FLUSHALL >/dev/null || {
        echo "WARNING: could not clear Redis; polling triggers may be out of step. Run:" >&2
        echo "  docker compose exec redis redis-cli FLUSHALL   (with the app stopped), then start it" >&2
    }
fi

echo "==> Starting: $(echo $app_services)"
# shellcheck disable=SC2086
dc up -d $app_services
if [ "$rc" -ne 0 ]; then
    echo "RESTORE FAILED (exit $rc). The previous database is still in place." >&2
    exit "$rc"
fi
echo "Restore complete. The previous database was kept (name in the RESTORE OK line above,"
echo "${db}__before_restore_<timestamp>). Drop it once you are happy:"
echo "  docker compose exec postgres psql -U <user> -d postgres -c 'DROP DATABASE \"${db}__before_restore_<timestamp>\"'"
