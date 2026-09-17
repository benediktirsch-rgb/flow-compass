import copy
import datetime as dt
import importlib.util
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(sys.argv[1]).parent))
spec = importlib.util.spec_from_file_location('monitor', sys.argv.pop(1))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Tests(unittest.TestCase):
    def setUp(self):
        self.records = {'q': {'thread': 't', 'title': 'Task', 'scope': 'Scope',
            'receptionStatus': 'offen', 'decision': 'offen', 'execution': 'wartet'}}
        self.question = {'id': 'q', 'status': 'beantwortet', 'antwort': {'a': 'Yes'}}

    def test_new_answer_durable_not_executed(self):
        events = {}
        self.assertEqual(m.reconcile(self.records, [self.question], events), 1)
        self.assertEqual(next(iter(events.values()))['execution'], 'nicht_ausgefuehrt')
        self.assertEqual(self.records['q']['execution'], 'wartet')
        self.assertEqual(self.records['q']['decision'], 'offen')

    def test_crash_replay_and_retry_no_duplicate(self):
        events = {}
        original = copy.deepcopy(self.records)
        m.reconcile(self.records, [self.question], events)
        m.reconcile(original, [self.question], events)
        m.reconcile(original, [self.question], events)
        self.assertEqual(len(events), 1)

    def test_changed_answer_new_event(self):
        events = {}
        m.reconcile(self.records, [self.question], events)
        self.question['antwort'] = {'a': 'No'}
        m.reconcile(self.records, [self.question], events)
        self.assertEqual(len(events), 2)
        self.assertEqual(self.records['q']['receptionAnswer']['a'], 'No')

    def test_unrelated_questions_not_claimed(self):
        self.assertEqual(m.reconcile({}, [self.question], {}), 0)

    def test_stale_actual_source_not_heartbeat(self):
        now = dt.datetime.now(dt.timezone.utc)
        fresh = now.isoformat()
        stale = (now-dt.timedelta(hours=3)).isoformat()
        state = {'quellen': {'postfach': {'status': 'aktuell', 'letzterErfolg': fresh,
            'quellstand': stale}}, 'redaktion': {'letzterErfolg': fresh}}
        self.assertEqual(m.health(state, now), ['quellstand:postfach'])

    def test_missing_or_failed_publication_not_healthy(self):
        self.assertIn('veroeffentlichung', m.health({}, dt.datetime.now(dt.timezone.utc)))


unittest.main()
