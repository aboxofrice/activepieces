#!/bin/sh
# Activepieces database backup: pg_dump -> rclone crypt remote (Google Drive) with retention.
#
#   backup daemon            run cron; nightly backup at BACKUP_TIME (default)
#   backup nightly           one nightly run (what cron calls)
#   backup now [label]       one-shot backup into manual/ (e.g. before an upgrade); exit 1 on failure
#   backup list [--plain]    list backups, oldest first ("path<TAB>bytes" with --plain)
#   backup restore <path> [--confirm] [--disconnect]
#                            restore one backup into the database. Refuses while anything else is
#                            connected to it (stop activepieces/ap-sync first; restore.sh does);
#                            --disconnect ends leftover sessions of an already-stopped app.
#                            Without --confirm it asks you to type the database name.
#   backup prune             apply retention only
#   backup status            print the status file
#   backup setup             write the rclone config (interactive; run via backup-setup.sh)
#
# Remote layout (inside the encrypted folder; names are encrypted in Drive):
#   nightly/activepieces-YYYYMMDDTHHMMSS-nightly.dump   newest BACKUP_KEEP_NIGHTLY kept
#   weekly/ ...                                          newest BACKUP_KEEP_WEEKLY kept
#   manual/activepieces-YYYYMMDDTHHMMSS-<label>.dump     newest BACKUP_KEEP_MANUAL kept
#
# Dumps use pg_dump's custom format (-Fc): compressed, verifiable with `pg_restore --list` before
# upload, and restorable with pg_restore into a fresh database.
set -eu
set -o pipefail

: "${BACKUP_TIME:=02:30}"
: "${BACKUP_REMOTE_TYPE:=drive}"
: "${BACKUP_DRIVE_FOLDER:=Activepieces Backups/warehouse}"
: "${BACKUP_LOCAL_DIR:=/local-backups}"
: "${BACKUP_KEEP_NIGHTLY:=14}"
: "${BACKUP_KEEP_WEEKLY:=8}"
: "${BACKUP_KEEP_MANUAL:=10}"
: "${BACKUP_WEEKLY_DAY:=7}"
: "${RCLONE_CONFIG:=/config/rclone.conf}"
export RCLONE_CONFIG

export PGHOST="${AP_POSTGRES_HOST:-postgres}"
export PGPORT="${AP_POSTGRES_PORT:-5432}"
export PGUSER="${AP_POSTGRES_USERNAME:-postgres}"
export PGDATABASE="${AP_POSTGRES_DATABASE:-activepieces}"
[ -n "${AP_POSTGRES_PASSWORD:-}" ] && export PGPASSWORD="$AP_POSTGRES_PASSWORD"

STATUS_FILE=/status/status
LOCK_FILE=/status/.lock
REMOTE=backup:
WORK=/tmp/backup-work
NAME_RE='^activepieces-[0-9]{8}T[0-9]{6}-[a-z0-9-]+\.dump$'

main() {
    cmd=${1:-daemon}
    [ $# -gt 0 ] && shift
    case "$cmd" in
        daemon) cmd_daemon ;;
        nightly) locked run_backup nightly nightly ;;
        now) locked run_backup manual "$(sanitize_label "${1:-manual}")" ;;
        list) cmd_list "${1:-}" ;;
        restore) [ $# -ge 1 ] || die "usage: backup restore <path> [--confirm] [--disconnect]"; locked cmd_restore "$@" ;;
        prune) locked cmd_prune ;;
        status) cat "$STATUS_FILE" 2>/dev/null || echo "no backup has run yet" ;;
        setup) cmd_setup ;;
        *) die "unknown command: $cmd (daemon|nightly|now|list|restore|prune|status|setup)" ;;
    esac
}

