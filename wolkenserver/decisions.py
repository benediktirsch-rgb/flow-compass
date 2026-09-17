"""Receive reviewed task decisions on stdin; persist privately and sync reception.

Run as the Compass user with its existing EnvironmentFile. This does not discover
desktop tasks and never executes the actions described in a decision.
"""
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path('/var/lib/compass-server/daten/vertretung')


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def validate(row):
    for key, limit in [('thread', 36), ('title', 110), ('scope', 500),
                       ('blocker', 600), ('key', 80), ('evidence', 300)]:
        if not isinstance(row.get(key), str) or not 0 < len(row[key]) <= limit:
            raise ValueError('INVALID_' + key)
    if not re.fullmatch(r'[a-f0-9-]{36}', row['thread']):
        raise ValueError('INVALID_THREAD')
    if row.get('decision') not in ('offen', 'erteilt', 'abgelehnt'):
        raise ValueError('INVALID_DECISION')
    if row.get('execution') not in ('wartet', 'in_bearbeitung', 'abgeschlossen', 'blockiert'):
        raise ValueError('INVALID_EXECUTION')
    if row['decision'] != 'offen' and not row.get('answer'):
        raise ValueError('ANSWER_REQUIRED')
    if len(row.get('answer', '')) > 200:
        raise ValueError('ANSWER_TOO_LONG')
    stamp = dt.datetime.fromisoformat(row['observedAt'])
    if stamp.tzinfo is None:
        raise ValueError('TIMEZONE_REQUIRED')
    identity = row['thread'] + ':' + row['key']
    return 'codex-' + hashlib.sha256(identity.encode()).hexdigest()[:32]


def hub(action, body=None):
    token = next((os.environ[k] for k in ('JOHN_HUB_TOKEN_MADELENE_GERAET',
                 'JOHN_HUB_TOKEN_VISHNU_MASTER', 'JOHN_HUB_TOKEN') if os.environ.get(k)), None)
    if not token:
        raise ValueError('NO_HUB_TOKEN')
    base = os.environ.get('JOHN_HUB_URL', 'https://hotel-vaikuntha.de/john').rstrip('/')
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
    req = urllib.request.Request(base + '/api.php?w=' + action, data=data,
        headers={'X-John-Token': token, 'Content-Type': 'application/json; charset=utf-8'})
    with urllib.request.urlopen(req, timeout=15) as response:
        result = json.load(response)
    if result.get('ok') is not True:
        raise ValueError('HUB_REJECTED')
    return result


def sync(row, ledger, request=hub):
    ident = validate(row)
    old = ledger.get(ident)
    if old:
        if old['scope'] != row['scope']:
            raise ValueError('SCOPE_CHANGED_USE_NEW_KEY')
        if dt.datetime.fromisoformat(row['observedAt']) < dt.datetime.fromisoformat(old['observedAt']):
            raise ValueError('STALE_UPDATE')
        if old['decision'] != 'offen' and row['decision'] == 'offen':
            row = dict(row, decision=old['decision'], answer=old.get('answer', ''))
    questions = request('rueckfragen&status=alle&von=codex')['rueckfragen']
    current = next((q for q in questions if q['id'] == ident), None)
    # Hub retention is bounded. A locally terminal record must never be recreated.
    terminal = old and old.get('receptionStatus') in ('beantwortet', 'zurueckgezogen')
    if not current and terminal:
        return ident, dict(row, receptionStatus=old['receptionStatus'], syncedAt=now(),
                           receptionAnswer=old.get('receptionAnswer'), retainedOnly=True)
    if current and current['status'] in ('beantwortet', 'zurueckgezogen'):
        return ident, dict(row, receptionStatus=current['status'], syncedAt=now(),
                           receptionAnswer=current.get('antwort'))
    payload = {'id': ident, 'von': 'codex', 'projekt': row['title'],
        'frage': row['scope'], 'warum': 'Quelle: Codex-Aufgabe ' + row['thread'] +
        '\nBlocker: ' + row['blocker'] + '\nNachweis: ' + row['evidence'] +
        '\nEntscheidung: ' + row['decision'] + '; Ausführung: ' + row['execution'],
        'optionen': row.get('options', []), 'link': row.get('link', ''), 'dringend': False}
    request('rueckfrage', payload)
    if row['decision'] != 'offen':
        # Recheck immediately before answering. Existing human answers always win.
        latest = request('rueckfragen&status=alle&von=codex')['rueckfragen']
        question = next(q for q in latest if q['id'] == ident)
        if question['status'] == 'offen':
            request('rueckfrage-antwort', {'id': ident, 'a': row['answer'],
                'ts': row['observedAt'][:10], 'wer': 'geraet'})
    verified = request('rueckfragen&status=alle&von=codex')['rueckfragen']
    question = next((q for q in verified if q['id'] == ident), None)
    if question is None:
        raise ValueError('READBACK_MISSING')
    return ident, dict(row, receptionStatus=question['status'],
                       receptionAnswer=question.get('antwort'), syncedAt=now())


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / 'decisions.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = ROOT / 'codex-decisions.json'
        ledger = json.loads(path.read_text()) if path.exists() else {}
        if '--list' in sys.argv:
            print(json.dumps({'ok': True, 'records': ledger,
                'questions': hub('rueckfragen&status=alle')['rueckfragen']}, ensure_ascii=False))
            return
        row = json.load(sys.stdin)
        ident, result = sync(row, ledger)
        ledger[ident] = result
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding='utf-8')
        os.chmod(temp, 0o600)
        os.replace(temp, path)
        print(json.dumps({'ok': True, 'id': ident, 'receptionStatus': result['receptionStatus'],
                          'execution': result['execution'], 'syncedAt': result['syncedAt']}))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Exception strings may contain credential-bearing URLs or private text.
        print(json.dumps({'ok': False, 'error': type(exc).__name__}), file=sys.stderr)
        sys.exit(1)
