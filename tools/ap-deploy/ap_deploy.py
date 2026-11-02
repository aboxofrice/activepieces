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
import hashlib
import json
import os
import re
import sys
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


class ApiError(Exception):
    pass


class Client:
    def __init__(self, url, project_id=None, api_key=None, email=None, password=None):
        self.url = url.rstrip('/')
        self.project_id = project_id
        if api_key:
            self.token = api_key
        elif email and password:
            res = self.request('POST', '/v1/authentication/sign-in', {'email': email, 'password': password}, auth=False)
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
        return piece.get('version') == version


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


def definition_hash(flow_def):
    """Hash of what the flow does (deps and deployKey are derived/bookkeeping, so excluded)."""
    core = {k: flow_def[k] for k in ('displayName', 'schemaVersion', 'notes', 'trigger')}
    return hashlib.sha256(canonical(core).encode()).hexdigest()[:16]


def target_hash(flow):
    return definition_hash(normalize_flow(flow['version'], None))


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
    if os.path.exists(path) and open(path, encoding='utf-8').read() == text:
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
    config = read_json(path)
    if target not in config:
        raise ApiError(f'{DEPLOY_FILE} has no "{target}" entry (targets: {", ".join(config) or "none"})')
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
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', key):
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
    """One record per managed flow: what state it is in and what apply would do."""
    wanted = load_deploy_config(repo, target)
    flows = client.flows()
    by_key = {}
    for f in flows:
        key = (f.get('metadata') or {}).get('deployKey')
        if key:
            by_key.setdefault(key, []).append(f)
    connections = client.connection_names()
    piece_cache = {}
    records = []
    for key in sorted(wanted):
        desired = 'ENABLED' if wanted[key].get('enabled') else 'DISABLED'
        rec = {'key': key, 'desired': desired, 'flow': None, 'status': None, 'action': 'none', 'reason': ''}
        records.append(rec)
        path = os.path.join(repo, MANAGED_DIR, f'{key}.json')
        if not os.path.exists(path):
            rec.update(state='error', reason=f'{MANAGED_DIR}/{key}.json missing')
            continue
        flow_def = read_json(path)
        rec['def'] = flow_def
        rec['sourceHash'] = definition_hash(flow_def)
        matches = by_key.get(key, [])
        if len(matches) > 1:
            rec.update(state='error', reason=f'{len(matches)} target flows carry this deployKey: {", ".join(f["id"] for f in matches)}')
            continue
        flow = matches[0] if matches else None
        rec['flow'] = flow
        rec['status'] = flow['status'] if flow else None
        missing = _missing_deps(client, flow_def, connections, piece_cache)
        meta = (flow or {}).get('metadata') or {}
        if flow and meta.get('deployHash') and target_hash(flow) != meta['deployHash']:
            rec.update(state='drifted', reason='edited on this server since the last apply; not overwritten')
        elif missing:
            rec.update(state='missing-deps', reason='missing ' + ', '.join(missing))
        elif not flow:
            rec.update(state='new', action='create')
        elif meta.get('sourceHash') != rec['sourceHash'] or not meta.get('deployHash') \
                or flow['publishedVersionId'] != flow['version']['id']:
            rec.update(state='changed', action='update')
        elif flow['status'] != desired:
            rec.update(state='in-sync', action='status')
        else:
            rec.update(state='in-sync')
    for key, matches in sorted(by_key.items()):
        if key not in wanted:
            for f in matches:
                records.append({'key': key, 'desired': None, 'flow': f, 'status': f['status'], 'action': 'none',
                                'state': 'unlisted', 'reason': f'not in {DEPLOY_FILE} for this server; left alone'})
    return records


def apply(client, repo, target, dry_run=False, log=print):
    records = evaluate(client, repo, target)
    for rec in records:
        key, action = rec['key'], rec['action']
        if action == 'none':
            if rec['state'] not in ('in-sync', 'unlisted'):
                log(f'skip {key}: {rec["state"]} - {rec["reason"]}')
            continue
        label = f'{action} {key} -> {rec["desired"]}'
        if dry_run:
            log(f'would {label}')
            continue
        try:
            flow_id = _apply_one(client, rec)
            rec['applied'] = True
            log(f'{label} ok (flow {flow_id})')
        except ApiError as e:
            rec['error'] = str(e)
            log(f'FAIL {label}: {e}')
    return records


def _apply_one(client, rec):
    flow = rec['flow']
    if rec['action'] == 'status':
        client.operate(flow['id'], 'CHANGE_STATUS', {'status': rec['desired']})
        return flow['id']
    flow_def = rec['def']
    if not flow:
        flow = client.request('POST', '/v1/flows', {
            'displayName': flow_def['displayName'], 'projectId': client.project_id,
            'folderName': MANAGED_FOLDER, 'metadata': {'deployKey': rec['key']}})
    client.operate(flow['id'], 'IMPORT_FLOW', to_import_request(flow_def))
    published = client.operate(flow['id'], 'LOCK_AND_PUBLISH', {'status': rec['desired']})
    if published['status'] != rec['desired']:
        client.operate(flow['id'], 'CHANGE_STATUS', {'status': rec['desired']})
    fresh = client.flow(flow['id'])
    client.operate(flow['id'], 'UPDATE_METADATA', {'metadata': {
        **(fresh.get('metadata') or {}), 'deployKey': rec['key'], 'sourceHash': rec['sourceHash'],
        'deployHash': target_hash(fresh), 'deployedAt': datetime.now(timezone.utc).isoformat(timespec='seconds')}})
    return flow['id']


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
    return any(r.get('error') or r['state'] in ('error', 'drifted', 'missing-deps') for r in records)


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
