#!/usr/bin/env python3
"""
Git-driven flow deploys for Activepieces.

Flows Vu builds on the Mac are exported to `managed/<deploy-key>.json` in a checkout of the flows
repo; a target server applies them from there, matching flows by `metadata.deployKey`. Flows without
a deploy key belong to staff: apply never touches them (they are protected by the database backups).

Usage:
    ap_deploy.py export <deploy-key> --flow-id <id> | --name "<display name>"   # first export
    ap_deploy.py export <deploy-key>...                                          # re-export (by deployKey)
    ap_deploy.py plan                      # what apply would do on AP_DEPLOY_TARGET
    ap_deploy.py apply                     # do it
    ap_deploy.py status                    # state of every managed flow on the target

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
# v3: the target flow is hashed in placeholder form (cross-flow references, base URL).
HASH_VERSION = 3
# Cross-flow references. Flow ids differ per server, so export writes a reference to another managed
# flow as a placeholder keyed by its deployKey, and apply resolves it to that flow on the target:
#   {{ap-flow:<key>}}           the flow's id (webhook URLs /api/v1/webhooks/<id>, code inputs)
#   {{ap-flow-external:<key>}}  the flow's externalId (subflows "Call Flow": input flow.externalId)
#   {{ap-base-url}}             the server's own base URL (no trailing slash, no /api)
FLOW_REF = '{{ap-flow:%s}}'
FLOW_EXTERNAL_REF = '{{ap-flow-external:%s}}'
BASE_URL_REF = '{{ap-base-url}}'
SERVER_URL_RE = re.compile(
    r'https?://(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|host\.docker\.internal|[A-Za-z0-9-]+\.local'
    r'|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?(?![A-Za-z0-9.-])')
PLACEHOLDER_RE = re.compile(r'\{\{ap-(flow|flow-external):([a-z0-9][a-z0-9-]*)\}\}|\{\{ap-base-url\}\}')
# States that need a human; status exits 1 and ap-sync logs them.
FLAGGED_STATES = ('error', 'drifted', 'missing-deps')
GATEWAY_ERRORS = (502, 503, 504)


class ApiError(Exception):
    """status is the HTTP status when the server answered with an error; None when the request
    may not have reached it or its answer was lost (connection error, timeout, unreadable body)."""

    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class Client:
    def __init__(self, url, project_id=None, api_key=None, email=None, password=None):
        self.url = url.rstrip('/')
        # What {{ap-base-url}} resolves to on this target (see README "Cross-flow references").
        self.base_url = (os.environ.get('AP_DEPLOY_BASE_URL') or self.url).rstrip('/')
        self.project_id = project_id
        self.platform_id = os.environ.get('AP_PLATFORM_ID') or None
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
            self.platform_id = self.platform_id or res.get('platformId')
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
            raise ApiError(f'{method} {path.split("?")[0]} -> {e.code}: {e.read().decode(errors="replace")[:500]}', status=e.code) from None
        except urllib.error.URLError as e:
            raise ApiError(f'{method} {self.url}: {e.reason}') from None
        except OSError as e:  # timeouts and resets while reading the response
            raise ApiError(f'{method} {self.url}: {type(e).__name__}: {e}') from None

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

    def hidden_pieces(self):
        """Names the platform hides (EE filteredPieceNames with BLOCKED), or None when nothing can
        be hidden here: Community (filtering is EE-only), an allow-list filter, or no platform id."""
        if not self.platform_id:
            return None
        flags = self.request('GET', '/v1/flags')
        if not isinstance(flags, dict) or flags.get('EDITION') != 'ee':
            return None
        platform = self.request('GET', f'/v1/platforms/{self.platform_id}')
        if platform.get('filteredPieceBehavior') != 'BLOCKED':
            return None
        return set(platform.get('filteredPieceNames') or [])

    def set_hidden_pieces(self, names):
        self.request('POST', f'/v1/platforms/{self.platform_id}', {'filteredPieceNames': sorted(names)})

    def has_piece(self, name, version):
        try:
            piece = self.request('GET', f'/v1/pieces/{name}?{urllib.parse.urlencode({"version": version})}')
        except ApiError as e:
            if ' -> 404' in str(e):
                return False
            raise
        return isinstance(piece, dict) and piece.get('version') == version


# ---------- normalization ----------

def normalize_flow(version, deploy_key, refs=None):
    """Strip ids, timestamps, sample data and owner bits from a flow version; derive deps.

    refs (from source_refs/target_refs) turns other flows' ids and the server's base URL into
    placeholders, so the file (and every hash) is the same whatever ids the flows have."""
    trigger = _normalize_step(version['trigger'])
    if refs:
        trigger = to_placeholders(trigger, refs)
    return {
        'deployKey': deploy_key,
        'displayName': version['displayName'],
        'schemaVersion': version.get('schemaVersion') or SCHEMA_VERSION,
        'notes': [{k: v for k, v in n.items() if k not in NOTE_DROP} for n in version.get('notes') or []],
        'trigger': trigger,
        'pieces': pieces_used(trigger),
        'connections': connections_used(trigger),
        'flowRefs': flow_refs_used(trigger),
    }


def definition_hash(flow_def, hash_version=HASH_VERSION):
    """Hash of what the flow does (deps and deployKey are derived/bookkeeping, so excluded).

    schemaVersion is left out (v2): the server's flow-version migration bumps it on every image
    upgrade without anyone editing the flow. Version 1 hashes (older metadata) included it."""
    fields = ('displayName', 'schemaVersion', 'notes', 'trigger') if hash_version == 1 else ('displayName', 'notes', 'trigger')
    core = {k: flow_def.get(k) for k in fields}
    return hashlib.sha256(canonical(core).encode()).hexdigest()[:16]


def target_hash(flow, hash_version=HASH_VERSION, refs=None):
    """Hash of a flow on the target. From v3 it is taken in placeholder form: the target's ids of
    managed flows (and the ids this flow was last resolved against, see deployRefs) and its base URL
    are turned back into placeholders, so a referenced flow getting a new id is not an edit."""
    return definition_hash(normalize_flow(flow['version'], None, _flow_refs_for(flow, refs) if hash_version >= 3 else None),
                           hash_version)


def check_drift(flow, meta, refs=None):
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
    if target_hash(flow, stored_version, refs) == meta['deployHash']:
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


# ---------- cross-flow references ----------

def source_refs(flows, base_urls=()):
    """Reverse map for export: every source flow carrying a deployKey (id and externalId), plus the
    source's own base URL(s). localhost and 127.0.0.1 are treated as the same host."""
    by_value = {}
    for f in flows:
        key = (f.get('metadata') or {}).get('deployKey') if isinstance(f.get('metadata'), dict) else None
        if key:
            by_value[f['id']] = FLOW_REF % key
            if f.get('externalId') and f['externalId'] != f['id']:
                by_value[f['externalId']] = FLOW_EXTERNAL_REF % key
    urls = set()
    for url in base_urls:
        if not url:
            continue
        url = url.rstrip('/')
        urls.add(url)
        for a, b in (('://localhost', '://127.0.0.1'), ('://127.0.0.1', '://localhost')):
            if a in url:
                urls.add(url.replace(a, b))
    return {'values': by_value, 'base_urls': sorted(urls)}


