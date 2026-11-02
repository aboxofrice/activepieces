"""Unit tests for ap_deploy / ap_sync logic against an in-memory fake Activepieces.

Run from tools/ap-deploy:  python3 -m unittest discover -s tests -v
"""
import copy
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import ap_deploy  # noqa: E402

PIECE = {'name': '@activepieces/piece-webhook', 'version': '0.1.43'}


def make_trigger(code='return 1'):
    return {
        'name': 'trigger', 'displayName': 'Catch Webhook', 'type': 'PIECE_TRIGGER', 'valid': True,
        'settings': {'pieceName': PIECE['name'], 'pieceVersion': PIECE['version'], 'triggerName': 'catch_webhook',
                     'input': {}, 'propertySettings': {}},
        'nextAction': {'name': 'step_1', 'displayName': 'Code', 'type': 'CODE', 'valid': True,
                       'settings': {'input': {}, 'sourceCode': {'code': code, 'packageJson': '{}'}}, 'nextAction': None},
    }


def make_def(key, code='return 1', schema='22'):
    trigger = make_trigger(code)
    return {'deployKey': key, 'displayName': key.title(), 'schemaVersion': schema, 'notes': [], 'trigger': trigger,
            'pieces': ap_deploy.pieces_used(trigger), 'connections': ap_deploy.connections_used(trigger)}


class FakeAP:
    """Just enough of the flows API for evaluate/apply."""

    def __init__(self):
        self.url = 'http://fake'
        self.project_id = 'proj'
        self._flows = {}
        self._n = 0
        self.calls = []

    def _id(self, prefix):
        self._n += 1
        return f'{prefix}{self._n}'

    def flows(self):
        return [copy.deepcopy(f) for f in self._flows.values()]

    def flow(self, flow_id):
        return copy.deepcopy(self._flows[flow_id])

    def connection_names(self):
        return set()

    def has_piece(self, name, version):
        return True

    def request(self, method, path, body=None, auth=True):
        assert (method, path) == ('POST', '/v1/flows')
        fid = self._id('flow')
        vid = self._id('ver')
        self._flows[fid] = {'id': fid, 'status': 'DISABLED', 'metadata': body.get('metadata'), 'publishedVersionId': None,
                            'created': '2026-01-01', 'version': {'id': vid, 'state': 'DRAFT', 'displayName': body['displayName'],
                                                                'schemaVersion': '22', 'notes': [], 'trigger': make_trigger()}}
        self.calls.append(('create', fid))
        return copy.deepcopy(self._flows[fid])

    def operate(self, flow_id, op_type, request):
        f = self._flows[flow_id]
        self.calls.append((op_type, flow_id))
        if op_type == 'IMPORT_FLOW':
            if f['version']['state'] == 'LOCKED':
                f['version'] = dict(f['version'], id=self._id('ver'), state='DRAFT')
            f['version'].update(displayName=request['displayName'], schemaVersion=request['schemaVersion'],
                                notes=request['notes'], trigger=request['trigger'])
        elif op_type == 'LOCK_AND_PUBLISH':
            f['version']['state'] = 'LOCKED'
            f['publishedVersionId'] = f['version']['id']
            f['status'] = request['status']
        elif op_type == 'CHANGE_STATUS':
            f['status'] = request['status']
        elif op_type == 'UPDATE_METADATA':
            f['metadata'] = request['metadata']
        return copy.deepcopy(f)

    # helpers simulating things that happen on the server outside ap-sync
    def staff_edit(self, flow_id, code):
        f = self._flows[flow_id]
        trigger = copy.deepcopy(f['version']['trigger'])
        trigger['nextAction']['settings']['sourceCode']['code'] = code
        f['version'] = dict(f['version'], id=self._id('ver'), state='DRAFT', trigger=trigger)

    def migrate_in_place(self, flow_id, new_schema='23'):
        """What flow-version-migration.service does on an image upgrade: same version row, new schema."""
        v = self._flows[flow_id]['version']
        v['schemaVersion'] = new_schema
        v['trigger']['settings']['input']['addedByMigration'] = True


