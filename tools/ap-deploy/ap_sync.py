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
     AP_DEPLOY_TARGET, AP_URL, AP_PROJECT_ID, AP_EMAIL + AP_PASSWORD (or AP_API_KEY).
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime

import ap_deploy

REPO_URL = os.environ.get('FLOWS_REPO_URL', 'https://github.com/aboxofrice/activepieces-flows.git')
BRANCH = os.environ.get('FLOWS_BRANCH', 'main')
FLOWS_DIR = os.environ.get('FLOWS_DIR', '/data/flows')
STATE_FILE = os.environ.get('STATE_FILE', '/data/ap-sync-state.json')
INTERVAL = float(os.environ.get('SYNC_INTERVAL_MINUTES', '5')) * 60
EXPORT_HOUR = int(os.environ.get('EXPORT_HOUR', '2'))
TARGET = os.environ.get('AP_DEPLOY_TARGET', 'warehouse')
# The token is handed to git by a credential helper reading the environment, so it never lands
# in .git/config, the remote URL, or a log line.
CRED_HELPER = '!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f'
# Last flag logged per deploy key, so an unresolved skip is logged once, not every pass.
_flags = {}


def log(msg):
    print(f'{datetime.now().isoformat(timespec="seconds")} {msg}', flush=True)


def git(*args, check=True):
    cmd = ['git']
    if os.environ.get('GITHUB_TOKEN'):
        cmd += ['-c', f'credential.helper={CRED_HELPER}']
    res = subprocess.run(cmd + list(args), cwd=FLOWS_DIR if os.path.isdir(FLOWS_DIR) else None,
                         capture_output=True, text=True,
                         env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    if check and res.returncode != 0:
        raise RuntimeError(f'git {args[0]} failed: {(res.stderr or res.stdout).strip()[:300]}')
    return res


def pull():
    """Bring FLOWS_DIR to origin/BRANCH, keeping any unpushed export commit on top."""
    if not os.path.isdir(os.path.join(FLOWS_DIR, '.git')):
        os.makedirs(os.path.dirname(FLOWS_DIR) or '.', exist_ok=True)
        git('clone', '--branch', BRANCH, REPO_URL, FLOWS_DIR)
        log(f'git clone {REPO_URL} ({BRANCH})')
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
    for r in records:
        flag = r['reason'] if r['state'] in ('drifted', 'missing-deps', 'error') else None
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
    git('add', '-A', ap_deploy.STAFF_DIR)
    if git('diff', '--cached', '--quiet', check=False).returncode == 0:
        log('export-staff: nothing to commit')
    else:
        git('commit', '--quiet', '-m', f'warehouse-made: nightly export {datetime.now():%Y-%m-%d}')
        log(f'git commit {git("rev-parse", "--short", "HEAD").stdout.strip()}')
    if push and git('rev-list', '--count', f'origin/{BRANCH}..HEAD').stdout.strip() != '0':
        git('push', '--quiet', 'origin', f'HEAD:{BRANCH}')
        log(f'git push origin {BRANCH}')


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


def main():
    p = argparse.ArgumentParser(description='ap-sync helper loop')
    p.add_argument('--once', action='store_true')
    p.add_argument('--export-now', action='store_true')
    p.add_argument('--no-push', action='store_true')
    args = p.parse_args()
    log(f'ap-sync start: target={TARGET} repo={REPO_URL} branch={BRANCH} every {INTERVAL / 60:g} min')
    while True:
        try:
            tick(export_now=args.export_now, push=not args.no_push)
        except (ap_deploy.ApiError, RuntimeError, OSError) as e:
            log(f'error: {e}')
            if args.once:
                return 1
        if args.once:
            return 0
        args.export_now = False
        time.sleep(INTERVAL)


if __name__ == '__main__':
    sys.exit(main())