def target_refs(flows, base_url):
    """{deploy key: {'id', 'externalId'}} for keys carried by exactly one flow on the target, and the
    base URL that {{ap-base-url}} resolves to."""
    seen = {}
    for f in flows:
        meta = f.get('metadata')
        key = meta.get('deployKey') if isinstance(meta, dict) else None
        if key:
            seen.setdefault(key, []).append(f)
    keys = {k: {'id': m[0]['id'], 'externalId': m[0].get('externalId') or m[0]['id']} for k, m in seen.items() if len(m) == 1}
    return {'keys': keys, 'base_url': base_url.rstrip('/')}


def to_placeholders(obj, refs):
    """Replace known flow ids/externalIds (whole tokens) and base URLs in every string of obj."""
    values, urls = refs.get('values') or {}, refs.get('base_urls') or []
    if not values and not urls:
        return obj
    id_re = re.compile(r'(?<![A-Za-z0-9])(' + '|'.join(map(re.escape, sorted(values, key=len, reverse=True))) + r')(?![A-Za-z0-9])') if values else None
    # A base URL only matches whole: http://localhost:8080 must not match http://localhost:80801.
    url_re = re.compile('(' + '|'.join(map(re.escape, sorted(urls, key=len, reverse=True))) + r')(?![A-Za-z0-9.:-])') if urls else None

    def fix(text):
        if url_re:
            text = url_re.sub(BASE_URL_REF, text)
        if id_re:
            text = id_re.sub(lambda m: values[m.group(1)], text)
        return text
    return _map_strings(obj, fix)


