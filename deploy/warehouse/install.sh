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
#   AP_ENCRYPTION_KEY BACKUP_PASSWORD BACKUP_SALT ADMIN_PASSWORD
#                     first run only, to set up a copy that restores another server's backups (see
#                     README "Restore a warehouse backup on another machine"): used instead of fresh
#                     values and never printed. Ignored, with a warning, once .env exists.
#   GHCR_USER / GHCR_TOKEN   login for the private ghcr.io images: GitHub user (default aboxofrice)
#                     and a classic token with read:packages only. Any run; saved to .env, never
#                     printed. Without them, images already on this machine still work.
#   COMPOSE_PROJECT_NAME     stack name (default activepieces); lets a test copy run beside it
#   Optional, saved to .env when given (first run or re-run; see compose.ap-sync.yml / compose.backup.yml):
#     GITHUB_TOKEN (fine-grained, read-only "Contents: Read" on the flows repo; ap-sync only pulls)
#     FLOWS_REPO_URL FLOWS_BRANCH AP_DEPLOY_TARGET AP_DEPLOY_BASE_URL SYNC_INTERVAL_MINUTES
#     SYNC_HEALTHCHECK_URL AP_SYNC_IMAGE AP_BACKUP_IMAGE BACKUP_REMOTE_TYPE BACKUP_TIME
#     BACKUP_DRIVE_FOLDER BACKUP_KEEP_NIGHTLY BACKUP_KEEP_WEEKLY BACKUP_KEEP_MANUAL
#     BACKUP_KEEP_PRE_UPGRADE BACKUP_KEEP_PRE_RESTORE BACKUP_WEEKLY_DAY HEALTHCHECK_URL
#   Every image the stack uses must be pullable or already on this machine, otherwise the installer
#   stops before starting anything. A helper image whose revision label differs from the one this
#   installer was built for is reported (warning only).
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
# Names (never values) of the secrets a first run took from -e instead of generating; the secrets
# block does not show those.
SECRETS_GIVEN=$DATA_DIR/.secrets-given
# First line of every compose.*.yml this installer ships; such a file in the data folder that the
# installer no longer ships is removed. Files without it (your own overrides) are never touched.
MANAGED_MARKER='# managed-by: ap-installer'

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
# Settings an installer run may pass with -e and that must survive into .env for the helper services.
PASSTHROUGH_VARS="GHCR_USER GHCR_TOKEN GITHUB_TOKEN FLOWS_REPO_URL FLOWS_BRANCH AP_DEPLOY_TARGET AP_DEPLOY_BASE_URL SYNC_INTERVAL_MINUTES
AP_SYNC_IMAGE AP_BACKUP_IMAGE BACKUP_REMOTE_TYPE BACKUP_TIME BACKUP_DRIVE_FOLDER
BACKUP_KEEP_NIGHTLY BACKUP_KEEP_WEEKLY BACKUP_KEEP_MANUAL BACKUP_KEEP_PRE_UPGRADE BACKUP_KEEP_PRE_RESTORE
BACKUP_WEEKLY_DAY HEALTHCHECK_URL SYNC_HEALTHCHECK_URL"
# Secrets a first run may take from -e (restoring another server's backups) instead of generating.
GIVEN_SECRET_VARS="AP_ENCRYPTION_KEY BACKUP_PASSWORD BACKUP_SALT ADMIN_PASSWORD"
# AP_* keys docker-compose.yml passes to the app; any other AP_* key in .env is ignored there.
APP_ENV_KEYS=" AP_PORT AP_FRONTEND_URL AP_EDITION AP_ENVIRONMENT AP_EXECUTION_MODE AP_ENCRYPTION_KEY AP_JWT_SECRET
AP_POSTGRES_DATABASE AP_POSTGRES_HOST AP_POSTGRES_PORT AP_POSTGRES_USERNAME AP_POSTGRES_PASSWORD AP_REDIS_HOST
AP_REDIS_PORT AP_TELEMETRY_ENABLED AP_TRIGGER_DEFAULT_POLL_INTERVAL AP_WORKER_CONCURRENCY AP_REUSE_SANDBOX
AP_FLOW_TIMEOUT_SECONDS AP_WEBHOOK_TIMEOUT_SECONDS AP_IMAGE AP_HTTP_PORT AP_SYNC_IMAGE AP_BACKUP_IMAGE AP_DEPLOY_TARGET
AP_DEPLOY_BASE_URL "

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
    local f
    for f in "$DATA_DIR"/compose.*.yml; do
        [ -f "$f" ] && [ ! -f "$TEMPLATE_DIR/${f##*/}" ] || continue
        head -n 1 "$f" | grep -qF "$MANAGED_MARKER" || continue
        echo "  removing ${f##*/} (no longer part of this installer's stack)"
        rm -f "$f"
    done
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
        check_given_secrets
        log "Generating .env with fresh secrets"
        rm -f "$SECRETS_ACK" "$SECRETS_GIVEN"
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
        apply_given_secrets
    else
        log "Keeping existing .env"
        warn_ignored_secrets
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

