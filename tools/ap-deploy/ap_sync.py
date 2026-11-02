#!/usr/bin/env python3
"""
ap-sync: the server-side helper. Every SYNC_INTERVAL_MINUTES it pulls the flows repo and applies
managed flows to this server; once a night (after EXPORT_HOUR, local time per TZ) it exports staff
flows to warehouse-made/, commits and pushes.

Usage:
    ap_sync.py                 # loop forever
    ap_sync.py --once          # one pull + apply, then exit
    ap_sync.py --export-now    # also run the nightly export on this pass
    ap_sync.py --no-push       # commit locally, never push (testing)

Env: FLOWS_REPO_URL, FLOWS_BRANCH (main), FLOWS_DIR (/data/flows), STATE_FILE (/data/ap-sync-state.json),
     SYNC_INTERVAL_MINUTES (5), EXPORT_HOUR (2), GITHUB_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL,
     AP_DEPLOY_TARGET, AP_URL, AP_PROJECT_ID, AP_EMAIL + AP_PASSWORD (or AP_API_KEY),
     BACKUP_STATUS_FILE (/backup-status/status, read-only mount of the backup service's status).
"""
import argparse
import json
import os
import subprocess
import sys
import time
import traceback
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import ap_deploy

REPO_URL = os.environ.get('FLOWS_REPO_URL', 'https://github.com/aboxofrice/activepieces-flows.git')
BRANCH = os.environ.get('FLOWS_BRANCH', 'main')
FLOWS_DIR = os.environ.get('FLOWS_DIR', '/data/flows')
STATE_FILE = os.environ.get('STATE_FILE', '/data/ap-sync-state.json')


def _env_number(name, default, cast, low, high):
    """A bad value must not crash-loop the container: warn and use the default."""
    raw = os.environ.get(name, '').strip()
    if not raw:
        return default
    try:
        value = cast(raw)
        if low <= value <= high:
            return value
    except ValueError:
        pass
    print(f'WARNING: {name}={raw!r} is not a number in {low}..{high}; using {default}', flush=True)
    return default


INTERVAL = _env_number('SYNC_INTERVAL_MINUTES', 5.0, float, 0.1, 1440) * 60
EXPORT_HOUR = _env_number('EXPORT_HOUR', 2, int, 0, 23)
# Optional healthchecks.io-style URL: GET after every good pass, <url>/fail after a failed one.
SYNC_HEALTHCHECK_URL = os.environ.get('SYNC_HEALTHCHECK_URL', '').strip()
TARGET = os.environ.get('AP_DEPLOY_TARGET', 'warehouse')
BACKUP_STATUS_FILE = os.environ.get('BACKUP_STATUS_FILE', '/backup-status/status')
STATUS_DIR = 'status'
# The token is handed to git by a credential helper reading the environment, so it never lands
# in .git/config, the remote URL, or a log line. The helper is scoped to the flows repo's host so
# git never offers the token to any other server (submodules, redirects, a changed URL).
CRED_HELPER = '!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f'
# Last flag logged per deploy key, so an unresolved skip is logged once, not every pass.
_flags = {}
# State of every managed flow after the last apply, for status/<target>.json.
_last_states = {}


def log(msg):
    print(f'{datetime.now().isoformat(timespec="seconds")} {msg}', flush=True)


