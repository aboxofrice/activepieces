#!/usr/bin/env bash
# One-time setup of the warehouse Activepieces server. Runs INSIDE the installer image, so the host
# only needs Docker (Linux, Mac or Windows). Safe to re-run: existing secrets and the admin account
# are kept, the stack is (re)started and pieces are (re)installed.
#
# Host command (Linux/Mac; on Windows use e.g. -v C:\activepieces:/data):
#   docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock -v ~/activepieces:/data \
#     -e AP_FRONTEND_URL=http://<server-lan-ip>:8080 ghcr.io/aboxofrice/ap-installer:<tag> [command]
#
# Commands (default: install):
#   install          set up / upgrade / re-start the stack
#   --show-secrets   print the secrets block from .env again (changes nothing)
#   restore [path]   restore the database from a backup (restore.sh baked into this image)
#   backup-setup     one-time Google Drive authorization for backups (backup-setup.sh)
#
# Env:
#   AP_FRONTEND_URL   URL people use to reach it. Must also resolve from inside containers
#                     (file steps fetch it), so prefer the server's LAN IP. Required on first run.
#   AP_IMAGE          app image (default: the tag this installer was built with). Changing it on a
#                     re-run is an upgrade: a backup is taken first (when backups are set up).
#   AP_HTTP_PORT      port (default 8080)
#   AP_EDITION        ce (default) or ee. Saved to .env; pass it again on a re-run to switch. In ee
#                     mode every run hides the pieces in hidden-pieces.txt (never one a flow uses).
#                     EE is for this dev/test server only (see packages/ee/LICENSE); no license key
#                     is set and no paid features are switched on.
#   ADMIN_EMAIL       admin login (default admin@warehouse.local)
#   GHCR_USER / GHCR_TOKEN   registry login for private images
#   COMPOSE_PROJECT_NAME     stack name (default activepieces); lets a test copy run beside it
#   Optional, saved to .env when given (first run or re-run; see compose.ap-sync.yml / compose.backup.yml):
#     GITHUB_TOKEN (fine-grained, read-only "Contents: Read" on the flows repo; ap-sync only pulls)
#     FLOWS_REPO_URL FLOWS_BRANCH AP_DEPLOY_TARGET SYNC_INTERVAL_MINUTES SYNC_HEALTHCHECK_URL
#     AP_SYNC_IMAGE AP_BACKUP_IMAGE BACKUP_REMOTE_TYPE BACKUP_TIME BACKUP_DRIVE_FOLDER
#     BACKUP_KEEP_NIGHTLY BACKUP_KEEP_WEEKLY BACKUP_KEEP_MANUAL BACKUP_WEEKLY_DAY HEALTHCHECK_URL
set -euo pipefail

TEMPLATE_DIR=${TEMPLATE_DIR:-$(cd "$(dirname "$0")" && pwd)}
DATA_DIR=${DATA_DIR:-/data}
export DATA_DIR
ENV_FILE=$DATA_DIR/.env
PIECES_FILE=$DATA_DIR/pieces.txt
HIDDEN_PIECES_FILE=$DATA_DIR/hidden-pieces.txt
# Written once the secrets block has been shown at the end of a successful run. Until then every
# run shows it again, so a first run that fails half-way never loses the only copy of the secrets.
SECRETS_ACK=$DATA_DIR/.secrets-acknowledged

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
# Settings an installer run may pass with -e and that must survive into .env for the helper services.
PASSTHROUGH_VARS="GITHUB_TOKEN FLOWS_REPO_URL FLOWS_BRANCH AP_DEPLOY_TARGET SYNC_INTERVAL_MINUTES
AP_SYNC_IMAGE AP_BACKUP_IMAGE BACKUP_REMOTE_TYPE BACKUP_TIME BACKUP_DRIVE_FOLDER
BACKUP_KEEP_NIGHTLY BACKUP_KEEP_WEEKLY BACKUP_KEEP_MANUAL BACKUP_WEEKLY_DAY HEALTHCHECK_URL SYNC_HEALTHCHECK_URL"
# AP_* keys docker-compose.yml passes to the app; any other AP_* key in .env is ignored there.
APP_ENV_KEYS=" AP_PORT AP_FRONTEND_URL AP_EDITION AP_ENVIRONMENT AP_EXECUTION_MODE AP_ENCRYPTION_KEY AP_JWT_SECRET
AP_POSTGRES_DATABASE AP_POSTGRES_HOST AP_POSTGRES_PORT AP_POSTGRES_USERNAME AP_POSTGRES_PASSWORD AP_REDIS_HOST
AP_REDIS_PORT AP_TELEMETRY_ENABLED AP_TRIGGER_DEFAULT_POLL_INTERVAL AP_WORKER_CONCURRENCY AP_REUSE_SANDBOX
AP_FLOW_TIMEOUT_SECONDS AP_WEBHOOK_TIMEOUT_SECONDS AP_IMAGE AP_HTTP_PORT AP_SYNC_IMAGE AP_BACKUP_IMAGE AP_DEPLOY_TARGET "