# A first run may take the secrets of another server (to restore its backups) instead of generating
# them. Values are checked here and written by env_set; they are never echoed.
check_given_secrets() {
    if [ -n "${AP_ENCRYPTION_KEY:-}" ]; then
        printf '%s' "$AP_ENCRYPTION_KEY" | grep -qE '^[0-9a-fA-F]{32}$' \
            || die "AP_ENCRYPTION_KEY must be 32 hex characters (as in the other server's secrets block); nothing was written"
    fi
    local var pw=0 salt=0
    [ -n "${BACKUP_PASSWORD:-}" ] && pw=1
    [ -n "${BACKUP_SALT:-}" ] && salt=1
    [ "$pw" = "$salt" ] || die "Pass BACKUP_PASSWORD and BACKUP_SALT together (backups need both to decrypt); nothing was written"
    for var in $GIVEN_SECRET_VARS; do
        case "${!var:-}" in *$'\n'*) die "$var must be a single line; nothing was written" ;; esac
    done
}
apply_given_secrets() {
    local var given=''
    for var in $GIVEN_SECRET_VARS; do
        [ -n "${!var:-}" ] || continue
        env_set "$var" "${!var}"
        given="$given $var"
    done
    [ -n "$given" ] || return 0
    rm -f "$ENV_FILE.bak"
    ( umask 077; printf '%s\n' $given > "$SECRETS_GIVEN" )
    echo "  taken from -e instead of generated:$given"
}
warn_ignored_secrets() {
    local var ignored=''
    for var in $GIVEN_SECRET_VARS; do
        [ -n "${!var:-}" ] && [ "$(env_get "$var")" != "${!var}" ] && ignored="$ignored $var"
    done
    [ -z "$ignored" ] && return 0
    warn "ignored$ignored: they are read on a first run only, and .env already exists. To change one, edit $ENV_FILE by hand (changing AP_ENCRYPTION_KEY makes saved connections unreadable)."
}

# The token comes from .env (saved there by write_env when given with -e). The login lives in a
# Docker config inside WORK_DIR, deleted when the run ends. A failed login is not fatal: images
# already on this machine still work, and pull_images names any that are missing.
REGISTRY_LOGIN=
registry_login() {
    local token user
    token=$(env_get GHCR_TOKEN); user=$(env_get GHCR_USER)
    [ -n "$token" ] || return 0
    log "Logging in to ghcr.io as ${user:-aboxofrice}"
    export DOCKER_CONFIG="$WORK_DIR/docker"
    mkdir -p "$DOCKER_CONFIG"
    if printf '%s' "$token" | docker login ghcr.io -u "${user:-aboxofrice}" --password-stdin >/dev/null 2>"$WORK_DIR/login.err"; then
        REGISTRY_LOGIN=ok
    else
        REGISTRY_LOGIN=failed
        warn "ghcr.io login failed ($(grep . "$WORK_DIR/login.err" | tail -n 1)). GHCR_TOKEN may be expired or lack read:packages; pass a new one with -e GHCR_TOKEN=..."
    fi
}

# Always pull: a re-pushed tag must not be ignored because an older copy exists locally. A failed
# pull is fine when the image is on this machine (offline, built locally) and said so; an image
# that is neither pullable nor present stops the run before anything is started.
pull_images() {
    log "Pulling images"
    local svc image err missing='' images="$WORK_DIR/images"
    service_images > "$images" || die "Could not read the stack's compose files (see above); nothing was started."
    while read -r svc image; do
        [ -n "$image" ] || continue
        if docker pull -q "$image" </dev/null >/dev/null 2>"$WORK_DIR/pull.err"; then
            echo "  pulled  $image"
        elif docker image inspect "$image" >/dev/null 2>&1; then
            echo "  local   $image (could not pull it; using the copy on this machine, not checked against the registry)"
        else
            err=$(grep . "$WORK_DIR/pull.err" | tail -n 1)
            missing="$missing
  $svc: $image  (setting $(image_setting "$svc"); pull said: ${err:-nothing})"
            continue
        fi
        case "$svc" in ap-sync|backup) check_helper_revision "$image" ;; esac
    done < "$images"
    [ -z "$missing" ] && return 0
    local hint
    case "$REGISTRY_LOGIN" in
        ok) hint="Logged in to ghcr.io, so the tag may not be published yet, or the token's user cannot read that package." ;;
        failed) hint="The ghcr.io login failed (see the warning above): pass a valid token with -e GHCR_TOKEN=..." ;;
        *) hint="No GHCR_TOKEN is set and the ghcr.io images are private: pass -e GHCR_USER=<github user>