def git(*args, check=True):
    cmd = ['git']
    if os.environ.get('GITHUB_TOKEN') and _repo_host_url():
        cmd += ['-c', f'credential.{_repo_host_url()}.helper={CRED_HELPER}']
    res = subprocess.run(cmd + list(args), cwd=FLOWS_DIR if os.path.isdir(FLOWS_DIR) else None,
                         capture_output=True, text=True,
                         env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    if check and res.returncode != 0:
        raise RuntimeError(f'git {args[0]} failed: {(res.stderr or res.stdout).strip()[:300]}')
    return res


def _repo_host_url():
    """scheme://host[:port] of FLOWS_REPO_URL (the credential helper's scope); None for non-HTTP URLs."""
    u = urllib.parse.urlsplit(REPO_URL)
    if u.scheme not in ('http', 'https') or not u.hostname:
        return None
    return f'{u.scheme}://{u.hostname}' + (f':{u.port}' if u.port else '')


def _safe_url(url):
    u = urllib.parse.urlsplit(url)
    return url if not u.password else url.replace(f':{u.password}@', ':***@')


def pull():
    """Bring FLOWS_DIR to origin/BRANCH, keeping any unpushed export commit on top."""
    if not os.path.isdir(os.path.join(FLOWS_DIR, '.git')):
        os.makedirs(os.path.dirname(FLOWS_DIR) or '.', exist_ok=True)
        git('clone', '--branch', BRANCH, REPO_URL, FLOWS_DIR)
        log(f'git clone {_safe_url(REPO_URL)} ({BRANCH})')
    elif git('remote', 'get-url', 'origin', check=False).stdout.strip() != REPO_URL:
        git('remote', 'set-url', 'origin', REPO_URL)
        log(f'git origin is now {_safe_url(REPO_URL)} (FLOWS_REPO_URL changed)')
    git('config', 'user.name', os.environ.get('GIT_AUTHOR_NAME', 'ap-sync'))
    git('config', 'user.email', os.environ.get('GIT_AUTHOR_EMAIL', 'ap-sync@localhost'))
    before = git('rev-parse', 'HEAD').stdout.strip()
    git('fetch', '--quiet', 'origin', BRANCH)
    # warehouse-made/ is only ever written here, so a failed rebase means someone edited it by
    # hand upstream: let git win, tonight's export regenerates it.
    if git('rebase', f'origin/{BRANCH}', check=False).returncode != 0:
        git('rebase', '--abort', check=False)
        git('reset', '--hard', f'origin/{BRANCH}')
        log('git rebase conflict: dropped the local export commit, will re-export tonight')
    after = git('rev-parse', 'HEAD').stdout.strip()
    if before != after:
        log(f'git pull {before[:7]}..{after[:7]}')
    return after


def apply_managed():
    client = ap_deploy.Client.from_env()
    records = ap_deploy.apply(client, FLOWS_DIR, TARGET, log=_log_apply)
    changed = sum(1 for r in records if r.get('applied'))
    _last_states.clear()
    for r in records:
        flag = r['reason'] if r['state'] in ap_deploy.FLAGGED_STATES else None
        _last_states[r['key']] = {'state': r['state'], **({'reason': r['reason']} if flag else {})}
        if _flags.get(r['key']) and not flag:
            log(f'apply {r["key"]}: no longer flagged ({r["state"]})')
        _flags[r['key']] = flag
    if changed:
        log(f'apply done: {changed} applied, {sum(1 for f in _flags.values() if f)} flagged, {len(records)} managed')
    return client


def _log_apply(msg):
    parts = msg.split(' ', 2)
    if parts[0] == 'skip' and _flags.get(parts[1].rstrip(':')) == msg.split(' - ', 1)[-1]:
        return
    log(f'apply {msg}')


def nightly_export(client, push=True):
    ap_deploy.export_staff(client, FLOWS_DIR, log=log)
    write_status_file()
    # With no staff flows the folder may not exist (on disk or in git), and `git add` on a path
    # that matches nothing fails.
    for folder in (ap_deploy.STAFF_DIR, STATUS_DIR):
        if os.path.isdir(os.path.join(FLOWS_DIR, folder)) or git('ls-files', folder).stdout.strip():
            git('add', '-A', folder)
    if git('diff', '--cached', '--quiet', check=False).returncode == 0:
        log('export-staff: nothing to commit')
    else:
        git('commit', '--quiet', '-m', f'warehouse-made: nightly export {datetime.now():%Y-%m-%d}')
        log(f'git commit {git("rev-parse", "--short", "HEAD").stdout.strip()}')
    if push and git('rev-list', '--count', f'origin/{BRANCH}..HEAD').stdout.strip() != '0':
        git('push', '--quiet', 'origin', f'HEAD:{BRANCH}')
        log(f'git push origin {BRANCH}')


def read_backup_status(path=None):
    """key=value status the backup service writes (last_success, last_failure, ...); {} if none."""
    try:
        with open(path or BACKUP_STATUS_FILE, encoding='utf-8') as f:
            lines = f.read().splitlines()
    except OSError:
        return {}
    return {k: v for k, _, v in (line.partition('=') for line in lines) if k and v}


def write_status_file():
    """status/<target>.json: committed with the nightly export so the server's health is visible in
    the repo even though nobody can reach the server itself."""
    backup = read_backup_status()
    status = {
        'target': TARGET,
        'date': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'backup': {k: backup.get(k) for k in ('last_result', 'last_success', 'last_success_file',
                                                'last_failure', 'last_failure_reason')} if backup else None,
        'managed': dict(sorted(_last_states.items())),
    }
    ap_deploy.write_json(os.path.join(FLOWS_DIR, STATUS_DIR, f'{TARGET}.json'), status)


def check_release_upgrade(repo, target):
    """Hook for release.json image upgrades (backup, pull, restart). Not implemented yet: no-op."""
    return None


def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE) or '.', exist_ok=True)
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)


def tick(export_now=False, push=True):
    state = load_state()
    pull()
    check_release_upgrade(FLOWS_DIR, TARGET)
    client = apply_managed()
    today = datetime.now().strftime('%Y-%m-%d')
    if export_now or (datetime.now().hour >= EXPORT_HOUR and state.get('lastExport') != today):
        nightly_export(client, push=push)
        save_state({**state, 'lastExport': today})


def ping_health(suffix=''):
    """Never raises and never logs the URL (it is the check's secret)."""
    if not SYNC_HEALTHCHECK_URL:
        return
    try:
        urllib.request.urlopen(SYNC_HEALTHCHECK_URL.rstrip('/') + suffix, timeout=10).close()
    except Exception as e:  # noqa: BLE001
        log(f'warning: could not reach SYNC_HEALTHCHECK_URL ({type(e).__name__})')


def main():
    p = argparse.ArgumentParser(description='ap-sync helper loop')
    p.add_argument('--once', action='store_true')
    p.add_argument('--export-now', action='store_true')
    p.add_argument('--no-push', action='store_true')
    args = p.parse_args()
    log(f'ap-sync start: target={TARGET} repo={_safe_url(REPO_URL)} branch={BRANCH} every {INTERVAL / 60:g} min')
    last_error, repeats = None, 0
    while True:
        try:
            tick(export_now=args.export_now, push=not args.no_push)
            if last_error:
                log('recovered from the previous error')
            last_error, repeats = None, 0
            ping_health()
        except Exception as e:  # noqa: BLE001 - never crash-loop: log, wait, try again
            msg = f'{type(e).__name__}: {e}'
            # The same failure every 5 minutes is logged once an hour, not every pass.
            if msg != last_error or repeats % max(1, int(3600 // max(INTERVAL, 1))) == 0:
                log(f'error: {msg}')
                if not isinstance(e, (ap_deploy.ApiError, RuntimeError, OSError)):
                    log(traceback.format_exc().rstrip())
            repeats = repeats + 1 if msg == last_error else 1
            last_error = msg
            ping_health('/fail')
            if args.once:
                return 1
        if args.once:
            return 0
        args.export_now = False
        time.sleep(INTERVAL)


if __name__ == '__main__':
    sys.exit(main())
