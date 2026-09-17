"""Refresh existing Compass sources; publish only through its serial HTTP API.

No model/API credentials, direct state-file edits, messages, or business actions.
Model refresh is hourly; source checks every 15 minutes. Failed sources retain
their last successful timestamps and snapshots, never presented as current.
"""
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import argparse

BASE = 'http://localhost:8787'
ROOT = Path('/var/lib/compass-server/daten/vertretung')
SOURCES = {
    'jira': '/api/jira/meine?fresh=1',
    'trello-arbeit': '/api/trello?board=arbeit&fresh=1',
    'trello-privat': '/api/trello?board=privat&fresh=1',
    'antworten': '/api/antworten',
    'checkins': '/api/checkin?limit=10&voll=1',
    'pool': '/api/pool?fresh=1',
    'tower': '/api/tower?fresh=1',
    'ausgabe': '/api/ausgabe?fresh=1',
    'kalender': '/api/kalender?fresh=1',
    'rueckfragen': '/api/rueckfragen',
    'postfach': '/api/postfach',
    'slack': '/api/slack',
}
MISSING = ()

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def read(path, default):
    if not path.exists():
        return default
    # Corruption must stop the run, not erase last-success metadata.
    return json.loads(path.read_text(encoding='utf-8'))

def save(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)

def request(path, body=None, timeout=45):
    data = None if body is None else json.dumps(body).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=data,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        value = json.load(response)
    if not isinstance(value, dict) or value.get('ok') is False or value.get('error') or value.get('vollstaendig') is False:
        raise ValueError('SOURCE_REJECTED')
    return value

def failure(exc):
    # Do not expose URL contents, response bodies, credentials or source text.
    if isinstance(exc, urllib.error.HTTPError):
        return 'HTTP_' + str(exc.code)
    return type(exc).__name__

def age_seconds(stamp):
    if not stamp:
        return float('inf')
    return (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(stamp)).total_seconds()


def question_closed(key, fresh):
    questions = fresh.get('rueckfragen', {})
    closed = set(questions.get('erledigteFragen', [])) | set(questions.get('antworten', {}))
    return key.startswith('frage:') and key[6:] in closed

def candidates(data):
    out = []
    for source in ('postfach', 'slack'):
        for row in data.get(source, {}).get('wartend', []):
            if row.get('id') and row.get('art') == 'antwort':
                out.append({'key': source + ':' + row['id'], 'titel': row.get('worum', ''),
                            'art': source, 'warum': row.get('worum', ''), 'quelle': source,
                            'url': row.get('url')})
    for question in data.get('rueckfragen', {}).get('rueckfragen', []):
        if question.get('id'):
            out.append({'key': 'frage:' + question['id'], 'titel': question.get('frage', ''),
                        'art': 'frage', 'warum': question.get('warum', ''),
                        'quelle': 'rueckfragen', 'url': question.get('link')})
    for issue in data.get('jira', {}).get('issues', []):
        if not issue.get('key') or issue.get('kategorie') == 'done':
            continue
        out.append({'key': 'jira:' + issue['key'], 'titel': issue.get('titel', issue['key']),
                    'art': 'jira', 'warum': 'Status: ' + str(issue.get('status', 'unbekannt')),
                    'faellig': issue.get('due'), 'url': issue.get('url'), 'quelle': 'jira'})
    for source in ('trello-arbeit', 'trello-privat'):
        for group in data.get(source, {}).get('lists', []):
            if group.get('name', '').strip().lower() in ('done', 'erledigt', 'fertig', 'archiv'):
                continue
            for card in group.get('cards', []):
                if not card.get('id') or card.get('dueComplete'):
                    continue
                out.append({'key': 'trello:' + card['id'], 'titel': card.get('name', ''),
                            'art': 'board', 'warum': 'Liste: ' + group.get('name', ''),
                            'faellig': card.get('due'), 'url': card.get('url'), 'quelle': source})
    # Prioritize due dates while preserving stable source identifiers.
    out.sort(key=lambda item: (not bool(item.get('faellig')), str(item.get('faellig') or '')))
    return out[:60]