rand_hex() { openssl rand -hex "$1"; }
rand_pw() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
# .env values follow docker compose's dotenv rules: plain, '...' (literal) or "..." (\" \\ escapes,
# $$ for a literal $). env_get decodes them, env_set writes the form that keeps the value intact.
env_get() {
    ENV_KEY=$1 python3 - "$ENV_FILE" <<'PY'
import os, re, sys
key = os.environ['ENV_KEY']
try:
    lines = open(sys.argv[1], encoding='utf-8').read().splitlines()
except OSError:
    lines = []
for line in lines:
    if line.startswith(key + '='):
        v = line[len(key) + 1:]
        if len(v) >= 2 and v[0] == v[-1] == "'":
            v = v[1:-1]
        elif len(v) >= 2 and v[0] == v[-1] == '"':
            v = re.sub(r'\\(.)', r'\1', v[1:-1]).replace('$$', '$')
        else:
            v = re.split(r'\s+#', v, 1)[0].strip()
        sys.stdout.write(v)
        break
PY
}
# Replace or append KEY=VALUE without ever leaving a truncated .env: the new file is written next to
# it (mode 600) and renamed over it; the previous version is kept as .env.bak. The value travels in
# the environment, so no shell quoting rules can mangle it.
env_set() {
    grep -qE "^$1=" "$ENV_FILE" && [ "$(env_get "$1")" = "$2" ] && return 0
    case "$2" in *$'\n'*) die "$1 must be a single line" ;; esac
    local tmp="$ENV_FILE.tmp.$$"
    ENV_KEY=$1 ENV_VALUE=$2 python3 - "$ENV_FILE" "$tmp" <<'PY'
import os, re, sys
src, dst = sys.argv[1:]
key, value = os.environ['ENV_KEY'], os.environ['ENV_VALUE']
if re.fullmatch(r'[A-Za-z0-9_./:@,+=%-]*', value):
    encoded = value
elif "'" not in value:
    encoded = f"'{value}'"
else:
    encoded = '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('$', '$$') + '"'
out, done = [], False
with open(src, encoding='utf-8') as f:
    for line in f.read().splitlines():
        if line.startswith(key + '='):
            if not done:
                out.append(f'{key}={encoded}')
                done = True
            continue
        out.append(line)
if not done:
    out.append(f'{key}={encoded}')