def resolve_placeholders(obj, refs):
    """Placeholders -> the target's ids and base URL. Returns (resolved, sorted missing deploy keys)."""
    keys, missing = refs.get('keys') or {}, set()

    def fix(text):
        def one(m):
            if m.group(0) == BASE_URL_REF:
                return refs['base_url']
            kind, key = m.group(1), m.group(2)
            if key not in keys:
                missing.add(key)
                return m.group(0)
            return keys[key]['id' if kind == 'flow' else 'externalId']
        return PLACEHOLDER_RE.sub(one, text)
    resolved = _map_strings(obj, fix)
    return resolved, sorted(missing)


def flow_refs_used(trigger):
    """Deploy keys of the other managed flows a flow references (via placeholders)."""
    return sorted({m.group(2) for text in _strings(trigger) for m in PLACEHOLDER_RE.finditer(text) if m.group(2)})


def uses_base_url(trigger):
    return any(BASE_URL_REF in text for text in _strings(trigger))


def resolution_record(trigger, refs):
    """What the placeholders of trigger resolve to now (stored as deployRefs/deployBaseUrl)."""
    keys = refs.get('keys') or {}
    return {k: dict(keys[k]) for k in flow_refs_used(trigger) if k in keys}


def _flow_refs_for(flow, refs):
    """Reverse map for hashing one target flow: the target's current managed ids plus the ids and
    base URL recorded when this flow was last applied (so a referenced flow's new id is not drift)."""
    meta = flow.get('metadata') if isinstance(flow.get('metadata'), dict) else {}
    values, urls = {}, set()
    for key, ids in (meta.get('deployRefs') or {}).items():
        if isinstance(ids, dict):
            if ids.get('id'):
                values[ids['id']] = FLOW_REF % key
            if ids.get('externalId') and ids.get('externalId') != ids.get('id'):
                values[ids['externalId']] = FLOW_EXTERNAL_REF % key
    if meta.get('deployBaseUrl'):
        urls.add(meta['deployBaseUrl'])
    if refs:
        for key, ids in (refs.get('keys') or {}).items():
            values[ids['id']] = FLOW_REF % key
            if ids['externalId'] != ids['id']:
                values[ids['externalId']] = FLOW_EXTERNAL_REF % key
        if refs.get('base_url'):
            urls.add(refs['base_url'])
    return {'values': values, 'base_urls': sorted(urls)}


def _strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, list):
        for v in obj:
            yield from _strings(v)
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _strings(v)


def _map_strings(obj, fn):
    if isinstance(obj, str):
        return fn(obj)
    if isinstance(obj, list):
        return [_map_strings(v, fn) for v in obj]
    if isinstance(obj, dict):
        return {k: _map_strings(v, fn) for k, v in obj.items()}
    return obj