cmd_daemon() {
    hh=${BACKUP_TIME%%:*}; mm=${BACKUP_TIME##*:}
    echo "$hh$mm" | grep -qE '^([01][0-9]|2[0-3])[0-5][0-9]$' || die "BACKUP_TIME must be HH:MM, got '$BACKUP_TIME'"
    # crond starts jobs with an empty environment; hand them ours through a root-only file.
    umask 077
    export -p | grep -E '^export (AP_POSTGRES_|BACKUP_|PG|RCLONE_|TZ=)' > /run/backup.env
    mkdir -p /etc/crontabs
    printf '%s %s * * * . /run/backup.env; /usr/local/bin/backup nightly > /proc/1/fd/1 2>&1\n' \
        "$(strip0 "$mm")" "$(strip0 "$hh")" > /etc/crontabs/root
    log "backup daemon started: nightly at $BACKUP_TIME ($(date +%Z)), remote type $BACKUP_REMOTE_TYPE"
    [ -s "$RCLONE_CONFIG" ] || log "WARNING: no rclone config yet; nightly backups will fail until you run ./backup-setup.sh"
    exec crond -f -l 8
}

run_backup() { # run_backup <folder> <label>
    folder=$1; label=$2
    trap 'on_error "$folder"' EXIT
    STEP="checking configuration"
    [ -s "$RCLONE_CONFIG" ] || fail "rclone is not configured; run ./backup-setup.sh on the server"
    configure_remote

    STEP="waiting for postgres"
    wait_for_postgres

    stamp=$(now_stamp)
    name="activepieces-$stamp-$label.dump"
    mkdir -p "$WORK"; chmod 700 "$WORK"
    file="$WORK/$name"

    STEP="pg_dump"
    log "dumping database $PGDATABASE -> $name"
    pg_dump --format=custom --compress=6 --file="$file" || fail "pg_dump failed"
    STEP="verifying dump"
    pg_restore --list "$file" > "$WORK/toc" || fail "dump is not a readable archive"
    grep -q ' TABLE DATA ' "$WORK/toc" || fail "dump contains no table data"
    size=$(stat -c %s "$file")

    STEP="uploading"
    log "uploading $folder/$name ($size bytes, encrypted)"
    rclone copyto --retries 5 --low-level-retries 20 "$file" "$REMOTE$folder/$name" || fail "upload failed"
    remote_size=$(rclone lsf --format s "$REMOTE$folder/$name") || fail "uploaded file not found"
    [ "$remote_size" = "$size" ] || fail "uploaded size $remote_size != local size $size"

    if [ "$folder" = nightly ] && weekly_due "$stamp"; then
        STEP="weekly copy"
        log "keeping weekly copy weekly/$name"
        rclone copyto "$REMOTE$folder/$name" "$REMOTE""weekly/$name" || fail "weekly copy failed"
    fi

    rm -rf "$WORK"
    STEP="pruning"
    cmd_prune || fail "retention pruning failed"

    trap - EXIT
    write_status success "$folder/$name"
    log "BACKUP OK: $folder/$name ($size bytes)"
}

cmd_prune() {
    configure_remote
    prune_folder nightly "$BACKUP_KEEP_NIGHTLY" || return 1
    prune_folder weekly "$BACKUP_KEEP_WEEKLY" || return 1
    prune_folder manual "$BACKUP_KEEP_MANUAL" || return 1
}

prune_folder() { # prune_folder <folder> <keep>
    names=$(list_names "$1") || return 1
    total=$(printf '%s' "$names" | grep -c . || true)
    excess=$((total - $2))
    [ "$excess" -gt 0 ] || return 0
    printf '%s\n' "$names" | head -n "$excess" | while read -r n; do
        log "retention: deleting $1/$n"
        rclone deletefile "$REMOTE$1/$n" || return 1
    done
}

list_names() { # oldest first; missing folder = empty
    out=$(rclone lsf --files-only "$REMOTE$1" 2>&1) || {
        printf '%s' "$out" | grep -qi 'directory not found' && return 0
        printf '%s\n' "$out" >&2; return 1
    }
    printf '%s\n' "$out" | grep -E "$NAME_RE" | sort || true
}

weekly_due() { # weekly_due <stamp>: on BACKUP_WEEKLY_DAY, or when the newest weekly is >7 days old
    [ "$(now_date +%u)" = "$BACKUP_WEEKLY_DAY" ] && return 0
    newest=$(list_names weekly | tail -n 1)
    [ -z "$newest" ] && return 0
    cutoff=$(date -u -d "@$(( $(now_epoch) - 7 * 86400 ))" +%Y%m%dT%H%M%S)
    newest_stamp=$(echo "$newest" | cut -d- -f2)
    [ "$newest_stamp" \< "$cutoff" ] || [ "$newest_stamp" = "$cutoff" ]
}

cmd_list() {
    configure_remote
    rclone lsf -R --files-only --format "ps" --separator "	" "$REMOTE" \
        | awk -F'\t' -v re="$NAME_RE" '{ n = split($1, p, "/"); if (p[n] ~ re) print p[n] "\t" $0 }' \
        | sort | cut -f2- \
        | if [ "$1" = --plain ]; then cat; else awk -F'\t' '{ printf "%-60s %10.1f MB\n", $1, $2 / 1048576 }'; fi
}

cmd_restore() {
    path=$1; shift
    confirmed=; disconnect=
    for a in "$@"; do
        case "$a" in
            --confirm) confirmed=1 ;;
            --disconnect) disconnect=1 ;;
            *) die "unknown restore option: $a" ;;
        esac
    done
    echo "$path" | grep -qE '^(nightly|weekly|manual)/activepieces-[0-9]{8}T[0-9]{6}-[a-z0-9-]+\.dump$' \
        || die "not a backup path: $path"
    configure_remote
    wait_for_postgres
    db=$PGDATABASE; tmp_db="${db}__restoring"; old_db="${db}__before_restore"
    rclone lsf "$REMOTE$path" 2>/dev/null | grep -q . || die "backup not found: $path"
    if [ -z "$confirmed" ]; then
        warn_replace "$path"
        printf 'Type the database name (%s) to replace it: ' "$db"
        read -r answer || answer=
        [ "$answer" = "$db" ] || die "not confirmed; nothing changed"
    fi
    # Sessions of a just-stopped app can linger (a backend only notices a dead client when it next
    # writes). --disconnect, passed by restore.sh after it stopped the app, ends them; otherwise
    # remaining sessions mean the app is still running and the restore is refused.
    others=$(count_sessions "$db")
    if [ "$others" != 0 ] && [ -n "$disconnect" ]; then
        log "ending $others leftover session(s) on $db"
        terminate_sessions "$db"; sleep 2; others=$(count_sessions "$db")
    fi
    [ "$others" = 0 ] || die "$others other connection(s) to $db: stop activepieces (and ap-sync) first; restore.sh does this"

    mkdir -p "$WORK"; chmod 700 "$WORK"
    file="$WORK/restore.dump"
    log "downloading and decrypting $path"
    rclone copyto "$REMOTE$path" "$file" || die "download failed"
    pg_restore --list "$file" > /dev/null || die "downloaded file is not a readable archive (wrong BACKUP_PASSWORD/BACKUP_SALT?)"

    log "restoring into temporary database $tmp_db"
    psql_admin -c "DROP DATABASE IF EXISTS \"$tmp_db\"" -c "CREATE DATABASE \"$tmp_db\" OWNER \"$PGUSER\""
    if ! pg_restore --no-owner --exit-on-error --single-transaction --dbname="$tmp_db" "$file"; then
        psql_admin -c "DROP DATABASE IF EXISTS \"$tmp_db\"" || true
        rm -rf "$WORK"
        die "pg_restore failed; the current database was NOT changed"
    fi
    log "swapping databases: $db -> $old_db, $tmp_db -> $db"
    psql_admin -c "DROP DATABASE IF EXISTS \"$old_db\""
    [ -n "$disconnect" ] && terminate_sessions "$db"
    psql_admin -c "BEGIN" \
        -c "ALTER DATABASE \"$db\" RENAME TO \"$old_db\"" \
        -c "ALTER DATABASE \"$tmp_db\" RENAME TO \"$db\"" \
        -c "COMMIT" || die "database swap failed; $db is unchanged and the restored copy is in $tmp_db"
    rm -rf "$WORK"
    log "RESTORE OK: $path is now database $db (previous database kept as $old_db)"
}