fd = os.open(dst, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out) + '\n')
PY
    cp -p "$ENV_FILE" "$ENV_FILE.bak"
    mv -f "$tmp" "$ENV_FILE"
}
# Since the app no longer reads .env wholesale, extra AP_* settings there are silently ignored.
warn_unused_app_keys() {
    local key known unused=''
    # shellcheck disable=SC2086
    known=" $(echo $APP_ENV_KEYS) "
    for key in $(grep -oE '^AP_[A-Z0-9_]+' "$ENV_FILE" | sort -u); do
        case "$known" in *" $key "*) ;; *) unused="$unused $key" ;; esac
    done
    if [ -n "$unused" ]; then
        echo "WARNING: .env has AP_* settings the app no longer receives:$unused"
        echo "         Move them to $DATA_DIR/app.env (same KEY=value format) and re-run the installer."
    fi
    # docker-compose.yml's environment: wins over env_file, so app.env cannot change these.
    local shadowed=''
    if [ -f "$DATA_DIR/app.env" ]; then
        for key in $(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "$DATA_DIR/app.env" | sort -u); do
            case "$known TZ " in *" $key "*) shadowed="$shadowed $key" ;; esac
        done
    fi
    [ -z "$shadowed" ] && return 0
    echo "WARNING: app.env sets$shadowed, which docker-compose.yml already sets; app.env cannot override them."
    echo "         Change them in .env instead."
}
compose() {
    local files=(-f "$DATA_DIR/docker-compose.yml")
    for extra in "$DATA_DIR"/compose.*.yml; do [ -f "$extra" ] && files+=(-f "$extra"); done
    docker compose --project-directory "$DATA_DIR" --env-file "$ENV_FILE" "${files[@]}" "$@"
}

preflight() {
    [ -d "$DATA_DIR" ] || die "Mount a host folder at $DATA_DIR (-v <host-folder>:$DATA_DIR)"
    docker info >/dev/null 2>&1 || die "No Docker access. Mount the socket: -v /var/run/docker.sock:/var/run/docker.sock"
}

copy_templates() {
    # Compose files and the piece list ship with the installer image; refresh them on every run so
    # a newer installer brings its stack definition along. .env and app.env are never touched here.
    log "Writing stack files to $DATA_DIR"
    cp "$TEMPLATE_DIR"/docker-compose.yml "$DATA_DIR"/
    for f in "$TEMPLATE_DIR"/compose.*.yml; do [ -f "$f" ] && cp "$f" "$DATA_DIR"/; done
    cp "$TEMPLATE_DIR"/pieces.txt "$TEMPLATE_DIR"/hidden-pieces.txt "$DATA_DIR"/
    # Older installers copied restore.sh / backup-setup.sh here. Remove them: scripts that drive the
    # Docker socket must come from the installer image, not from a writable data folder.
    rm -f "$DATA_DIR/restore.sh" "$DATA_DIR/backup-setup.sh"
    return 0
}

check_edition() {
    case "$1" in
        ce|ee) ;;
        *) die "AP_EDITION must be ce or ee, got '$1'" ;;
    esac
}

