"""Cloud-owned health and reception reconciliation; no desktop dependency.

Records answers durably for the responsible executor. Does not treat acceptance
as permission to execute arbitrary business actions or as completed execution.
"""
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import sys

from decisions import hub

ROOT = Path('/var/lib/compass-server/daten/vertretung')


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def read(path, default):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default


def save(path, data):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    os.chmod(temp, 0o600)
    os.replace(temp, path)


def age(stamp, current):
    if not stamp:
        return float('inf')
    return (current - dt.datetime.fromisoformat(stamp)).total_seconds() / 60


def health(state, current):
    problems = []
    for key, entry in state.get('quellen', {}).items():
        if entry.get('status') != 'aktuell' or age(entry.get('letzterErfolg'), current) > 45:
            problems.append('quelle:' + key)
        if key in ('postfach', 'slack') and age(entry.get('quellstand'), current) > 120:
            problems.append('quellstand:' + key)
    if not state.get('quellen'):
        problems.append('keine_quellen')
    red = state.get('redaktion', {})
    if red.get('status') == 'fehlgeschlagen' or age(red.get('letzterErfolg'), current) > 90:
        problems.append('veroeffentlichung')
    return problems


def reconcile(records, questions, events):
    changed = 0
    for question in questions:
        ident = question.get('id')
        if ident not in records:
            continue
        record = records[ident]
        status = question.get('status')
        if status not in ('beantwortet', 'zurueckgezogen'):
            continue
        answer = question.get('antwort')
        event_id = hashlib.sha256(json.dumps([ident, status, answer],
            ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        if record.get('receptionStatus') != status or record.get('receptionAnswer') != answer:
            # Events are committed before the ledger; replay after a crash is safe.
            if event_id not in events:
                events[event_id] = {'id': event_id, 'questionId': ident,
                    'thread': record['thread'], 'title': record['title'],
                    'scope': record['scope'], 'answer': answer, 'receptionStatus': status,
                    'receivedAt': now(), 'status': 'eingegangen',
                    'execution': 'nicht_ausgefuehrt',
                    'hint': 'Antwort auf wolke gesichert. Ausfuehrung durch zustaendige Aufgabe erforderlich.'}
            record['receptionStatus'] = status
            record['receptionAnswer'] = answer
            record['syncedAt'] = now()
            changed += 1
    return changed


def run():
    ROOT.mkdir(parents=True, exist_ok=True)
    monitor_file = ROOT / 'cloud-monitor.json'
    previous = read(monitor_file, {})
    report = {'betrieb': 'wolke', 'desktopErforderlich': False, 'letzterVersuch': now(),
              'letzterErfolg': previous.get('letzterErfolg'), 'fehler': [],
              'aufgabenErfassung': 'Cloud-Register und importierter Aufgabenstand; lokale Chats werden nicht live auf wolke gespiegelt.'}
    state = read(ROOT / 'status.json', {})
    report['fehler'] = health(state, dt.datetime.now(dt.timezone.utc))
    report['letzteVeroeffentlichung'] = state.get('redaktion', {}).get('letzterErfolg')
    report['quellen'] = {key: {field: entry.get(field) for field in
        ('letzterErfolg', 'quellstand', 'status')} for key, entry in state.get('quellen', {}).items()}
    try:
        questions = hub('rueckfragen&status=alle')['rueckfragen']
        with (ROOT / 'decisions.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            records = read(ROOT / 'codex-decisions.json', {})
            events = read(ROOT / 'decision-events.json', {})
            report['neueAntworten'] = reconcile(records, questions, events)
            save(ROOT / 'decision-events.json', events)
            save(ROOT / 'codex-decisions.json', records)
            report['vorgaenge'] = len(records)
            report['offeneFragen'] = sum(q.get('status') == 'offen' for q in questions)
            report['antwortenZurBearbeitung'] = sum(e.get('status') == 'eingegangen' for e in events.values())
        report['rezeptionErfolg'] = now()
    except Exception as exc:
        report['fehler'].append('rezeption:' + type(exc).__name__)
        report['rezeptionErfolg'] = previous.get('rezeptionErfolg')
    imported = read(ROOT / 'desktop-task-import.json', {})
    report['aufgabenImportStand'] = imported.get('checkedAt')
    report['importierteAufgaben'] = len(imported.get('tasks', []))
    report['leseluecken'] = imported.get('gaps', {})
    report['status'] = 'bereit' if not report['fehler'] else 'eingeschraenkt'
    if not report['fehler']:
        report['letzterErfolg'] = now()
    save(monitor_file, report)
    print(json.dumps({'status': report['status'], 'fehler': report['fehler'],
                      'rezeptionErfolg': report['rezeptionErfolg'],
                      'neueAntworten': report.get('neueAntworten', 0)}))
    return 0 if report['status'] == 'bereit' else 1


if __name__ == '__main__':
    os.umask(0o077)
    try:
        with (ROOT / 'cloud-monitor.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            sys.exit(run())
    except Exception as exc:
        print(json.dumps({'status': 'fehlgeschlagen', 'error': type(exc).__name__}))
        sys.exit(1)
