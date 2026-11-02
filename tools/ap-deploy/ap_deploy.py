#!/usr/bin/env python3
"""
Git-driven flow deploys for Activepieces.

Flows Vu builds on the Mac are exported to `managed/<deploy-key>.json` in a checkout of the flows
repo; a target server applies them from there, matching flows by `metadata.deployKey`. Flows without
a deploy key belong to staff: apply never touches them, export-staff copies them to `warehouse-made/`.

Usage:
    ap_deploy.py export <deploy-key> --flow-id <id> | --name "<display name>"   # first export
    ap_deploy.py export <deploy-key>...                                          # re-export (by deployKey)
    ap_deploy.py plan                      # what apply would do on AP_DEPLOY_TARGET
    ap_deploy.py apply                     # do it
    ap_deploy.py status                    # state of every managed flow on the target
    ap_deploy.py export-staff              # target flows without a deploy key -> warehouse-made/

Env (target):  AP_URL, AP_PROJECT_ID, and AP_API_KEY or AP_EMAIL + AP_PASSWORD; AP_DEPLOY_TARGET.
Env (source, export only): AP_SOURCE_URL / AP_SOURCE_API_KEY / AP_SOURCE_EMAIL / AP_SOURCE_PASSWORD /
               AP_SOURCE_PROJECT_ID, each falling back to the AP_* variable of the same name.
Repo:          --repo <dir> or AP_FLOWS_REPO (default: current directory).
"""
import argparse
import copy
import fcntl
import hashlib
import json
import math
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

MANAGED_DIR = 'managed'
STAFF_DIR = 'warehouse-made'
DEPLOY_FILE = 'deploy.json'
MANAGED_FOLDER = 'Managed (from git)'
SCHEMA_VERSION = '22'
CONNECTION_REF = re.compile(r"connections\['([^']+)'\]")
# Instance- or run-specific step fields; IMPORT_FLOW recreates them on the target.
STEP_DROP = {'lastUpdatedDate'}
SETTINGS_DROP = {'sampleData'}
NOTE_DROP = {'ownerId', 'createdAt', 'updatedAt'}
KEY_RE = re.compile(r'[a-z0-9][a-z0-9-]*')
# Bumped when definition_hash changes; metadata written by an older ap-deploy is compared the old way.
HASH_VERSION = 2
# States that need a human; status exits 1 and ap-sync logs them.
FLAGGED_STATES = ('error', 'drifted', 'missing-deps')
REDACTED = '<redacted-by-ap-sync>'


class ApiError(Exception):
    pass