write_env() {
    local port=${AP_HTTP_PORT:-8080}
    [ -z "${AP_EDITION:-}" ] || check_edition "$AP_EDITION"
    if [ ! -f "$ENV_FILE" ]; then
        [ -n "${AP_FRONTEND_URL:-}" ] || die "Set AP_FRONTEND_URL on first run, e.g. -e AP_FRONTEND_URL=http://192.168.1.50:$port"
        [ -n "${AP_IMAGE:-${DEFAULT_AP_IMAGE:-}}" ] || die "No app image: pass -e AP_IMAGE=ghcr.io/aboxofrice/activepieces:<sha> (this installer was built without one)"
        log "Generating .env with fresh secrets"
        rm -f "$SECRETS_ACK"
        umask 077
        cat > "$ENV_FILE.tmp" <<EOF
# Generated by the installer on $(date -u +%Y-%m-%dT%H:%M:%SZ). Never commit or share this file.
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-activepieces}
AP_IMAGE=${AP_IMAGE:-$DEFAULT_AP_IMAGE}
AP_HTTP_PORT=$port
AP_FRONTEND_URL=$AP_FRONTEND_URL
AP_EDITION=${AP_EDITION:-ce}
AP_ENVIRONMENT=prod
AP_EXECUTION_MODE=SANDBOX_CODE_ONLY
AP_ENCRYPTION_KEY=$(rand_hex 16)
AP_JWT_SECRET=$(rand_hex 32)
AP_POSTGRES_DATABASE=activepieces
AP_POSTGRES_HOST=postgres
AP_POSTGRES_PORT=5432
AP_POSTGRES_USERNAME=postgres
AP_POSTGRES_PASSWORD=$(rand_hex 32)
AP_REDIS_HOST=redis
AP_REDIS_PORT=6379
AP_TELEMETRY_ENABLED=false
AP_TRIGGER_DEFAULT_POLL_INTERVAL=5
AP_WORKER_CONCURRENCY=25
AP_REUSE_SANDBOX=true
AP_FLOW_TIMEOUT_SECONDS=600
AP_WEBHOOK_TIMEOUT_SECONDS=30
TZ=${TZ:-America/New_York}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@warehouse.local}
ADMIN_PASSWORD=$(rand_pw 24)
BACKUP_PASSWORD=$(rand_pw 32)
BACKUP_SALT=$(rand_pw 32)
EOF
        mv "$ENV_FILE.tmp" "$ENV_FILE"
    else
        log "Keeping existing .env"
        [ -n "${AP_IMAGE:-}" ] && env_set AP_IMAGE "$AP_IMAGE"
        [ -n "${AP_HTTP_PORT:-}" ] && env_set AP_HTTP_PORT "$AP_HTTP_PORT"
        [ -n "${AP_FRONTEND_URL:-}" ] && env_set AP_FRONTEND_URL "$AP_FRONTEND_URL"
        if [ -n "${AP_EDITION:-}" ] && [ "$(env_get AP_EDITION)" != "$AP_EDITION" ]; then
            log "Switching AP_EDITION from $(env_get AP_EDITION) to $AP_EDITION"
            env_set AP_EDITION "$AP_EDITION"
        fi
    fi
    local var
    for var in $PASSTHROUGH_VARS; do
        [ -n "${!var:-}" ] && env_set "$var" "${!var}"
    done
    chmod 600 "$ENV_FILE" "$ENV_FILE.bak" 2>/dev/null || true
    warn_unused_app_keys
    # Shown right away (and again at the end) until a run completes, see SECRETS_ACK.
    [ -f "$SECRETS_ACK" ] || print_secrets
}

registry_login() {
    if [ -n "${GHCR_TOKEN:-}" ]; then
        log "Logging in to ghcr.io"
        printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-aboxofrice}" --password-stdin
    fi
}

start_stack() {
    log "Pulling images"
    # Always pull: a re-pushed tag must not be ignored because an older copy exists locally. A
    # failed pull (offline, image only built locally) is not fatal; `up` fails if one is missing.
    compose pull --ignore-pull-failures || true
    if upgrade_pending; then
        backup_before_upgrade
    fi
    log "Starting the stack"
    compose up -d --remove-orphans
}

# True when the app container exists and runs a different image than the one about to start.
OLD_IMAGE=
upgrade_pending() {
    local cid running wanted
    cid=$(compose ps -a -q activepieces 2>/dev/null | head -1)
    [ -n "$cid" ] || return 1
    # Roll back to the exact image running now: its registry digest (repo@sha256:...), since the
    # tag it was started from may have been re-pushed; the tag only when there is no digest (local build).
    OLD_IMAGE=$(docker inspect -f '{{.Image}}' "$cid" 2>/dev/null | xargs -r docker image inspect -f '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' 2>/dev/null) || true
    [ -n "$OLD_IMAGE" ] || OLD_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$cid" 2>/dev/null) || true
    running=$(docker inspect -f '{{.Image}}' "$cid" 2>/dev/null) || return 1
    wanted=$(docker image inspect -f '{{.Id}}' "$(env_get AP_IMAGE)" 2>/dev/null) || return 1
    [ "$running" != "$wanted" ]
}