-e GHCR_TOKEN=<classic token with read:packages only> (saved to .env for later runs)." ;;
    esac
    die "These images could not be pulled and are not on this machine:$missing
Nothing was started. $hint
Otherwise check the network, publish the missing tag, or point the setting at an image that exists."
}

# "service image" per line, from the merged compose config (so .env overrides are applied). Piped,
# not saved: the resolved config holds the secrets. pipefail makes a compose error fail this.
service_images() {
    compose config --format json | python3 -c 'import json, sys
for name, svc in sorted(json.load(sys.stdin).get("services", {}).items()):
    print(name, svc.get("image", ""))'
}

image_setting() {
    case "$1" in
        activepieces) echo AP_IMAGE ;;
        ap-sync) echo AP_SYNC_IMAGE ;;
        backup) echo AP_BACKUP_IMAGE ;;
        *) echo "in a compose file" ;;
    esac
}

# Helper images are pinned by tag, so a tag rebuilt locally from other code would run silently.
# Their OCI revision label is compared with the revision this installer was built for.
check_helper_revision() {
    local want=${HELPER_REVISION:-} have
    case "$want" in ''|unknown) return 0 ;; esac
    have=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$1" 2>/dev/null) || return 0
    case "$have" in
        ''|'<no value>'|unknown)
            warn "$1 has no source revision label, so it cannot be checked against this installer (built for $want).
         Pull the published tag, or rebuild it with --build-arg REVISION=$want." ;;
        "$want"*) ;;
        *) case "$want" in "$have"*) return 0 ;; esac
           warn "$1 was built from revision $have, but this installer expects $want.
         The tag was rebuilt from other code; pull the published tag or rebuild it from $want." ;;
    esac
}

# Until the admin exists anyone who reaches the port could sign up as the first user, so a first
# run publishes the port on this host only (127.0.0.1); publish_port opens it once ensure_admin
# has run. The installer itself talks to the app over the stack network. A run counts as a first
# run until one has finished (SECRETS_ACK).
LOCAL_ONLY=
start_stack() {
    pull_images
    if upgrade_pending; then
        backup_before_upgrade
    fi
    if [ ! -f "$SECRETS_ACK" ]; then
        log "Starting the stack (port $(env_get AP_HTTP_PORT) on this host only until the admin exists)"
        LOCAL_ONLY=1
        export HTTP_BIND_PREFIX=127.0.0.1:
    else
        log "Starting the stack"
        unset HTTP_BIND_PREFIX
    fi
    compose up -d --remove-orphans
}

publish_port() {
    [ -n "$LOCAL_ONLY" ] || return 0
    unset HTTP_BIND_PREFIX
    log "Admin exists: publishing port $(env_get AP_HTTP_PORT) on the network"
    compose up -d activepieces
    wait_for_app
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
    wait_for_app
}

wait_for_app() {
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
        if printf '%s' "$res" | grep -q '"name"'; then echo "  ok  $PIECE_NAME@$PIECE_VERSION"
        elif printf '%s' "$res" | grep -q 'piece_metadata_already_exists'; then echo "  ok  $PIECE_NAME@$PIECE_VERSION (already installed)"
        else echo "  !!  $PIECE_NAME@$PIECE_VERSION: $res"; fi
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

# print_secrets [all]: without "all", secrets a first run took from -e are not shown (they belong
# to another server and are already in its secrets block).
print_secrets() {
    local mask=
    [ "${1:-}" = all ] || mask=1
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
ADMIN_PASSWORD:     $(secret_value ADMIN_PASSWORD $mask)
AP_ENCRYPTION_KEY:  $(secret_value AP_ENCRYPTION_KEY $mask)
BACKUP_PASSWORD:    $(secret_value BACKUP_PASSWORD $mask)
BACKUP_SALT:        $(secret_value BACKUP_SALT $mask)
=====================================================================
EOF
}

secret_value() { # secret_value KEY [mask]
    if [ -n "${2:-}" ] && [ -f "$SECRETS_GIVEN" ] && grep -qx "$1" "$SECRETS_GIVEN"; then
        echo "(given with -e; not shown, see --show-secrets)"
    else
        env_get "$1"
    fi
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
        publish_port
        # First thing after sign-in: after a ce->ee switch an older filter may still name pieces
        # that flows made on Community use; this re-computes it before anything else is done.
        apply_hidden_pieces
        install_pieces
        finish
        ;;
    --show-secrets|show-secrets)
        [ -f "$ENV_FILE" ] || die "$ENV_FILE not found; run the installer first"
        print_secrets all
        ;;
    restore) preflight; exec "$TEMPLATE_DIR/restore.sh" "$@" ;;
    backup-setup) preflight; exec "$TEMPLATE_DIR/backup-setup.sh" "$@" ;;
    -h|--help|help) sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//' ;;
    *) die "unknown command: $cmd (install | --show-secrets | restore [path] | backup-setup | --help)" ;;
esac