class Client:
    def __init__(self, url, project_id=None, api_key=None, email=None, password=None):
        self.url = url.rstrip('/')
        self.project_id = project_id
        if api_key:
            self.token = api_key
        elif email and password:
            try:
                res = self.request('POST', '/v1/authentication/sign-in', {'email': email, 'password': password}, auth=False)
            except ApiError as e:
                if re.search(r' -> (400|401|403):', str(e)):
                    raise ApiError(
                        f'sign-in as {email} was rejected ({e}). If the admin password was changed in the UI, '
                        'put the new one in ADMIN_PASSWORD in the server .env (e.g. /data/.env) and re-run the '
                        'installer, which recreates ap-sync with it.') from None
                raise
            if not isinstance(res, dict) or not res.get('token'):
                raise ApiError(f'{self.url}: sign-in returned no token')
            self.token = res['token']
            self.project_id = self.project_id or res.get('projectId')
        else:
            raise ApiError(f'{self.url}: set an API key or email + password')
        if not self.project_id:
            raise ApiError(f'{self.url}: project id unknown (set AP_PROJECT_ID)')

    @classmethod
    def from_env(cls, prefix='AP_'):
        def env(name):
            return os.environ.get(prefix + name) or os.environ.get('AP_' + name)
        return cls(env('URL') or 'http://localhost:8080', env('PROJECT_ID'), env('API_KEY'), env('EMAIL'), env('PASSWORD'))

    def request(self, method, path, body=None, auth=True):
        headers = {'Content-Type': 'application/json'}
        if auth:
            headers['Authorization'] = f'Bearer {self.token}'
        req = urllib.request.Request(f'{self.url}/api{path}', method=method, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                raw = res.read()
                return json.loads(raw) if raw else None
        except ValueError:
            raise ApiError(f'{method} {path.split("?")[0]}: response is not JSON (proxy or error page?)') from None
        except urllib.error.HTTPError as e:
            raise ApiError(f'{method} {path.split("?")[0]} -> {e.code}: {e.read().decode(errors="replace")[:500]}') from None
        except urllib.error.URLError as e:
            raise ApiError(f'{method} {self.url}: {e.reason}') from None

    def paged(self, path, **query):
        query = {'projectId': self.project_id, 'limit': 100, **query}
        cursor = None
        while True:
            q = dict(query, **({'cursor': cursor} if cursor else {}))
            page = self.request('GET', f'{path}?{urllib.parse.urlencode(q)}')
            yield from page['data']
            cursor = page.get('next')
            if not cursor:
                return

    def flows(self):
        return list(self.paged('/v1/flows'))

    def flow(self, flow_id):
        return self.request('GET', f'/v1/flows/{flow_id}')

    def operate(self, flow_id, op_type, request):
        return self.request('POST', f'/v1/flows/{flow_id}', {'type': op_type, 'request': request})

    def connection_names(self):
        return {c['externalId'] for c in self.paged('/v1/app-connections')}

    def has_piece(self, name, version):
        try:
            piece = self.request('GET', f'/v1/pieces/{name}?{urllib.parse.urlencode({"version": version})}')
        except ApiError as e:
            if ' -> 404' in str(e):
                return False
            raise
        return isinstance(piece, dict) and piece.get('version') == version


# ---------- normalization ----------

def normalize_flow(version, deploy_key):
    """Strip ids, timestamps, sample data and owner bits from a flow version; derive deps."""
    trigger = _normalize_step(version['trigger'])
    return {
        'deployKey': deploy_key,
        'displayName': version['displayName'],
        'schemaVersion': version.get('schemaVersion') or SCHEMA_VERSION,
        'notes': [{k: v for k, v in n.items() if k not in NOTE_DROP} for n in version.get('notes') or []],
        'trigger': trigger,
        'pieces': pieces_used(trigger),
        'connections': connections_used(trigger),
    }


def definition_hash(flow_def, hash_version=HASH_VERSION):
    """Hash of what the flow does (deps and deployKey are derived/bookkeeping, so excluded).

    schemaVersion is left out (v2): the server's flow-version migration bumps it on every image
    upgrade without anyone editing the flow. Version 1 hashes (older metadata) included it."""
    fields = ('displayName', 'schemaVersion', 'notes', 'trigger') if hash_version == 1 else ('displayName', 'notes', 'trigger')
    core = {k: flow_def.get(k) for k in fields}
    return hashlib.sha256(canonical(core).encode()).hexdigest()[:16]


def target_hash(flow, hash_version=HASH_VERSION):
    return definition_hash(normalize_flow(flow['version'], None), hash_version)


def check_drift(flow, meta):
    """(drifted, rebaseline) for a managed flow on the target.

    rebaseline=True means the flow differs from the recorded deployHash only because of something
    that is not an edit, so the baseline should be re-recorded instead of flagging:
      - the metadata was written with an older hash version, or
      - an image upgrade migrated the deployed version in place: same version id as deployed, newer
        schemaVersion. Staff edits never qualify: editing a published flow creates a new version id.
    """
    if not flow or not meta.get('deployHash'):
        return False, False
    stored_version = meta.get('hashVersion') or 1
    if target_hash(flow, stored_version) == meta['deployHash']:
        return False, stored_version != HASH_VERSION
    version = flow['version']
    if meta.get('deployVersionId') and meta['deployVersionId'] == version.get('id') \
            and _schema_number(version.get('schemaVersion')) > _schema_number(meta.get('deploySchemaVersion')):
        return False, True
    return True, False


def _schema_number(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1


def to_import_request(flow_def):
    now = datetime.now(timezone.utc).isoformat()
    return {
        'displayName': flow_def['displayName'],
        'schemaVersion': flow_def['schemaVersion'],
        'notes': [dict(n, ownerId=None, createdAt=now, updatedAt=now) for n in flow_def.get('notes') or []],
        'trigger': _stamp_step(copy.deepcopy(flow_def['trigger']), now),
    }


def pieces_used(trigger):
    found = {(s['settings']['pieceName'], s['settings']['pieceVersion'])
             for s in walk(trigger) if s.get('type') in ('PIECE', 'PIECE_TRIGGER')}
    return [{'name': n, 'version': v} for n, v in sorted(found)]


def connections_used(trigger):
    return sorted(set(CONNECTION_REF.findall(json.dumps(trigger))))


def walk(step):
    while step:
        yield step
        if step.get('firstLoopAction'):
            yield from walk(step['firstLoopAction'])
        for child in step.get('children') or []:
            yield from walk(child)
        step = step.get('nextAction')


def canonical(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


def _normalize_step(step):
    if not step:
        return step
    out = {k: v for k, v in step.items() if k not in STEP_DROP}
    if isinstance(out.get('settings'), dict):
        out['settings'] = {k: v for k, v in out['settings'].items() if k not in SETTINGS_DROP}
    for key in ('nextAction', 'firstLoopAction'):
        if key in out:
            out[key] = _normalize_step(out[key])
    if 'children' in out:
        out['children'] = [_normalize_step(c) for c in out['children']]
    return out


def _stamp_step(step, now):
    for s in walk(step):
        s['lastUpdatedDate'] = now
    return step


# ---------- repo files ----------

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + '\n'
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            if f.read() == text:
                return False
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return True


def read_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def load_deploy_config(repo, target):
    path = os.path.join(repo, DEPLOY_FILE)
    if not os.path.exists(path):
        raise ApiError(f'{path} not found')
    try:
        config = read_json(path)
    except ValueError as e:
        raise ApiError(f'{DEPLOY_FILE} is not valid JSON: {e}') from None
    if not isinstance(config, dict):
        raise ApiError(f'{DEPLOY_FILE} must be an object of targets')
    if target not in config:
        raise ApiError(f'{DEPLOY_FILE} has no "{target}" entry (targets: {", ".join(config) or "none"})')
    if not isinstance(config[target], dict):
        raise ApiError(f'{DEPLOY_FILE} "{target}" must be an object of deploy keys')
    return config[target]


def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-') or 'flow'


# ---------- export (source instance) ----------

def export(client, repo, keys, flow_id=None, name=None, log=print):
    flows = client.flows()
    if (flow_id or name) and len(keys) != 1:
        raise ApiError('--flow-id/--name take exactly one deploy key')
    written = []
    for key in keys:
        if not KEY_RE.fullmatch(key):
            raise ApiError(f'deploy key "{key}" must be lowercase letters, digits and dashes')
        flow = _find_source_flow(flows, key, flow_id, name)
        existing_key = (flow.get('metadata') or {}).get('deployKey')
        if existing_key and existing_key != key:
            raise ApiError(f'flow {flow["id"]} already carries deployKey "{existing_key}"')
        clash = [f['id'] for f in flows if (f.get('metadata') or {}).get('deployKey') == key and f['id'] != flow['id']]
        if clash:
            raise ApiError(f'deployKey "{key}" is already on flow(s) {", ".join(clash)}')
        version = client.flow(flow['id'])['version']
        flow_def = normalize_flow(version, key)
        path = os.path.join(repo, MANAGED_DIR, f'{key}.json')
        changed = write_json(path, flow_def)
        if existing_key != key:
            client.operate(flow['id'], 'UPDATE_METADATA', {'metadata': {**(flow.get('metadata') or {}), 'deployKey': key}})
        if version['state'] != 'LOCKED':
            log(f'warn {key}: exported the DRAFT version of "{version["displayName"]}" (not yet published on source)')
        log(f'export {key}: {"wrote" if changed else "unchanged"} {os.path.relpath(path, repo)} '
            f'({len(flow_def["pieces"])} pieces, connections: {", ".join(flow_def["connections"]) or "none"})')
        written.append(path)
    return written


def _find_source_flow(flows, key, flow_id, name):
    if flow_id:
        match = [f for f in flows if f['id'] == flow_id]
    elif name:
        match = [f for f in flows if f['version']['displayName'] == name]
    else:
        match = [f for f in flows if (f.get('metadata') or {}).get('deployKey') == key]
    if len(match) != 1:
        what = f'id {flow_id}' if flow_id else f'name "{name}"' if name else f'deployKey "{key}" (first export needs --flow-id or --name)'
        raise ApiError(f'{len(match)} source flows match {what}')
    return match[0]


# ---------- plan / apply / status (target instance) ----------

def evaluate(client, repo, target):
    """One record per managed flow: what state it is in and what apply would do.

    Each deploy key is evaluated on its own: a broken entry or flow file marks only that key as
    `error`, the others are still applied."""
    wanted = load_deploy_config(repo, target)
    flows = client.flows()
    by_key = {}
    for f in flows:
        meta = f.get('metadata')
        key = meta.get('deployKey') if isinstance(meta, dict) else None
        if key:
            by_key.setdefault(key, []).append(f)
    connections = client.connection_names()
    piece_cache = {}
    records = []
    for key in sorted(wanted):
        matches = by_key.get(key, [])
        rec = {'key': key, 'desired': None, 'flow': matches[0] if len(matches) == 1 else None,
               'status': matches[0].get('status') if len(matches) == 1 else None,
               'matches': matches, 'action': 'none', 'state': 'error', 'reason': ''}
        records.append(rec)
        try:
            entry = wanted[key]
            if not isinstance(entry, dict) or not isinstance(entry.get('enabled', False), bool):
                raise ValueError(f'{DEPLOY_FILE} entry must look like {{"enabled": true}}')
            rec['desired'] = 'ENABLED' if entry.get('enabled') else 'DISABLED'
            _classify(client, repo, rec, connections, piece_cache)
        except Exception as e:  # noqa: BLE001 - isolate one bad record from the rest
            rec.update(state='error', action='none', reason=f'{type(e).__name__}: {e}'[:300])
        _kill_switch(rec)
    for key, matches in sorted(by_key.items()):
        if key not in wanted:
            for f in matches:
                records.append({'key': key, 'desired': None, 'flow': f, 'status': f.get('status'), 'action': 'none',
                                'state': 'unlisted', 'reason': f'not in {DEPLOY_FILE} for this server; left alone'})
    return records


def _classify(client, repo, rec, connections, piece_cache):
    key, desired, flow, matches = rec['key'], rec['desired'], rec['flow'], rec['matches']
    if not KEY_RE.fullmatch(key):
        rec.update(state='error', reason='invalid deploy key (lowercase letters, digits and dashes only)')
        return
    path = os.path.join(repo, MANAGED_DIR, f'{key}.json')
    if not os.path.exists(path):
        rec.update(state='error', reason=f'{MANAGED_DIR}/{key}.json missing')
        return
    if len(matches) > 1:
        rec.update(state='error', reason=f'{len(matches)} target flows carry this deployKey: {", ".join(f["id"] for f in matches)}')
        return
    flow_def = read_json(path)
    if not isinstance(flow_def, dict) or not flow_def.get('displayName') or not isinstance(flow_def.get('trigger'), dict):
        raise ValueError(f'{MANAGED_DIR}/{key}.json is not a flow export (needs displayName and trigger)')
    rec['def'] = flow_def
    rec['sourceHash'] = definition_hash(flow_def)
    meta = (flow or {}).get('metadata') or {}
    drifted, rec['rebaseline'] = check_drift(flow, meta)
    if drifted and _interrupted_apply(flow, meta, rec['sourceHash']):
        drifted = False
        rec['interrupted'] = True
    known_source = {rec['sourceHash']}
    if (meta.get('hashVersion') or 1) != HASH_VERSION:
        known_source.add(definition_hash(flow_def, meta.get('hashVersion') or 1))
    # deployedStatus is what the last apply left; a different status now means someone switched the
    # flow in the UI. Turning it off there (an emergency stop) must not be undone by the next pass.
    stopped_here = bool(flow) and meta.get('deployedStatus') == 'ENABLED' and flow['status'] == 'DISABLED' and desired == 'ENABLED'
    missing = _missing_deps(client, flow_def, connections, piece_cache)
    if drifted:
        rec.update(state='drifted', reason='edited on this server since the last apply; not overwritten')
    elif stopped_here:
        rec.update(state='drifted', reason='turned off on this server since the last apply; not turned back on '
                   f'(set "enabled": false in {DEPLOY_FILE} to accept, or turn it on in the UI)')
    elif missing:
        rec.update(state='missing-deps', reason='missing ' + ', '.join(missing))
    elif not flow:
        rec.update(state='new', action='create')
    elif rec.get('interrupted') or meta.get('sourceHash') not in known_source or not meta.get('deployHash') \
            or flow['publishedVersionId'] != flow['version']['id']:
        rec.update(state='changed', action='update')
    elif flow['status'] != desired:
        rec.update(state='in-sync', action='status')
    elif rec['rebaseline'] or meta.get('deployedStatus') != flow['status']:
        rec.update(state='in-sync', action='rebaseline')
    else:
        rec.update(state='in-sync')


def _interrupted_apply(flow, meta, source_hash):
    """True when the flow differs from its baseline only because an earlier apply imported a new
    version and then failed (e.g. publish rejected): finish that apply instead of flagging drift.

    applyingSourceHash is written before the import, applyingHash (the server's hash of the imported
    version) right after it. A staff edit of the half-applied draft changes the hash, so it is still
    drift; only if the run died between import and recording applyingHash is the source hash alone
    trusted."""
    pending = meta.get('applyingSourceHash')
    if not pending:
        return False
    if meta.get('applyingHash'):
        return target_hash(flow) == meta['applyingHash']
    return pending == source_hash


def _kill_switch(rec):
    """`"enabled": false` always turns a flow off, even one that is drifted, missing deps or broken."""
    if rec['desired'] != 'DISABLED' or rec['action'] in ('create', 'update', 'status'):
        return
    on = [f['id'] for f in rec['matches'] if f.get('status') == 'ENABLED']
    if on:
        rec.update(action='disable', disable_ids=on)


def apply(client, repo, target, dry_run=False, log=print):
    lock = None if dry_run else _apply_lock(client, log)
    try:
        records = evaluate(client, repo, target)
        for rec in records:
            key, action = rec['key'], rec['action']
            if action == 'none' or action == 'disable':
                if rec['state'] not in ('in-sync', 'unlisted'):
                    log(f'skip {key}: {rec["state"]} - {rec["reason"]}')
                if action == 'none':
                    continue
            label = f'{action} {key} -> {"DISABLED" if action == "disable" else rec["desired"]}'
            if dry_run:
                log(f'would {label}')
                continue
            try:
                flow_id = _apply_one(client, rec)
                rec['applied'] = True
                if action != 'rebaseline':
                    log(f'{label} ok (flow {flow_id})')
            except Exception as e:  # noqa: BLE001 - one failing flow must not stop the others
                rec['error'] = str(e)
                log(f'FAIL {label}: {type(e).__name__}: {e}')
        return records
    finally:
        if lock:
            lock.close()


def _apply_lock(client, log):
    """Serialize applies to one target (ap-sync's loop and a manual `docker exec ... apply`), so two
    runs can never both see a flow as new and create it twice."""
    ident = hashlib.sha256(f'{client.url}|{client.project_id}'.encode()).hexdigest()[:12]
    path = os.path.join(tempfile.gettempdir(), f'ap-deploy-{ident}.lock')
    f = open(path, 'a')
    waited = 0
    while True:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return f
        except BlockingIOError:
            if waited == 0:
                log(f'waiting for another apply to {client.url} to finish ({path})')
            if waited >= 600:
                f.close()
                raise ApiError(f'another apply to {client.url} has held {path} for 10 minutes')
            time.sleep(2)
            waited += 2


def _apply_one(client, rec):
    action = rec['action']
    if action == 'disable':
        for flow_id in rec['disable_ids']:
            client.operate(flow_id, 'CHANGE_STATUS', {'status': 'DISABLED'})
            _update_metadata(client, client.flow(flow_id), {'deployedStatus': 'DISABLED'})
        return ', '.join(rec['disable_ids'])
    flow = rec['flow']
    if action in ('status', 'rebaseline'):
        if action == 'status':
            client.operate(flow['id'], 'CHANGE_STATUS', {'status': rec['desired']})
        fresh = client.flow(flow['id'])
        extra = {'deployedStatus': fresh['status']}
        if rec.get('rebaseline'):
            extra.update(_baseline(fresh), sourceHash=rec['sourceHash'])
        _update_metadata(client, fresh, extra)
        return flow['id']
    flow_def = rec['def']
    pending = {'applyingSourceHash': rec['sourceHash'], 'applyingHash': None}
    if not flow:
        flow = client.request('POST', '/v1/flows', {
            'displayName': flow_def['displayName'], 'projectId': client.project_id,
            'folderName': MANAGED_FOLDER, 'metadata': {'deployKey': rec['key'], **pending}})
    else:
        _update_metadata(client, client.flow(flow['id']), pending)
    try:
        client.operate(flow['id'], 'IMPORT_FLOW', to_import_request(flow_def))
    except Exception:
        # Nothing was imported, so there is no half-applied version to finish. Leaving the pending
        # hash would let a later staff edit be mistaken for our import and overwritten.
        _update_metadata(client, client.flow(flow['id']), {}, drop=('applyingSourceHash', 'applyingHash'))
        raise
    imported = client.flow(flow['id'])
    _update_metadata(client, imported, {'applyingHash': target_hash(imported)})
    published = client.operate(flow['id'], 'LOCK_AND_PUBLISH', {'status': rec['desired']})
    if published['status'] != rec['desired']:
        client.operate(flow['id'], 'CHANGE_STATUS', {'status': rec['desired']})
    fresh = client.flow(flow['id'])
    _update_metadata(client, fresh, {
        'deployKey': rec['key'], 'sourceHash': rec['sourceHash'], **_baseline(fresh),
        'deployedStatus': fresh['status'], 'deployedAt': datetime.now(timezone.utc).isoformat(timespec='seconds')},
        drop=('applyingSourceHash', 'applyingHash'))
    return flow['id']


def _baseline(fresh):
    """What the flow looks like right after an apply; drift is measured against it."""
    return {'deployHash': target_hash(fresh), 'hashVersion': HASH_VERSION,
            'deployVersionId': fresh['version']['id'], 'deploySchemaVersion': fresh['version'].get('schemaVersion')}


def _update_metadata(client, fresh, fields, drop=()):
    kept = {k: v for k, v in (fresh.get('metadata') or {}).items() if k not in drop}
    client.operate(fresh['id'], 'UPDATE_METADATA', {'metadata': {**kept, **fields}})


def _missing_deps(client, flow_def, connections, piece_cache):
    missing = [f'connection {c}' for c in flow_def.get('connections', []) if c not in connections]
    for p in flow_def.get('pieces', []):
        ident = (p['name'], p['version'])
        if ident not in piece_cache:
            piece_cache[ident] = client.has_piece(*ident)
        if not piece_cache[ident]:
            missing.append(f'piece {p["name"]}@{p["version"]}')
    return missing


def format_status(records):
    rows = [('DEPLOY KEY', 'STATE', 'ON/OFF', 'WANT', 'FLOW', 'NOTE')]
    for r in records:
        rows.append((r['key'], r['state'], _onoff(r['status']), _onoff(r['desired']),
                     r['flow']['id'] if r['flow'] else '-', r['reason'] or ('pending: ' + r['action'] if r['action'] != 'none' else '')))
    widths = [max(len(str(row[i])) for row in rows) for i in range(5)]
    return '\n'.join('  '.join(str(c).ljust(widths[i]) if i < 5 else str(c) for i, c in enumerate(row)).rstrip() for row in rows)


def _onoff(status):
    return {'ENABLED': 'on', 'DISABLED': 'off'}.get(status, '-')


def _any_flagged(records):
    return any(r.get('error') or r['state'] in FLAGGED_STATES for r in records)


# ---------- export-staff (target instance) ----------

def export_staff(client, repo, log=print):
    """Mirror every flow without a deploy key into warehouse-made/; returns the paths changed."""
    out_dir = os.path.join(repo, STAFF_DIR)
    flows = sorted((f for f in client.flows() if not (f.get('metadata') or {}).get('deployKey')),
                   key=lambda f: (f['created'], f['id']))
    used, changed, keep = set(), [], set()
    for f in flows:
        slug = slugify(f['version']['displayName'])
        if slug in used:
            slug = f'{slug}-{f["id"][:6].lower()}'
        used.add(slug)
        flow_def = normalize_flow(f['version'], None)
        flow_def['trigger'], found = redact_secrets(flow_def['trigger'])
        flow_def['notes'], found_notes = redact_secrets(flow_def['notes'])
        found += found_notes
        if found:
            flow_def['redacted'] = sorted({f'{step}: {where}' for step, where in found})
            log(f'WARNING export-staff {slug}: redacted {len(found)} value(s) that look like credentials '
                f'(flow "{f["version"]["displayName"]}": {", ".join(flow_def["redacted"])}); '
                'they should live in a connection')
        flow_def.update(warehouseFlowId=f['id'], status=f['status'])
        path = os.path.join(out_dir, f'{slug}.json')
        keep.add(path)
        if write_json(path, flow_def):
            changed.append(path)
            log(f'export-staff {slug}: written')
    if os.path.isdir(out_dir):
        for name in sorted(os.listdir(out_dir)):
            path = os.path.join(out_dir, name)
            if name.endswith('.json') and path not in keep:
                os.remove(path)
                changed.append(path)
                log(f'export-staff {name[:-5]}: removed (flow gone or now managed)')
    log(f'export-staff: {len(flows)} staff flows, {len(changed)} files changed')
    return changed


def redact_secrets(obj):
    """Copy of obj with values that look like credentials replaced by REDACTED.

    Staff paste API keys straight into step inputs (HTTP headers, URLs, code); the nightly export
    must not push them to GitHub. Returns (copy, [(step name, field path), ...]). Template
    references such as {{connections['x']}} or {{trigger.body.token}} are not secrets and are kept."""
    found = []

    def visit(value, step, path, key):
        if isinstance(value, dict):
            if isinstance(value.get('name'), str) and 'type' in value and 'settings' in value:
                step, path = value['name'], ''
            return {k: visit(v, step, f'{path}.{k}' if path else k, k) for k, v in value.items()}
        if isinstance(value, list):
            return [visit(v, step, f'{path}[{i}]', key) for i, v in enumerate(value)]
        if not isinstance(value, str) or not value:
            return value
        if isinstance(key, str) and _is_secret_key(key) and not _only_templates(value):
            found.append((step, path))
            return REDACTED
        if isinstance(key, str) and ID_KEY_RE.search(key) and ID_VALUE_RE.fullmatch(value) \
                and not KNOWN_TOKEN_RE.fullmatch(value):
            return value  # a record id (order, sheet, folder, ...) in an id-named field
        cleaned = _redact_text(value)
        if cleaned != value:
            found.append((step, path))
        return cleaned

    return visit(copy.deepcopy(obj), 'flow', '', None), found


def _is_secret_key(key):
    """Field names whose last word is a credential noun: apiKey, X-SC-Pass, client_secret,
    accessToken. Not maxTokens, tokenLimit, secretName or passwordResetUrl."""
    words = [w.lower() for w in KEY_WORD_RE.findall(key)]
    if not words:
        return False
    last, prev = words[-1], (words[-2] if len(words) > 1 else '')
    return last in SECRET_LAST_WORDS or (last == 'key' and prev in KEY_PREFIXES) or ''.join(words[-2:]) in SECRET_LAST_WORDS


def _is_secret_param(name):
    """Query parameter names judged by their last word, like field names (api_token, apiToken,
    refresh_token, auth_key), plus bare credential names (key, sig); not keyword or monkey."""
    words = [w.lower() for w in KEY_WORD_RE.findall(name)]
    return bool(words) and (words[-1] in BARE_SECRET_PARAMS or words[-1] in SECRET_LAST_WORDS or _is_secret_key(name))


def _only_templates(value):
    rest = TEMPLATE_RE.sub('', value)
    return not re.sub(r'(?i)\b(bearer|basic|token)\b', '', rest).strip()


def _redact_text(text):
    text = BEARER_RE.sub(lambda m: m.group(1) + REDACTED, text)
    text = URL_USERINFO_RE.sub(lambda m: m.group(1) + REDACTED + '@', text)
    text = QUERY_PARAM_RE.sub(lambda m: m.group(1) + REDACTED if _is_secret_param(m.group(2)) else m.group(0), text)
    text = ASSIGNED_SECRET_RE.sub(lambda m: m.group(1) + m.group(2) + REDACTED + m.group(2), text)
    text = KNOWN_TOKEN_RE.sub(REDACTED, text)
    keep = [m.span(2) for m in GOOGLE_ID_RE.finditer(text)]
    text = AWS_SECRET_RE.sub(lambda m: m.group(0) if any(a <= m.start() < b for a, b in keep) else REDACTED, text)
    keep = [m.span(2) for m in GOOGLE_ID_RE.finditer(text)]

    def long_token(m):
        if any(a <= m.start() < b for a, b in keep):
            return m.group(0)
        return REDACTED if _looks_random(m.group(0)) else m.group(0)
    return LONG_TOKEN_RE.sub(long_token, text)


def _looks_random(s):
    if HEX_RE.fullmatch(s):
        return True  # 32+ hex chars in free text: API keys and webhook secrets look like this
    if not (re.search(r'[0-9]', s) and re.search(r'[A-Za-z]', s)):
        return False
    parts = re.split(r'[-_]', s)
    if len(parts) > 2 and max(len(p) for p in parts) < 16:
        return False  # SKUs, slugs, part numbers, UUIDs: short dash/underscore-separated words
    classes = sum(bool(re.search(c, s)) for c in ('[a-z]', '[A-Z]', '[0-9]'))
    if classes < 3 and len(s) < 40:
        return False
    counts = {c: s.count(c) for c in set(s)}
    entropy = -sum(n / len(s) * math.log2(n / len(s)) for n in counts.values())
    return entropy >= 3.5


KEY_WORD_RE = re.compile(r'[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+')
SECRET_LAST_WORDS = {'password', 'passwd', 'pass', 'pwd', 'passphrase', 'passcode', 'secret', 'token',
                     'authorization', 'auth', 'credential', 'credentials', 'apikey', 'signature', 'privatekey', 'cookie'}
KEY_PREFIXES = {'api', 'private', 'access', 'secret', 'app', 'client', 'license', 'subscription', 'signing', 'encryption', 'auth'}
# Record ids are kept when they are the whole value of a field named like an id.
ID_KEY_RE = re.compile(r'^(?:[Ii][Dd]s?|uuid|UUID)$|[_-](?:[Ii][Dd]s?|uuid|UUID)$|[a-z0-9](?:Id|ID|Ids|IDs|Uuid)$')
ID_VALUE_RE = re.compile(r'[A-Za-z0-9_-]{8,}')
TEMPLATE_RE = re.compile(r'\{\{.*?\}\}', re.S)
BEARER_RE = re.compile(r'(?i)\b((?:bearer|basic)\s+)(?!\{\{)[A-Za-z0-9._~+/=-]{8,}')
URL_USERINFO_RE = re.compile(r'''(?i)\b([a-z][a-z0-9+.-]*://[^/\s:@'"{}]+:)(?!\{\{)[^@\s/'"]+@''')
# Query parameters; the name decides (see _is_secret_param): ?key=, ?api_token=, ?apiToken=, ?refresh_token=.
QUERY_PARAM_RE = re.compile(r'''([?&]([A-Za-z0-9_-]+)=)(?!\{\{)([^&#\s"']+)''')
BARE_SECRET_PARAMS = {'key', 'sig', 'token', 'auth', 'secret', 'pass', 'password', 'pwd', 'signature'}
# password = "..." / apiKey: '...' inside code steps or free text.
ASSIGNED_SECRET_RE = re.compile(
    r'''(?i)((?:passw(?:or)?d|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)["']?\s*[:=]\s*)(["'])(?!\{\{)[^"'\n]{4,}\2''')
KNOWN_TOKEN_RE = re.compile(
    r'\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}'
    r'|AKIA[0-9A-Z]{16}|shp(?:at|ss|ca|pa)_[0-9a-fA-F]{32}|AIza[0-9A-Za-z_-]{35})\b')
LONG_TOKEN_RE = re.compile(r'(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])')
# AWS secret access keys: exactly 40 chars of base64 alphabet (may contain / and +).
AWS_SECRET_RE = re.compile(r'(?<![A-Za-z0-9/+=])(?=[A-Za-z0-9/+]*[0-9])(?=[A-Za-z0-9/+]*[A-Z])(?=[A-Za-z0-9/+]*[a-z])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+=])')
HEX_RE = re.compile(r'[0-9a-fA-F]{32,}')
# Google Sheets / Docs / Drive ids inside their URLs are document ids, not credentials.
GOOGLE_ID_RE = re.compile(r'(https?://(?:docs|drive|sheets)\.google\.com/[^\s"\']*?(?:/d/|/folders/|[?&]id=))([A-Za-z0-9_-]{20,})')


# ---------- CLI ----------

def main(argv=None):
    p = argparse.ArgumentParser(description='Git-driven Activepieces flow deploys')
    p.add_argument('--repo', default=os.environ.get('AP_FLOWS_REPO', '.'), help='flows repo checkout')
    sub = p.add_subparsers(dest='cmd', required=True)
    e = sub.add_parser('export', help='source flow(s) -> managed/<key>.json')
    e.add_argument('keys', nargs='+')
    e.add_argument('--flow-id')
    e.add_argument('--name', help='source flow display name')
    for name in ('plan', 'apply', 'status'):
        s = sub.add_parser(name)
        s.add_argument('--target', default=os.environ.get('AP_DEPLOY_TARGET'))
    sub.add_parser('export-staff', help='target flows without a deploy key -> warehouse-made/')
    args = p.parse_args(argv)
    repo = os.path.abspath(args.repo)
    try:
        if args.cmd == 'export':
            export(Client.from_env('AP_SOURCE_'), repo, args.keys, args.flow_id, args.name)
            return 0
        client = Client.from_env()
        if args.cmd == 'export-staff':
            export_staff(client, repo)
            return 0
        if not args.target:
            raise ApiError('set AP_DEPLOY_TARGET or --target')
        if args.cmd == 'status':
            records = evaluate(client, repo, args.target)
            print(format_status(records))
            return 1 if _any_flagged(records) else 0
        records = apply(client, repo, args.target, dry_run=args.cmd == 'plan')
        if not any(r['action'] != 'none' for r in records):
            print('nothing to do')
        return 1 if _any_flagged(records) else 0
    except ApiError as e:
        print(f'error: {e}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
