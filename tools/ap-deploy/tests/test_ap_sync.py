"""ap_sync helpers: loop resilience, backup status file, credential scoping."""
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import ap_sync  # noqa: E402


class LoopTests(unittest.TestCase):
    def test_unexpected_exception_does_not_crash(self):
        with mock.patch.object(ap_sync, 'tick', side_effect=KeyError('trigger')), \
                mock.patch.object(sys, 'argv', ['ap_sync.py', '--once']), \
                mock.patch.object(ap_sync, 'log') as log:
            self.assertEqual(ap_sync.main(), 1)
        self.assertTrue(any('KeyError' in str(c) for c in log.call_args_list))


class HealthPingTests(unittest.TestCase):
    def run_once(self, side_effect):
        with mock.patch.object(ap_sync, 'tick', side_effect=side_effect), \
                mock.patch.object(sys, 'argv', ['ap_sync.py', '--once']), \
                mock.patch.object(ap_sync, 'SYNC_HEALTHCHECK_URL', 'http://hc.example/abc'), \
                mock.patch.object(ap_sync, 'log'), \
                mock.patch('urllib.request.urlopen') as urlopen:
            ap_sync.main()
        return [c.args[0] for c in urlopen.call_args_list]

    def test_good_pass_pings(self):
        self.assertEqual(self.run_once(None), ['http://hc.example/abc'])

    def test_failed_pass_pings_fail(self):
        self.assertEqual(self.run_once(RuntimeError('git fetch failed')), ['http://hc.example/abc/fail'])


class EnvNumberTests(unittest.TestCase):
    def test_bad_values_fall_back(self):
        with mock.patch.dict(os.environ, {'X_NUM': 'five'}), mock.patch('builtins.print'):
            self.assertEqual(ap_sync._env_number('X_NUM', 5.0, float, 0.1, 1440), 5.0)
        with mock.patch.dict(os.environ, {'X_NUM': '25'}), mock.patch('builtins.print'):
            self.assertEqual(ap_sync._env_number('X_NUM', 2, int, 0, 23), 2)
        with mock.patch.dict(os.environ, {'X_NUM': '3'}):
            self.assertEqual(ap_sync._env_number('X_NUM', 2, int, 0, 23), 3)


class StatusFileTests(unittest.TestCase):
    def test_backup_status_written_to_repo(self):
        with tempfile.TemporaryDirectory() as d:
            status = os.path.join(d, 'status')
            with open(status, 'w') as f:
                f.write('last_run=2026-11-01T08:30:00Z\nlast_result=failure\nlast_success=2026-10-31T08:30:00Z\n'
                        'last_success_file=nightly/x.dump\nlast_failure=2026-11-01T08:30:00Z\nlast_failure_reason=upload failed\n')
            repo = os.path.join(d, 'flows')
            with mock.patch.object(ap_sync, 'BACKUP_STATUS_FILE', status), mock.patch.object(ap_sync, 'FLOWS_DIR', repo), \
                    mock.patch.dict(ap_sync._last_states, {'a': {'state': 'drifted', 'reason': 'edited'}}, clear=True):
                ap_sync.write_status_file()
            data = json.load(open(os.path.join(repo, 'status', f'{ap_sync.TARGET}.json')))
            self.assertEqual(data['backup']['last_result'], 'failure')
            self.assertEqual(data['backup']['last_failure_reason'], 'upload failed')
            self.assertEqual(data['managed'], {'a': {'state': 'drifted', 'reason': 'edited'}})

    def test_missing_backup_status_is_null(self):
        with tempfile.TemporaryDirectory() as d:
            with mock.patch.object(ap_sync, 'BACKUP_STATUS_FILE', os.path.join(d, 'nope')), \
                    mock.patch.object(ap_sync, 'FLOWS_DIR', d):
                ap_sync.write_status_file()
            self.assertIsNone(json.load(open(os.path.join(d, 'status', f'{ap_sync.TARGET}.json')))['backup'])


class CredentialScopeTests(unittest.TestCase):
    def test_scope_is_repo_host(self):
        with mock.patch.object(ap_sync, 'REPO_URL', 'https://github.com/aboxofrice/activepieces-flows.git'):
            self.assertEqual(ap_sync._repo_host_url(), 'https://github.com')
        with mock.patch.object(ap_sync, 'REPO_URL', 'git://localhost:9418/flows.git'):
            self.assertIsNone(ap_sync._repo_host_url())


if __name__ == '__main__':
    unittest.main()