# Starting a new image runs its database migrations, which cannot be undone without a backup.
backup_before_upgrade() {
    log "New Activepieces image: taking a backup before its database migrations run"
    local rc=0 stay="re-run the installer with -e AP_IMAGE=${OLD_IMAGE:-<previous image>} to stay on the current version"
    # Exit 3 = the check ran and found no rclone config. Any other failure (image missing, Docker
    # error) means we do not know, so stop rather than upgrade without a backup. (3, not 1: compose
    # itself exits 1 on its own errors.)
    compose run --rm --no-deps -T --entrypoint sh backup -c 'test -s "$RCLONE_CONFIG" || exit 3' </dev/null >/dev/null 2>&1 || rc=$?
    case "$rc" in
        0) ;;
        3) echo "WARNING: backups are not set up (run the installer with 'backup-setup'); upgrading WITHOUT a backup."
           return 0 ;;
        *) die "Could not check the backup setup (exit $rc); nothing was upgraded. Fix it and re-run, or $stay." ;;
    esac
    compose up -d postgres
    compose run --rm -T backup now pre-upgrade </dev/null \
        || die "Pre-upgrade backup failed; nothing was upgraded. Fix the backup (see the log above) and re-run, or $stay."
}

# The installer reaches the app over the stack's network, so it works the same on every host OS.
API_BASE=
attach_to_stack() {
    local net out
    net="$(env_get COMPOSE_PROJECT_NAME)_default"
    if [ -f /.dockerenv ]; then
        if ! out=$(docker network connect "$net" "$(hostname)" 2>&1); then
            case "$out" in
                *"already exists"*) ;;
                *) die "Could not join the stack network $net: $out" ;;
            esac
        fi
        API_BASE="http://activepieces:$(env_get AP_HTTP_PORT)/api"
    else
        API_BASE="http://localhost:$(env_get AP_HTTP_PORT)/api"
    fi
    log "Waiting for Activepieces"
    for _ in $(seq 1 120); do
        curl -fsS "$API_BASE/v1/flags" >/dev/null 2>&1 && return
        sleep 5
    done
    die "Activepieces did not come up; check: docker logs $(env_get COMPOSE_PROJECT_NAME)-activepieces-1"
}

# api METHOD PATH [JSON] -> body; uses $TOKEN when set. The body goes in on stdin and the
# Authorization header through a 0600 file, so neither the password nor the token shows up in `ps`.
# Fails (non-zero) on an HTTP error, keeping the body for the caller's message, and on a timeout or
# lost connection, which it reports itself. Callers check the body, so they call it with `|| true`.
API_MAX_TIME=${API_MAX_TIME:-300}
WORK_DIR=$(mktemp -d)
chmod 700 "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT
api() {
    local hdr="$WORK_DIR/headers"
    ( umask 077; printf 'Content-Type: application/json\n' > "$hdr"
      [ -n "${TOKEN:-}" ] && printf 'Authorization: Bearer %s\n' "$TOKEN" >> "$hdr"; true )
    local rc=0
    printf '%s' "${3:-}" | curl -s --fail-with-body --connect-timeout 10 --max-time "$API_MAX_TIME" \
        -X "$1" "$API_BASE$2" -H @"$hdr" ${3:+--data-binary @-} || rc=$?
    case "$rc" in
        0|22) ;;
        28) printf 'ERROR: %s %s: no answer from Activepieces within %ss\n' "$1" "$2" "$API_MAX_TIME" >&2 ;;
        *) printf 'ERROR: %s %s: could not reach Activepieces at %s (curl exit %s)\n' "$1" "$2" "$API_BASE" "$rc" >&2 ;;
    esac
    return "$rc"
}

json_field() {
    python3 -c 'import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    d = None
print((d.get(sys.argv[1]) if isinstance(d, dict) else None) or "")' "$1"
}

# json_obj field=VARNAME ... | field:=json-literal ...  -> JSON object. Built by python so any
# character is escaped correctly; values are read from the environment, never from argv.
json_obj() {
    local spec
    for spec in "$@"; do case "$spec" in *:=*) ;; *) export "${spec#*=}" ;; esac; done
    python3 -c '
import json, os, sys
out = {}
for spec in sys.argv[1:]:
    if ":=" in spec:
        k, v = spec.split(":=", 1); out[k] = json.loads(v)
    else:
        k, v = spec.split("=", 1); out[k] = os.environ[v]
print(json.dumps(out))' "$@"
}