class Repo:
    def __init__(self, test):
        self.tmp = tempfile.TemporaryDirectory()
        test.addCleanup(self.tmp.cleanup)
        self.path = self.tmp.name
        os.makedirs(os.path.join(self.path, ap_deploy.MANAGED_DIR))

    def put(self, key, flow_def):
        ap_deploy.write_json(os.path.join(self.path, ap_deploy.MANAGED_DIR, f'{key}.json'), flow_def)

    def put_raw(self, key, text):
        with open(os.path.join(self.path, ap_deploy.MANAGED_DIR, f'{key}.json'), 'w') as f:
            f.write(text)

    def deploy(self, entries):
        with open(os.path.join(self.path, ap_deploy.DEPLOY_FILE), 'w') as f:
            json.dump({'warehouse': entries}, f)


def apply(ap, repo):
    return {r['key']: r for r in ap_deploy.apply(ap, repo.path, 'warehouse', log=lambda m: None)}


def evaluate(ap, repo):
    return {r['key']: r for r in ap_deploy.evaluate(ap, repo.path, 'warehouse')}


def flow_of(ap, key):
    [f] = [f for f in ap.flows() if (f.get('metadata') or {}).get('deployKey') == key]
    return f


class HashTests(unittest.TestCase):
    def test_schema_version_not_in_hash(self):
        self.assertEqual(ap_deploy.definition_hash(make_def('a', schema='22')),
                         ap_deploy.definition_hash(make_def('a', schema='23')))

    def test_legacy_hash_includes_schema(self):
        self.assertNotEqual(ap_deploy.definition_hash(make_def('a', schema='22'), 1),
                            ap_deploy.definition_hash(make_def('a', schema='23'), 1))


class ApplyTests(unittest.TestCase):
    def setUp(self):
        self.ap, self.repo = FakeAP(), Repo(self)
        self.repo.put('a', make_def('a'))
        self.repo.deploy({'a': {'enabled': True}})

    def test_create_then_in_sync(self):
        r = apply(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r.get('applied')), ('new', True))
        meta = flow_of(self.ap, 'a')['metadata']
        self.assertEqual(meta['deployedStatus'], 'ENABLED')
        self.assertEqual(meta['hashVersion'], ap_deploy.HASH_VERSION)
        self.assertEqual(meta['deploySchemaVersion'], '22')
        r = evaluate(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('in-sync', 'none'))

    def test_upgrade_migration_rebaselines_instead_of_drift(self):
        apply(self.ap, self.repo)
        fid = flow_of(self.ap, 'a')['id']
        self.ap.migrate_in_place(fid)
        r = evaluate(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('in-sync', 'rebaseline'))
        apply(self.ap, self.repo)
        meta = flow_of(self.ap, 'a')['metadata']
        self.assertEqual(meta['deploySchemaVersion'], '23')
        r = evaluate(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('in-sync', 'none'))

    def test_staff_edit_after_upgrade_is_still_drift(self):
        apply(self.ap, self.repo)
        fid = flow_of(self.ap, 'a')['id']
        self.ap.migrate_in_place(fid)
        self.ap.staff_edit(fid, 'return 2')  # new version id, newer schema: must not be rebaselined
        r = evaluate(self.ap, self.repo)['a']
        self.assertEqual(r['state'], 'drifted')

    def test_staff_edit_is_drift_and_not_overwritten(self):
        apply(self.ap, self.repo)
        fid = flow_of(self.ap, 'a')['id']
        self.ap.staff_edit(fid, 'return 2')
        self.repo.put('a', make_def('a', code='return 3'))
        r = apply(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('drifted', 'none'))
        self.assertEqual(self.ap.flow(fid)['version']['trigger']['nextAction']['settings']['sourceCode']['code'], 'return 2')

    def test_legacy_metadata_is_rebaselined_not_reimported(self):
        apply(self.ap, self.repo)
        fid = flow_of(self.ap, 'a')['id']
        f = self.ap._flows[fid]
        # metadata as written by the previous ap-deploy: v1 hashes, no version bookkeeping
        f['metadata'] = {'deployKey': 'a', 'sourceHash': ap_deploy.definition_hash(make_def('a'), 1),
                         'deployHash': ap_deploy.target_hash(f, 1)}
        r = evaluate(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('in-sync', 'rebaseline'))
        apply(self.ap, self.repo)
        self.assertNotIn('IMPORT_FLOW', [c[0] for c in self.ap.calls[-3:]])
        meta = flow_of(self.ap, 'a')['metadata']
        self.assertEqual(meta['hashVersion'], ap_deploy.HASH_VERSION)
        self.assertEqual(evaluate(self.ap, self.repo)['a']['action'], 'none')


