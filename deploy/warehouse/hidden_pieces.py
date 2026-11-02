#!/usr/bin/env python3
"""Build the platform update that hides pieces (EE only), never hiding a piece a flow uses.

    hidden_pieces.py <hidden-pieces.txt> <used-pieces.txt>

hidden-pieces.txt: one package name per line; blank lines and '#' comments are ignored.
used-pieces.txt: one package name per line, every piece referenced by any flow version on the
server. Prints the JSON body for POST /v1/platforms/<id> on stdout and one line per skipped
piece on stderr. Python 3 stdlib only (runs inside the installer image).
"""
import json
import sys


def parse_names(text):
    names, seen = [], set()
    for line in text.splitlines():
        name = line.split('#', 1)[0].strip()
        if name and name not in seen:
            seen.add(name)
            names.append(name)
    return names


def plan(hidden, used):
    used = set(used)
    return (sorted(n for n in hidden if n not in used),
            sorted(n for n in hidden if n in used))


def request_body(names):
    return {'filteredPieceNames': names, 'filteredPieceBehavior': 'BLOCKED'}


def main(argv):
    if len(argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    with open(argv[1], encoding='utf-8') as f:
        hidden = parse_names(f.read())
    with open(argv[2], encoding='utf-8') as f:
        used = parse_names(f.read())
    to_hide, skipped = plan(hidden, used)
    for name in skipped:
        print(f'  keep visible (used by a flow): {name}', file=sys.stderr)
    print(json.dumps(request_body(to_hide)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