ensure_admin() {
    local res user_created
    ADMIN_EMAIL_V=$(env_get ADMIN_EMAIL); ADMIN_PASSWORD_V=$(env_get ADMIN_PASSWORD)
    res=$(api POST /v1/authentication/sign-in "$(json_obj email=ADMIN_EMAIL_V password=ADMIN_PASSWORD_V)") || true
    if [ -z "$(printf '%s' "$res" | json_field token)" ]; then
        # USER_CREATED is stored only once the first user exists: absent on a fresh server means
        # False. Only flags that cannot be read at all are an error.
        user_created=$(api GET /v1/flags | python3 -c 'import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    d = None
print("" if not isinstance(d, dict) else "True" if d.get("USER_CREATED") is True else "False")') || true
        [ -n "$user_created" ] || die "Sign-in as $ADMIN_EMAIL_V failed and the server flags could not be read. Server said: $res"
        if [ "$user_created" = True ]; then
            die "Sign-in as $ADMIN_EMAIL_V failed, but this server already has a user, so no new admin is created.
  If the admin password was changed in the web UI, put the current password in ADMIN_PASSWORD in
  $ENV_FILE (wrap it in single quotes if it contains \$, # or spaces) and re-run the installer;
  ap-sync signs in with the same value. Community edition has no password reset: if the password is
  lost, restore a backup or ask for help resetting it in the database.
  Server said: $res"
        fi
        log "Creating admin user $ADMIN_EMAIL_V"
        res=$(api POST /v1/authentication/sign-up "$(json_obj email=ADMIN_EMAIL_V password=ADMIN_PASSWORD_V \
            firstName:='"Warehouse"' lastName:='"Admin"' trackEvents:=false newsLetter:=false)") || true
    fi
    TOKEN=$(printf '%s' "$res" | json_field token)
    PLATFORM_ID=$(printf '%s' "$res" | json_field platformId)
    [ -n "$TOKEN" ] || die "Could not create or sign in as $ADMIN_EMAIL_V: $res"
    # Community/EE sign-up of the first user only creates the login and returns an onboarding token
    # (no project); the platform is created in a second call, as the web onboarding does.
    if [ -z "$(printf '%s' "$res" | json_field projectId)" ]; then
        log "Creating the platform"
        res=$(api POST /v1/platforms '{"name":"Warehouse"}') || true
        TOKEN=$(printf '%s' "$res" | json_field token)
        PLATFORM_ID=$(printf '%s' "$res" | json_field platformId)
        [ -n "$(printf '%s' "$res" | json_field projectId)" ] || die "Could not create the platform: $res"
    fi
}

install_pieces() {
    [ -f "$PIECES_FILE" ] || return 0
    log "Installing pieces"
    local PIECE_NAME PIECE_VERSION res
    while read -r PIECE_NAME PIECE_VERSION _; do
        case "$PIECE_NAME" in ''|\#*) continue ;; esac
        res=$(api POST /v1/pieces "$(json_obj packageType:='"REGISTRY"' scope:='"PLATFORM"' \
            pieceName=PIECE_NAME pieceVersion=PIECE_VERSION)") || true
        if printf '%s' "$res" | grep -q '"name"'; then echo "  ok  $PIECE_NAME@$PIECE_VERSION"; else echo "  !!  $PIECE_NAME@$PIECE_VERSION: $res"; fi
    done < "$PIECES_FILE"
}

# EE only: piece filtering lives in ee/pieces/filters, Community ignores the platform setting.
# The whole list is re-applied every run, so removing a line shows that piece again (and a change
# made in the UI's piece settings is replaced). Pieces stay installed; they are only hidden.
apply_hidden_pieces() {
    [ "$(env_get AP_EDITION)" = ee ] || return 0
    [ -f "$HIDDEN_PIECES_FILE" ] || return 0
    if [ -z "${PLATFORM_ID:-}" ]; then
        warn "No platform id from sign-in; pieces were not hidden"
        return 0
    fi
    log "Hiding pieces listed in hidden-pieces.txt"
    local used="$WORK_DIR/used-pieces" body res count
    # A hidden piece cannot be loaded, so a flow using it would break: collect every piece any
    # flow version of this platform references (all versions, not only the published ones, and
    # flows made while the server ran Community too). The SQL goes in on stdin so psql's :'pid'
    # quotes the id.
    if ! compose exec -T postgres psql -X -A -t -v ON_ERROR_STOP=1 -v pid="$PLATFORM_ID" \
        -U "$(env_get AP_POSTGRES_USERNAME)" -d "$(env_get AP_POSTGRES_DATABASE)" > "$used" <<'SQL'
SELECT DISTINCT p #>> '{}'
FROM flow_version fv
JOIN flow f ON f.id = fv."flowId"
JOIN project pr ON pr.id = f."projectId"
CROSS JOIN LATERAL jsonb_path_query(fv.trigger, 'lax $.**.pieceName') AS p
WHERE pr."platformId" = :'pid' AND fv.trigger IS NOT NULL AND jsonb_typeof(p) = 'string';
SQL
    then
        warn "Could not list the pieces flows use; pieces were not hidden this run"
        return 0
    fi
    if ! body=$(python3 "$TEMPLATE_DIR/hidden_pieces.py" "$HIDDEN_PIECES_FILE" "$used"); then
        warn "Could not read $HIDDEN_PIECES_FILE; pieces were not hidden this run"
        return 0
    fi
    res=$(api POST "/v1/platforms/$PLATFORM_ID" "$body") || true
    count=$(printf '%s' "$res" | python3 -c 'import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    d = None
names = d.get("filteredPieceNames") if isinstance(d, dict) else None
print(len(names) if isinstance(names, list) and d.get("filteredPieceBehavior") == "BLOCKED" else "")')
    if [ -z "$count" ]; then
        warn "Could not update the platform's hidden pieces (left as they were): $res"
        return 0
    fi
    echo "  $count pieces hidden"
}

print_secrets() {
    cat <<EOF

=====================================================================
 SAVE THIS BLOCK IN YOUR PASSWORD MANAGER (e.g. Bitwarden secure note
 "Warehouse Activepieces"). Shown on every run until one finishes;
 print it again any time with the installer's --show-secrets.
 Losing AP_ENCRYPTION_KEY makes every saved connection unreadable.
 Losing BACKUP_PASSWORD/BACKUP_SALT makes the Drive backups unreadable.
---------------------------------------------------------------------
URL:                $(env_get AP_FRONTEND_URL)
ADMIN_EMAIL:        $(env_get ADMIN_EMAIL)
ADMIN_PASSWORD:     $(env_get ADMIN_PASSWORD)
AP_ENCRYPTION_KEY:  $(env_get AP_ENCRYPTION_KEY)
BACKUP_PASSWORD:    $(env_get BACKUP_PASSWORD)
BACKUP_SALT:        $(env_get BACKUP_SALT)
=====================================================================
EOF
}

finish() {
    if [ ! -f "$SECRETS_ACK" ]; then
        print_secrets
        date -u +%Y-%m-%dT%H:%M:%SZ > "$SECRETS_ACK"
    fi
    log "Done: $(env_get AP_FRONTEND_URL)"
}

cmd=${1:-install}
[ $# -gt 0 ] && shift
case "$cmd" in
    install)
        preflight
        copy_templates
        write_env
        registry_login
        start_stack
        attach_to_stack
        ensure_admin
        # First thing after sign-in: after a ce->ee switch an older filter may still name pieces
        # that flows made on Community use; this re-computes it before anything else is done.
        apply_hidden_pieces
        install_pieces
        finish
        ;;
    --show-secrets|show-secrets)
        [ -f "$ENV_FILE" ] || die "$ENV_FILE not found; run the installer first"
        print_secrets
        ;;
    restore) preflight; exec "$TEMPLATE_DIR/restore.sh" "$@" ;;
    backup-setup) preflight; exec "$TEMPLATE_DIR/backup-setup.sh" "$@" ;;
    -h|--help|help) sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//' ;;
    *) die "unknown command: $cmd (install | --show-secrets | restore [path] | backup-setup | --help)" ;;
esac
