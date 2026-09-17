import importlib.util
import tempfile
from pathlib import Path
import unittest
import sys

spec = importlib.util.spec_from_file_location('collector', sys.argv.pop(1))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class Tests(unittest.TestCase):
    def test_answered_and_withdrawn_questions_not_restored(self):
        fresh = {'rueckfragen': {'antworten': {'a': {'a': 'yes'}}, 'erledigteFragen': ['b']}}
        self.assertTrue(c.question_closed('frage:a', fresh))
        self.assertTrue(c.question_closed('frage:b', fresh))
        self.assertFalse(c.question_closed('frage:c', fresh))
        self.assertFalse(c.question_closed('jira:a', fresh))
        self.assertFalse(c.question_closed('frage:a', {}))

    def test_stable_ids_and_completed(self):
        out = c.candidates({'jira': {'issues': [{'key':'VA-1','titel':'open'}, {'key':'VA-2','kategorie':'done'}]},
                            'trello-arbeit': {'lists':[{'name':'Doing','cards':[{'id':'a','name':'A'}, {'id':'b','dueComplete':True}]}]}})
        self.assertEqual([x['key'] for x in out], ['jira:VA-1','trello:a'])

    def test_failure_preserves_last_success_and_no_publish(self):
        with tempfile.TemporaryDirectory() as directory:
            c.ROOT = Path(directory)
            old = '2026-09-16T10:00:00+00:00'
            c.save(c.ROOT/'status.json', {'quellen':{'jira':{'letzterErfolg':old}},'redaktion':{}})
            calls=[]
            def fail(path, body=None, timeout=45):
                calls.append((path,body)); raise TimeoutError()
            c.request=fail
            c.run()
            state=c.read(c.ROOT/'status.json',{})
            self.assertEqual(state['quellen']['jira']['letzterErfolg'],old)
            self.assertEqual(state['quellen']['jira']['status'],'abruf_fehlgeschlagen')
            self.assertTrue(all(body is None for _,body in calls))

    def test_corrupt_status_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            c.ROOT=Path(directory); target=c.ROOT/'status.json'; target.write_text('broken')
            with self.assertRaises(ValueError): c.run()
            self.assertEqual(target.read_text(),'broken')

    def test_valid_run_publishes_via_existing_api(self):
        with tempfile.TemporaryDirectory() as directory:
            c.ROOT=Path(directory); calls=[]
            def success(path,body=None,timeout=45):
                calls.append((path,body))
                if body is not None: return {'ok':True,'stand_um':c.now(),'punkte':[{'key':'jira:VA-1'}],'model':'test'}
                if path.startswith('/api/jira/'): return {'ok':True,'issues':[{'key':'VA-1','titel':'Open'}]}
                return {'ok':True}
            c.request=success; c.run()
            state=c.read(c.ROOT/'status.json',{})
            self.assertEqual(state['redaktion']['status'],'veroeffentlicht')
            self.assertFalse(state['datenVollstaendig'])
            self.assertEqual([p for p,b in calls if b is not None], ['/api/john/stapel'])
            calls.clear(); c.run()
            self.assertTrue(all(b is None for _,b in calls))

unittest.main()