cmd_setup() {
    umask 077
    mkdir -p "$(dirname "$RCLONE_CONFIG")"
    [ -n "${BACKUP_PASSWORD:-}" ] && [ -n "${BACKUP_SALT:-}" ] || die "BACKUP_PASSWORD and BACKUP_SALT must be set in .env"
    tmp="$RCLONE_CONFIG.new"
    case "$BACKUP_REMOTE_TYPE" in
        drive)
            cat <<'EOF'

Google Drive authorization
--------------------------
1. On any computer with a web browser, install rclone (https://rclone.org/install/), then run:

       rclone authorize "drive"

2. Sign in as the Google account that should hold the backups and allow access.
3. The terminal prints a token between two lines of arrows. Copy everything from the first {
   to the last } (one line), and paste it below. Input is hidden.

EOF
            printf 'Token: '
            stty -echo 2>/dev/null || true
            read -r token || token=
            stty echo 2>/dev/null || true
            echo
            echo "$token" | grep -q '"access_token"' && echo "$token" | grep -q '"refresh_token"' \
                || die "that does not look like an rclone token (expected JSON with access_token and refresh_token)"
            {
                echo "[base]"
                echo "type = drive"
                echo "scope = drive"
                echo "token = $token"
            } > "$tmp"
            ;;
        local)
            mkdir -p "$BACKUP_LOCAL_DIR"
            printf '[base]\ntype = local\n' > "$tmp"
            ;;
        *) die "BACKUP_REMOTE_TYPE must be drive or local" ;;
    esac
    {
        echo
        echo "[backup]"
        echo "type = crypt"
        echo "remote = $(base_path)"
        echo "filename_encryption = standard"
        echo "directory_name_encryption = true"
        echo "password = $(printf '%s' "$BACKUP_PASSWORD" | rclone obscure -)"
        echo "password2 = $(printf '%s' "$BACKUP_SALT" | rclone obscure -)"
    } >> "$tmp"
    chmod 600 "$tmp"
    RCLONE_CONFIG="$tmp" rclone mkdir "$(RCLONE_CONFIG="$tmp" base_path)" || { rm -f "$tmp"; die "could not reach the remote; check the token and try again"; }
    RCLONE_CONFIG="$tmp" rclone lsf "$REMOTE" > /dev/null || { rm -f "$tmp"; die "could not list the encrypted folder"; }
    mv "$tmp" "$RCLONE_CONFIG"
    log "rclone configured: encrypted backups go to '$(base_path)' (config $RCLONE_CONFIG, root-only)"
}