class InterruptedApplyTests(unittest.TestCase):
    def setUp(self):
        self.ap, self.repo = FakeAP(), Repo(self)
        self.repo.put('a', make_def('a'))
        self.repo.deploy({'a': {'enabled': True}})
        apply(self.ap, self.repo)
        self.fid = flow_of(self.ap, 'a')['id']
        self.repo.put('a', make_def('a', code='return 2'))
        real = self.ap.operate

        def publish_fails_once(flow_id, op_type, request):
            if op_type == 'LOCK_AND_PUBLISH' and not getattr(self, 'failed', False):
                self.failed = True
                raise ap_deploy.ApiError('POST /v1/flows -> 500: publish rejected')
            return real(flow_id, op_type, request)
        self.ap.operate = publish_fails_once

    def test_failed_publish_is_retried_not_drift(self):
        r = apply(self.ap, self.repo)['a']
        self.assertIn('publish rejected', r['error'])
        r = evaluate(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('changed', 'update'))
        self.assertTrue(apply(self.ap, self.repo)['a'].get('applied'))
        meta = flow_of(self.ap, 'a')['metadata']
        self.assertNotIn('applyingSourceHash', meta)
        self.assertNotIn('applyingHash', meta)
        self.assertEqual(evaluate(self.ap, self.repo)['a']['state'], 'in-sync')

    def test_staff_edit_after_failed_publish_is_drift(self):
        apply(self.ap, self.repo)
        self.ap.staff_edit(self.fid, 'return 99')
        self.assertEqual(evaluate(self.ap, self.repo)['a']['state'], 'drifted')

    def test_http_error_on_import_clears_pending_so_staff_edit_is_drift(self):
        self.failed = True  # this test is about IMPORT_FLOW failing, not publish
        real = self.ap.operate

        def import_rejected(flow_id, op_type, request):
            if op_type == 'IMPORT_FLOW':
                raise ap_deploy.ApiError('POST /v1/flows -> 500: import rejected', status=500)
            return real(flow_id, op_type, request)
        self.ap.operate = import_rejected
        r = apply(self.ap, self.repo)['a']
        self.assertIn('import rejected', r['error'])
        self.assertNotIn('applyingSourceHash', self.ap.flow(self.fid)['metadata'])
        self.ap.operate = real
        self.ap.staff_edit(self.fid, 'return 2')  # same content as the git version
        self.assertEqual(evaluate(self.ap, self.repo)['a']['state'], 'drifted')

    def test_timeout_on_import_keeps_pending_and_finishes_next_pass(self):
        self.failed = True  # this test is about IMPORT_FLOW failing, not publish
        real = self.ap.operate

        def import_then_timeout(flow_id, op_type, request):
            result = real(flow_id, op_type, request)
            if op_type == 'IMPORT_FLOW':
                raise ap_deploy.ApiError('POST http://fake: timed out')  # server imported, answer lost
            return result
        self.ap.operate = import_then_timeout
        r = apply(self.ap, self.repo)['a']
        self.assertIn('timed out', r['error'])
        self.assertIn('applyingSourceHash', self.ap.flow(self.fid)['metadata'])
        self.ap.operate = real
        r = evaluate(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('changed', 'update'))
        self.assertTrue(apply(self.ap, self.repo)['a'].get('applied'))
        self.assertEqual(evaluate(self.ap, self.repo)['a']['state'], 'in-sync')

    def test_died_between_import_and_recording_hash(self):
        apply(self.ap, self.repo)
        meta = self.ap._flows[self.fid]['metadata']
        meta['applyingHash'] = None  # run killed right after IMPORT_FLOW
        self.assertEqual(evaluate(self.ap, self.repo)['a']['state'], 'changed')