def run(force=False):
    state = read(ROOT / 'status.json', {'quellen': {}, 'redaktion': {}})
    state.update({'letzterVersuch': now(), 'betrieb': 'wolke', 'intervallMinuten': 15})
    fresh = {}
    for name, path in SOURCES.items():
        entry = state['quellen'].setdefault(name, {})
        entry['letzterVersuch'] = now()
        try:
            value = request(path)
            save(ROOT / (name + '.json'), value)
            entry.update({'status': 'aktuell', 'letzterErfolg': now(), 'fehler': None})
            if name in ('postfach', 'slack'):
                entry['quellstand'] = value['stand']
            entry.pop('einschraenkung', None)
            if name == 'jira' and value.get('anzahl', 0) >= 100 and value.get('vollstaendig') is not True:
                entry['einschraenkung'] = 'Bestehende Jira-Schnittstelle liefert hoechstens 100 Vorgaenge'
            fresh[name] = value
        except Exception as exc:
            entry.update({'status': 'abruf_fehlgeschlagen', 'fehler': failure(exc)})
    for name in MISSING:
        state['quellen'][name] = {'status': 'nicht_angebunden', 'letzterErfolg': None,
                                  'fehler': 'Kein gepruefter Cloud-Zugang'}
    state['quellenAbrufeVollstaendig'] = all(x['status'] == 'aktuell' and not x.get('einschraenkung') for x in state['quellen'].values())
    state['datenVollstaendig'] = False
    state['abdeckung'] = 'Angeschlossene Quellen; lokale Profil-/Pipeline-Dateien und Rueckfragenimport sind keine kontinuierliche Synchronisierung.'
    save(ROOT / 'status.json', state)
    red = state['redaktion']
    # Back off after a failed model run as well; avoid burning both subscriptions.
    if not force and age_seconds(red.get('letzterVersuch')) < 3600:
        print('Quellen geprueft; naechste Redaktion nach Stundenfrist.')
        return
    red['letzterVersuch'] = now()
    save(ROOT / 'status.json', state)
    items = candidates(fresh)
    if not any(name in fresh for name in ('jira', 'trello-arbeit', 'trello-privat', 'rueckfragen', 'postfach', 'slack')):
        red.update({'status': 'keine_aktuellen_aufgabenquellen', 'fehler': 'Letzten Stapel bewahrt'})
        save(ROOT / 'status.json', state)
        return
    try:
        previous = request('/api/john/stapel')
        # Preserve pending existing questions/actions as candidates, without executing them.
        seen = {item['key'] for item in items}
        for point in (previous.get('letzte') or {}).get('punkte', []):
            if point.get('key') and point['key'] not in seen and not question_closed(point['key'], fresh):
                items.append({'key': point['key'], 'titel': point.get('titel', ''),
                              'art': 'bestand', 'warum': point.get('satz', ''),
                              'quelle': 'bestehender Stapel; Quellenstand nicht neu verifiziert'})
        missing = [key for key, val in state['quellen'].items() if val['status'] != 'aktuell']
        context = {'zeit': now(), 'quellenstatus': state['quellen'],
                   'antworten': fresh.get('antworten', {}), 'checkins': fresh.get('checkins', {}),
                   'pool': fresh.get('pool', {}), 'tower': fresh.get('tower', {}),
                   'kalender': fresh.get('kalender', {}),
                   'rueckfragen': fresh.get('rueckfragen', {}),
                   'regel': 'Nur vorbereiten. Keine Entscheidungen treffen, nichts senden. '
                            'Fehlende Quellen nicht als aktuell darstellen. Bestand nur mit belegtem Stand verwenden.'}
        if missing:
            items.append({'key': 'vertretung:quellen', 'titel': 'Datenluecken im Compass',
                          'art': 'board', 'warum': 'Nicht aktuell angebunden: ' + ', '.join(missing),
                          'quelle': 'technische Quellenpruefung'})
        result = request('/api/john/stapel', {'kandidaten': items, 'kontext': json.dumps(context, ensure_ascii=False),
                                            'fresh': True}, timeout=630)
        if not result.get('ok') or not result.get('stand_um'):
            raise ValueError('NO_PUBLICATION')
        red.update({'status': 'veroeffentlicht', 'letzterErfolg': now(), 'modell': result.get('model'),
                    'stand': result['stand_um'], 'punkte': len(result.get('punkte', [])), 'fehler': None})
    except Exception as exc:
        red.update({'status': 'fehlgeschlagen', 'fehler': failure(exc)})
    save(ROOT / 'status.json', state)
    print('Quellenlauf abgeschlossen; Redaktion: ' + red['status'])

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true', help='Einmal ausdruecklich frisch aufbereiten')
    options = parser.parse_args()
    ROOT.mkdir(parents=True, exist_ok=True)
    os.umask(0o077)
    with (ROOT / 'lauf.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Anderer Quellenlauf aktiv')
        run(options.publish)