warn_replace() {
    cat <<EOF

  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  !!  RESTORE REPLACES THE CURRENT ACTIVEPIECES DATABASE ($PGDATABASE)
  !!  with backup: $1
  !!  Everything changed since that backup (flows, connections, runs, flow
  !!  store records) is lost. The current database is kept as
  !!  ${PGDATABASE}__before_restore until the next restore.
  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

EOF
}

base_path() {
    if [ "$BACKUP_REMOTE_TYPE" = local ]; then echo "base:$BACKUP_LOCAL_DIR/$BACKUP_DRIVE_FOLDER"
    else echo "base:$BACKUP_DRIVE_FOLDER"; fi
}

# The folder comes from .env on every run, so changing BACKUP_DRIVE_FOLDER needs no new setup.
configure_remote() {
    [ -s "$RCLONE_CONFIG" ] || die "rclone is not configured; run ./backup-setup.sh on the server"
    RCLONE_CONFIG_BACKUP_REMOTE=$(base_path)
    export RCLONE_CONFIG_BACKUP_REMOTE
}

wait_for_postgres() {
    i=0
    until pg_isready -q -t 2; do
        i=$((i + 1)); [ "$i" -lt 30 ] || fail "postgres at $PGHOST:$PGPORT is not reachable"
        sleep 2
    done
}

count_sessions() { psql_admin -tA -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$1' AND pid <> pg_backend_pid()"; }
terminate_sessions() { psql_admin -tA -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$1' AND pid <> pg_backend_pid()" > /dev/null; }
psql_admin() { PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 --dbname=postgres "$@"; }

locked() {
    exec 9> "$LOCK_FILE"
    waited=0
    until flock -n 9; do
        [ "$waited" -eq 0 ] && log "waiting for another backup/restore to finish"
        waited=$((waited + 5)); [ "$waited" -lt 3600 ] || die "another backup/restore has held the lock for an hour"
        sleep 5
    done
    "$@"
}

on_error() {
    rc=$?
    rm -rf "$WORK"
    [ "$rc" -ne 0 ] || return 0
    write_status failure "${FAIL_REASON:-$STEP failed}"
    log "BACKUP FAILED ($1): ${FAIL_REASON:-$STEP failed}" >&2
    exit "$rc"
}

fail() { FAIL_REASON="$1 (step: $STEP)"; exit 1; }
die() { log "ERROR: $*" >&2; exit 1; }
log() { echo "$(date '+%Y-%m-%d %H:%M:%S %Z') [backup] $*"; }

write_status() { # write_status success|failure <detail>
    mkdir -p "$(dirname "$STATUS_FILE")"
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    prev=$(cat "$STATUS_FILE" 2>/dev/null || true)
    get() { printf '%s\n' "$prev" | grep "^$1=" | head -n 1 | cut -d= -f2- || true; }
    if [ "$1" = success ]; then
        s_ts=$ts; s_file=$2; f_ts=$(get last_failure); f_reason=$(get last_failure_reason)
    else
        s_ts=$(get last_success); s_file=$(get last_success_file); f_ts=$ts; f_reason=$2
    fi
    cat > "$STATUS_FILE.tmp" <<EOF
last_run=$ts
last_result=$1
last_success=$s_ts
last_success_file=$s_file
last_failure=$f_ts
last_failure_reason=$f_reason
EOF
    chmod 644 "$STATUS_FILE.tmp"
    mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

strip0() { echo "$1" | sed 's/^0\([0-9]\)$/\1/'; }
sanitize_label() { echo "$1" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9-\n' '-' | cut -c1-40; }

# BACKUP_NOW_EPOCH exists only so tests can simulate dates; leave it unset in production.
now_epoch() { echo "${BACKUP_NOW_EPOCH:-$(date +%s)}"; }
now_date() { date -d "@$(now_epoch)" "$@"; }
now_stamp() { date -u -d "@$(now_epoch)" +%Y%m%dT%H%M%S; }

main "$@"