class OverwriteTests(unittest.TestCase):
    def setUp(self):
        self.ap, self.repo = FakeAP(), Repo(self)
        self.repo.put('a', make_def('a'))
        self.repo.deploy({'a': {'enabled': True}})
        apply(self.ap, self.repo)
        self.fid = flow_of(self.ap, 'a')['id']
        self.ap.staff_edit(self.fid, 'return 99')

    def code(self):
        return self.ap.flow(self.fid)['version']['trigger']['nextAction']['settings']['sourceCode']['code']

    def test_overwrite_token_lets_git_win_once(self):
        self.assertEqual(evaluate(self.ap, self.repo)['a']['state'], 'drifted')
        self.repo.deploy({'a': {'enabled': True, 'overwrite': '2026-11-02'}})
        self.assertTrue(apply(self.ap, self.repo)['a'].get('applied'))
        self.assertEqual(self.code(), 'return 1')
        self.assertEqual(self.ap.flow(self.fid)['metadata']['overwriteApplied'], '2026-11-02')
        self.ap.staff_edit(self.fid, 'return 100')  # same token still in deploy.json
        r = apply(self.ap, self.repo)['a']
        self.assertEqual(r['state'], 'drifted')
        self.assertEqual(self.code(), 'return 100')

    def test_overwrite_reenables_flow_stopped_in_ui(self):
        self.ap.operate(self.fid, 'CHANGE_STATUS', {'status': 'DISABLED'})
        self.repo.deploy({'a': {'enabled': True, 'overwrite': 'x1'}})
        apply(self.ap, self.repo)
        self.assertEqual(self.ap.flow(self.fid)['status'], 'ENABLED')
        self.assertEqual(evaluate(self.ap, self.repo)['a']['state'], 'in-sync')


class KillSwitchTests(unittest.TestCase):
    def setUp(self):
        self.ap, self.repo = FakeAP(), Repo(self)
        self.repo.put('a', make_def('a'))
        self.repo.deploy({'a': {'enabled': True}})
        apply(self.ap, self.repo)
        self.fid = flow_of(self.ap, 'a')['id']

    def test_disabled_honoured_when_drifted(self):
        self.ap.staff_edit(self.fid, 'return 2')
        self.repo.deploy({'a': {'enabled': False}})
        r = apply(self.ap, self.repo)['a']
        self.assertEqual(r['state'], 'drifted')
        self.assertEqual(r['action'], 'disable')
        self.assertEqual(self.ap.flow(self.fid)['status'], 'DISABLED')
        self.assertEqual(self.ap.flow(self.fid)['metadata']['deployedStatus'], 'DISABLED')

    def test_disabled_honoured_when_missing_deps(self):
        self.ap.has_piece = lambda name, version: False
        self.repo.deploy({'a': {'enabled': False}})
        r = apply(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('missing-deps', 'disable'))
        self.assertEqual(self.ap.flow(self.fid)['status'], 'DISABLED')

    def test_disabled_honoured_when_flow_file_broken(self):
        self.repo.put_raw('a', '{not json')
        self.repo.deploy({'a': {'enabled': False}})
        r = apply(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('error', 'disable'))
        self.assertEqual(self.ap.flow(self.fid)['status'], 'DISABLED')

    def test_emergency_off_in_ui_is_not_reenabled(self):
        self.ap.operate(self.fid, 'CHANGE_STATUS', {'status': 'DISABLED'})  # staff, in the UI
        r = apply(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('drifted', 'none'))
        self.assertIn('turned off on this server', r['reason'])
        self.assertEqual(self.ap.flow(self.fid)['status'], 'DISABLED')
        # a new git version must not switch it back on either
        self.repo.put('a', make_def('a', code='return 9'))
        self.assertEqual(apply(self.ap, self.repo)['a']['state'], 'drifted')
        self.assertEqual(self.ap.flow(self.fid)['status'], 'DISABLED')

    def test_emergency_off_accepted_by_git_then_reenabled(self):
        self.ap.operate(self.fid, 'CHANGE_STATUS', {'status': 'DISABLED'})
        self.repo.deploy({'a': {'enabled': False}})
        r = apply(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('in-sync', 'rebaseline'))
        self.assertEqual(self.ap.flow(self.fid)['metadata']['deployedStatus'], 'DISABLED')
        self.repo.deploy({'a': {'enabled': True}})
        r = apply(self.ap, self.repo)['a']
        self.assertEqual((r['state'], r['action']), ('in-sync', 'status'))
        self.assertEqual(self.ap.flow(self.fid)['status'], 'ENABLED')

    def test_staff_turning_on_a_disabled_flow_is_reverted(self):
        self.repo.deploy({'a': {'enabled': False}})
        apply(self.ap, self.repo)
        self.ap.operate(self.fid, 'CHANGE_STATUS', {'status': 'ENABLED'})
        r = apply(self.ap, self.repo)['a']
        self.assertEqual(r['action'], 'status')
        self.assertEqual(self.ap.flow(self.fid)['status'], 'DISABLED')


