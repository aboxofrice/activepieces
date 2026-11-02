"""hidden_pieces: list parsing and the never-hide-a-used-piece rule."""
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import hidden_pieces  # noqa: E402


class ParseTests(unittest.TestCase):
    def test_comments_blanks_and_duplicates_are_dropped(self):
        text = '# header\n\n@a/piece-x\n  @a/piece-y  # inline note\n@a/piece-x\n   \n#@a/piece-z\n'
        self.assertEqual(hidden_pieces.parse_names(text), ['@a/piece-x', '@a/piece-y'])

    def test_shipped_list_parses(self):
        with open(os.path.join(HERE, '..', 'hidden-pieces.txt'), encoding='utf-8') as f:
            names = hidden_pieces.parse_names(f.read())
        self.assertGreater(len(names), 0)
        self.assertTrue(all(n.startswith('@') and ' ' not in n for n in names))


class PlanTests(unittest.TestCase):
    def test_used_pieces_are_never_hidden(self):
        to_hide, skipped = hidden_pieces.plan(['@a/c', '@a/b', '@a/used'], ['@a/used', '@a/other'])
        self.assertEqual(to_hide, ['@a/b', '@a/c'])
        self.assertEqual(skipped, ['@a/used'])

    def test_body_blocks_the_list(self):
        self.assertEqual(hidden_pieces.request_body(['@a/b']),
                         {'filteredPieceNames': ['@a/b'], 'filteredPieceBehavior': 'BLOCKED'})


class MainTests(unittest.TestCase):
    def test_cli_prints_body_and_logs_skipped(self):
        with tempfile.TemporaryDirectory() as d:
            hidden, used = os.path.join(d, 'hidden'), os.path.join(d, 'used')
            with open(hidden, 'w') as f:
                f.write('# c\n@a/one\n@a/two\n')
            with open(used, 'w') as f:
                f.write('@a/two\n')
            out, err = io.StringIO(), io.StringIO()
            with mock.patch.object(sys, 'stdout', out), mock.patch.object(sys, 'stderr', err):
                self.assertEqual(hidden_pieces.main(['x', hidden, used]), 0)
        self.assertEqual(json.loads(out.getvalue())['filteredPieceNames'], ['@a/one'])
        self.assertIn('@a/two', err.getvalue())

    def test_empty_used_list_hides_everything(self):
        with tempfile.TemporaryDirectory() as d:
            hidden, used = os.path.join(d, 'hidden'), os.path.join(d, 'used')
            with open(hidden, 'w') as f:
                f.write('@a/one\n')
            open(used, 'w').close()
            out = io.StringIO()
            with mock.patch.object(sys, 'stdout', out):
                hidden_pieces.main(['x', hidden, used])
        self.assertEqual(json.loads(out.getvalue())['filteredPieceNames'], ['@a/one'])


if __name__ == '__main__':
    unittest.main()