def to_import_request(flow_def, refs=None):
    now = datetime.now(timezone.utc).isoformat()
    return {
        'displayName': flow_def['displayName'],
        'schemaVersion': flow_def['schemaVersion'],
        'notes': [dict(n, ownerId=None, createdAt=now, updatedAt=now) for n in flow_def.get('notes') or []],
        'trigger': _stamp_step(copy.deepcopy(resolve_placeholders(flow_def['trigger'], refs)[0] if refs else flow_def['trigger']), now),
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


# ---------- export (source instance) ----------

def export(client, repo, keys, flow_id=None, name=None, base_urls=(), log=print):
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
        stamped = [dict(f, metadata={**(f.get('metadata') or {}), 'deployKey': key}) if f['id'] == flow['id'] else f for f in flows]
        flow_def = normalize_flow(version, key, source_refs(stamped, [client.url, *base_urls]))
        for url in leftover_server_urls(flow_def['trigger'], _frontend_url(client)):
            log(f'warn {key}: still contains {url}, a server-local address that was not turned into {BASE_URL_REF}; '
                'it will not work on the target (use --base-url if it is this server)')
        for other in unmanaged_refs(flow_def['trigger'], stamped):
            log(f'warn {key}: references flow {other["id"]} ("{other["version"]["displayName"]}"), which has no deployKey; '
                'export it first and re-export this one, or the reference breaks on the target')
        path = os.path.join(repo, MANAGED_DIR, f'{key}.json')
        changed = write_json(path, flow_def)
        if existing_key != key:
            client.operate(flow['id'], 'UPDATE_METADATA', {'metadata': {**(flow.get('metadata') or {}), 'deployKey': key}})
        if version['state'] != 'LOCKED':
            log(f'warn {key}: exported the DRAFT version of "{version["displayName"]}" (not yet published on source)')
        log(f'export {key}: {"wrote" if changed else "unchanged"} {os.path.relpath(path, repo)} '
            f'({len(flow_def["pieces"])} pieces, connections: {", ".join(flow_def["connections"]) or "none"}'
            f'{", flows: " + ", ".join(flow_def["flowRefs"]) if flow_def["flowRefs"] else ""})')
        written.append(path)
    return written


def leftover_server_urls(trigger, frontend_url=None):
    """Server-local URLs left after export: localhost, host.docker.internal, *.local, private
    (LAN) IPs, and the source's frontend URL. Placeholders are already gone from these strings."""
    found = set()
    for text in _strings(trigger):
        for m in SERVER_URL_RE.finditer(text):
            found.add(m.group(0))
        if frontend_url and frontend_url in text:
            found.add(frontend_url)
    return sorted(found)


def _frontend_url(client):
    try:
        flags = client.request('GET', '/v1/flags')
    except Exception:  # noqa: BLE001 - only used for a warning
        return None
    url = (flags.get('PUBLIC_URL') or flags.get('FRONTEND_URL')) if isinstance(flags, dict) else None
    return url.rstrip('/') if isinstance(url, str) and url else None


def unmanaged_refs(trigger, flows):
    """Source flows without a deployKey whose id or externalId still appears in trigger."""
    text = '\n'.join(_strings(trigger))
    found = []
    for f in flows:
        if (f.get('metadata') or {}).get('deployKey'):
            continue
        for value in {f['id'], f.get('externalId')} - {None}:
            if re.search(r'(?<![A-Za-z0-9])' + re.escape(value) + r'(?![A-Za-z0-9])', text):
                found.append(f)
                break
    return found


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
    refs = target_refs(flows, getattr(client, 'base_url', client.url))
    piece_cache = {}
    records = []
    for key in sorted(wanted):
        matches = by_key.get(key, [])
        rec = {'key': key, 'desired': None, 'flow': matches[0] if len(matches) == 1 else None,
               'status': matches[0].get('status') if len(matches) == 1 else None,
               'matches': matches, 'action': 'none', 'state': 'error', 'reason': '', 'refs': refs}
        records.append(rec)
        try:
            entry = wanted[key]
            if not isinstance(entry, dict) or not isinstance(entry.get('enabled', False), bool) \
                    or not isinstance(entry.get('overwrite', ''), str):
                raise ValueError(f'{DEPLOY_FILE} entry must look like {{"enabled": true}} ("overwrite" is a string)')
            rec['desired'] = 'ENABLED' if entry.get('enabled') else 'DISABLED'
            rec['overwrite'] = entry.get('overwrite') or None
            _classify(client, repo, rec, connections, piece_cache)
        except Exception as e:  # noqa: BLE001 - isolate one bad record from the rest
            rec.update(state='error', action='none', reason=f'{type(e).__name__}: {e}'[:300])
    _check_flow_refs(records, refs)
    for rec in records:
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
    refs = rec['refs']
    drifted, rec['rebaseline'] = check_drift(flow, meta, refs)
    if drifted and _interrupted_apply(flow, meta, rec['sourceHash'], refs):
        drifted = False
        rec['interrupted'] = True
    # One-shot "let git win" from deploy.json: a new "overwrite" token replaces a drifted flow (and
    # undoes a stop made in the UI) once; it is recorded so later staff edits are flagged again.
    if rec['overwrite'] and flow and rec['overwrite'] != meta.get('overwriteApplied'):
        drifted = False
        rec['interrupted'] = True
        meta = {**meta, 'deployedStatus': None}
    known_source = {rec['sourceHash']}
    # The server copy already equals the git file (e.g. a staff edit was exported into git): adopt
    # it as the new baseline instead of flagging drift or re-importing.
    if drifted and flow['publishedVersionId'] == flow['version']['id'] and target_hash(flow, refs=refs) == rec['sourceHash']:
        drifted = False
        rec['rebaseline'] = True
        known_source.add(meta.get('sourceHash'))
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
    elif _refs_changed(flow_def, meta, refs):
        rec.update(state='changed', action='update', reason='a referenced flow or the base URL changed on this server; re-resolving')
    elif flow['status'] != desired:
        rec.update(state='in-sync', action='status')
    elif rec['rebaseline'] or meta.get('deployedStatus') != flow['status']:
        rec.update(state='in-sync', action='rebaseline')
    else:
        rec.update(state='in-sync')


def _check_flow_refs(records, refs):
    """A flow whose placeholders name a flow that is not on the target and will not be created in
    this pass is deferred (missing-deps) and retried next pass. Repeated until nothing changes,
    because deferring a flow that others reference defers those too."""
    while True:
        will_exist = set(refs['keys']) | {r['key'] for r in records if r['action'] == 'create'}
        changed = False
        for rec in records:
            if rec['action'] not in ('create', 'update') or not rec.get('def'):
                continue
            missing = [k for k in flow_refs_used(rec['def']['trigger']) if k not in will_exist and k != rec['key']]
            if missing:
                rec.update(state='missing-deps', action='none',
                           reason=f'references flow {", ".join(missing)}, not on this server yet (not listed in {DEPLOY_FILE} '
                                  'or not applicable this pass); deferred, retried next pass')
                changed = True
        if not changed:
            return


def _refs_changed(flow_def, meta, refs):
    """The placeholders would now resolve to other ids (a referenced flow was recreated) or another
    base URL than at the last apply: the flow must be re-imported, though nobody edited it."""
    trigger = flow_def['trigger']
    if resolution_record(trigger, refs) != (meta.get('deployRefs') or {}):
        return True
    return uses_base_url(trigger) and meta.get('deployBaseUrl') != refs['base_url']


def _interrupted_apply(flow, meta, source_hash, refs=None):
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
        return target_hash(flow, refs=refs) == meta['applyingHash']
    return pending == source_hash


def _kill_switch(rec):
    """`"enabled": false` always turns a flow off, even one that is drifted, missing deps or broken."""
    if rec['desired'] != 'DISABLED' or rec['action'] in ('create', 'update', 'status'):
        return
    on = [f['id'] for f in rec['matches'] if f.get('status') == 'ENABLED']
    if on:
        rec.update(action='disable', disable_ids=on)


def unhide_needed_pieces(client, repo, target, dry_run=False, log=print):
    """A hidden piece cannot be loaded, so a managed flow using one would fail to import. Unhide
    exactly the pieces the listed flows need (the user's rule: never hide a piece a flow uses).

    Returns {deploy key: reason} for flows to skip because their pieces could not be unhidden."""
    try:
        hidden = client.hidden_pieces()
    except ApiError as e:
        log(f'could not read the platform piece filter ({e}); hidden pieces are not checked this pass')
        return {}
    if not hidden:
        return {}
    try:
        wanted = load_deploy_config(repo, target)
    except Exception:  # noqa: BLE001 - evaluate() reports a bad deploy.json
        return {}
    needed_by = {}
    for key in sorted(wanted):
        try:
            flow_def = read_json(os.path.join(repo, MANAGED_DIR, f'{key}.json'))
            names = {p['name'] for p in pieces_used(flow_def['trigger'])}
        except Exception:  # noqa: BLE001 - evaluate() reports a broken flow file
            continue
        for name in sorted(names & hidden):
            needed_by.setdefault(name, []).append(key)
    if not needed_by:
        return {}
    if dry_run:
        for name, keys in sorted(needed_by.items()):
            log(f'would unhide {name} (needed by flow {", ".join(keys)})')
        return {}
    try:
        client.set_hidden_pieces(hidden - set(needed_by))
    except ApiError as e:
        skip = {}
        for name, keys in needed_by.items():
            for key in keys:
                skip.setdefault(key, []).append(name)
        log(f'could not unhide {", ".join(sorted(needed_by))}: {e}')
        return {key: f'needs hidden piece {", ".join(names)}; unhiding it failed' for key, names in skip.items()}
    for name, keys in sorted(needed_by.items()):
        log(f'unhid {name} (needed by flow {", ".join(keys)})')
    return {}


def apply(client, repo, target, dry_run=False, log=print):
    lock = None if dry_run else _apply_lock(client, log)
    try:
        blocked = unhide_needed_pieces(client, repo, target, dry_run, log)
        records = evaluate(client, repo, target)
        for rec in records:
            if rec['key'] in blocked and rec['action'] != 'disable' and rec['state'] != 'unlisted':
                rec.update(state='missing-deps', action='none', reason=blocked[rec['key']])
        if blocked:
            _check_flow_refs(records, next(r['refs'] for r in records if 'refs' in r))
            for rec in records:
                _kill_switch(rec)
        if not dry_run:
            _create_shells(client, records, log)
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
                _disable_after_failure(client, rec, log)
        return records
    finally:
        if lock:
            lock.close()


def _disable_after_failure(client, rec, log):
    """The kill switch still holds when the apply itself failed (e.g. an unresolved reference): a
    flow deploy.json wants off must not stay on because its import did not go through."""
    if rec['desired'] != 'DISABLED' or rec['action'] == 'disable':
        return
    for flow in rec.get('matches') or []:
        try:
            fresh = client.flow(flow['id'])
            if fresh.get('status') != 'ENABLED':
                continue
            client.operate(flow['id'], 'CHANGE_STATUS', {'status': 'DISABLED'})
            _update_metadata(client, client.flow(flow['id']), {'deployedStatus': 'DISABLED'})
            log(f'disable {rec["key"]} -> DISABLED ok (flow {flow["id"]}; apply failed, deploy.json wants it off)')
        except Exception as e:  # noqa: BLE001
            log(f'FAIL disable {rec["key"]}: {type(e).__name__}: {e}')


def _create_shells(client, records, log):
    """Create every new flow (empty, in the managed folder) before importing any, so flows that
    reference each other resolve to real ids whatever order, cycles included. A shell carries
    applyingSourceHash and no deployHash, so if its import fails the next pass finishes it."""
    for rec in records:
        if rec['action'] != 'create':
            continue
        try:
            flow = client.request('POST', '/v1/flows', {
                'displayName': rec['def']['displayName'], 'projectId': client.project_id, 'folderName': MANAGED_FOLDER,
                'metadata': {'deployKey': rec['key'], 'applyingSourceHash': rec['sourceHash'], 'applyingHash': None}})
        except Exception as e:  # noqa: BLE001 - its dependents then fail to resolve and are logged
            rec.update(action='none', error=str(e))
            log(f'FAIL create {rec["key"]}: {type(e).__name__}: {e}')
            continue
        rec.update(flow=flow, shell=True)
        rec['refs']['keys'][rec['key']] = {'id': flow['id'], 'externalId': flow.get('externalId') or flow['id']}


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
    flow, refs = rec['flow'], rec['refs']
    if action in ('status', 'rebaseline'):
        if action == 'status':
            client.operate(flow['id'], 'CHANGE_STATUS', {'status': rec['desired']})
        fresh = client.flow(flow['id'])
        extra = {'deployedStatus': fresh['status']}
        if rec.get('rebaseline'):
            extra.update(_baseline(fresh, refs), sourceHash=rec['sourceHash'])
        _update_metadata(client, fresh, extra)
        return flow['id']
    flow_def = rec['def']
    request = to_import_request(flow_def, refs)
    _, unresolved = resolve_placeholders(flow_def['trigger'], refs)
    if unresolved:
        raise ApiError(f'references flow {", ".join(unresolved)}, which could not be created on this server; retried next pass')
    pending = {'applyingSourceHash': rec['sourceHash'], 'applyingHash': None}
    if not flow:
        flow = client.request('POST', '/v1/flows', {
            'displayName': flow_def['displayName'], 'projectId': client.project_id,
            'folderName': MANAGED_FOLDER, 'metadata': {'deployKey': rec['key'], **pending}})
    elif not rec.get('shell'):
        _update_metadata(client, client.flow(flow['id']), pending)
    try:
        client.operate(flow['id'], 'IMPORT_FLOW', request)
    except ApiError as e:
        # The server answered with an error, so nothing was imported: drop the pending hash, or a
        # later staff edit could be mistaken for our import and overwritten. On a timeout,
        # connection error or proxy gateway error (502/503/504: the app may still be working on
        # it) the import may have gone through, so keep it: the next pass then finishes the apply
        # instead of flagging our own import as drift.
        if e.status is not None and e.status not in GATEWAY_ERRORS:
            _update_metadata(client, client.flow(flow['id']), {}, drop=('applyingSourceHash', 'applyingHash'))
        raise
    imported = client.flow(flow['id'])
    _update_metadata(client, imported, {'applyingHash': target_hash(imported, refs=refs)})
    published = client.operate(flow['id'], 'LOCK_AND_PUBLISH', {'status': rec['desired']})
    if published['status'] != rec['desired']:
        client.operate(flow['id'], 'CHANGE_STATUS', {'status': rec['desired']})
    fresh = client.flow(flow['id'])
    resolved = {'deployRefs': resolution_record(flow_def['trigger'], refs),
                'deployBaseUrl': refs['base_url'] if uses_base_url(flow_def['trigger']) else None}
    _update_metadata(client, fresh, {
        'deployKey': rec['key'], 'sourceHash': rec['sourceHash'], **_baseline(fresh, refs), **resolved,
        'deployedStatus': fresh['status'], 'deployedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        **({'overwriteApplied': rec['overwrite']} if rec.get('overwrite') else {})},
        drop=('applyingSourceHash', 'applyingHash'))
    return flow['id']


def _baseline(fresh, refs=None):
    """What the flow looks like right after an apply; drift is measured against it."""
    return {'deployHash': target_hash(fresh, refs=refs), 'hashVersion': HASH_VERSION,
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


def pieces_file_mismatches(repo, pieces_path):
    """Pieces (name@version) the managed flows in repo use that pieces_path does not pin.

    A fresh server has only the latest version of each official piece, so every version a flow
    references must be installed by the installer from pieces.txt. Extra lines are allowed
    (pieces staff flows use)."""
    pinned = set()
    with open(pieces_path, encoding='utf-8') as f:
        for line in f:
            parts = line.split('#', 1)[0].split()
            if len(parts) >= 2:
                pinned.add((parts[0], parts[1]))
    used = {}
    managed = os.path.join(repo, MANAGED_DIR)
    for name in sorted(os.listdir(managed)):
        if not name.endswith('.json'):
            continue
        flow_def = read_json(os.path.join(managed, name))
        for p in flow_def.get('pieces') or pieces_used(flow_def['trigger']):
            used.setdefault((p['name'], p['version']), []).append(name[:-5])
    return [f'{n}@{v} (used by {", ".join(keys)})' for (n, v), keys in sorted(used.items()) if (n, v) not in pinned]


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


# ---------- CLI ----------

def main(argv=None):
    p = argparse.ArgumentParser(description='Git-driven Activepieces flow deploys')
    p.add_argument('--repo', default=os.environ.get('AP_FLOWS_REPO', '.'), help='flows repo checkout')
    sub = p.add_subparsers(dest='cmd', required=True)
    e = sub.add_parser('export', help='source flow(s) -> managed/<key>.json')
    e.add_argument('keys', nargs='+')
    e.add_argument('--flow-id')
    e.add_argument('--name', help='source flow display name')
    e.add_argument('--base-url', action='append', default=[],
                   help='another URL the source is reached by, written as {{ap-base-url}} (the source AP URL always is)')
    c = sub.add_parser('check-pieces', help='fail if pieces.txt misses a piece version a managed flow uses')
    c.add_argument('pieces_file')
    for name in ('plan', 'apply', 'status'):
        s = sub.add_parser(name)
        s.add_argument('--target', default=os.environ.get('AP_DEPLOY_TARGET'))
    args = p.parse_args(argv)
    repo = os.path.abspath(args.repo)
    try:
        if args.cmd == 'check-pieces':
            missing = pieces_file_mismatches(repo, args.pieces_file)
            for m in missing:
                print(f'not in {args.pieces_file}: {m}')
            print('pieces.txt covers every managed flow' if not missing else f'{len(missing)} missing')
            return 1 if missing else 0
        if args.cmd == 'export':
            export(Client.from_env('AP_SOURCE_'), repo, args.keys, args.flow_id, args.name, args.base_url)
            return 0
        client = Client.from_env()
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