class IsolationTests(unittest.TestCase):
    def setUp(self):
        self.ap, self.repo = FakeAP(), Repo(self)
        self.repo.put('good', make_def('good'))

    def test_bad_flow_file_only_marks_its_key(self):
        self.repo.put_raw('bad', '<html>oops</html>')
        self.repo.put('notaflow', {'hello': 'world'})
        self.repo.deploy({'good': {'enabled': True}, 'bad': {'enabled': True}, 'notaflow': {'enabled': True}})
        recs = apply(self.ap, self.repo)
        self.assertEqual(recs['good']['state'], 'new')
        self.assertTrue(recs['good'].get('applied'))
        self.assertEqual(recs['bad']['state'], 'error')
        self.assertEqual(recs['notaflow']['state'], 'error')

    def test_bad_deploy_entry_only_marks_its_key(self):
        self.repo.deploy({'good': {'enabled': True}, 'weird': 'yes', 'num': {'enabled': 'true'}})
        recs = apply(self.ap, self.repo)
        self.assertTrue(recs['good'].get('applied'))
        self.assertEqual(recs['weird']['state'], 'error')
        self.assertEqual(recs['num']['state'], 'error')

    def test_path_traversal_key_rejected(self):
        self.repo.deploy({'good': {'enabled': True}, '../../etc/passwd': {'enabled': True}})
        recs = apply(self.ap, self.repo)
        self.assertEqual(recs['../../etc/passwd']['state'], 'error')
        self.assertIn('invalid deploy key', recs['../../etc/passwd']['reason'])

    def test_invalid_deploy_json_is_api_error(self):
        with open(os.path.join(self.repo.path, ap_deploy.DEPLOY_FILE), 'w') as f:
            f.write('{"warehouse": ')
        with self.assertRaises(ap_deploy.ApiError):
            ap_deploy.evaluate(self.ap, self.repo.path, 'warehouse')

    def test_one_failing_apply_does_not_stop_others(self):
        self.repo.put('other', make_def('other'))
        self.repo.deploy({'good': {'enabled': True}, 'other': {'enabled': True}})
        real = self.ap.operate

        def flaky(flow_id, op_type, request):
            if op_type == 'IMPORT_FLOW' and request['displayName'] == 'Good':
                raise KeyError('boom')
            return real(flow_id, op_type, request)
        self.ap.operate = flaky
        recs = apply(self.ap, self.repo)
        self.assertIn('boom', recs['good']['error'])
        self.assertTrue(recs['other'].get('applied'))


if __name__ == '__main__':
    unittest.main()
