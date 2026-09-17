import copy
import importlib.util
import sys
import unittest

spec = importlib.util.spec_from_file_location('decisions', sys.argv.pop(1))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.rows = {}
        self.writes = 0
        self.row = dict(thread='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title='Example task',
            scope='Publish reviewed example?', blocker='Permission needed', key='publish-v1',
            evidence='Explicit request in source task', decision='offen', execution='wartet',
            observedAt='2026-09-17T17:00:00+00:00')

    def hub(self, action, body=None):
        if action.startswith('rueckfragen&'):
            return {'rueckfragen': list(self.rows.values())}
        self.writes += 1
        if action == 'rueckfrage':
            self.rows[body['id']] = dict(body, status='offen', antwort=None)
        else:
            self.rows[body['id']].update(status='beantwortet', antwort={'a': body['a']})
        return {'ok': True}

    def test_open_readback_and_stable_id(self):
        ident, saved = m.sync(self.row, {}, self.hub)
        other, _ = m.sync(dict(self.row, title='Renamed'), {ident: saved}, self.hub)
        self.assertEqual(ident, other)
        self.assertEqual(len(self.rows), 1)

    def test_human_answer_preserved(self):
        ident, saved = m.sync(self.row, {}, self.hub)
        self.rows[ident].update(status='beantwortet', antwort={'a': 'No'})
        _, final = m.sync(dict(self.row, decision='erteilt', answer='Yes'), {ident: saved}, self.hub)
        self.assertEqual(final['receptionAnswer']['a'], 'No')
        self.assertEqual(self.writes, 1)

    def test_granted_never_reopens_after_retention(self):
        ident, saved = m.sync(dict(self.row, decision='erteilt', answer='Yes'), {}, self.hub)
        self.rows.clear()
        _, result = m.sync(self.row, {ident: saved}, self.hub)
        self.assertEqual(result['decision'], 'erteilt')
        self.assertEqual(self.rows, {})

    def test_stale_rejected(self):
        ident, saved = m.sync(self.row, {}, self.hub)
        with self.assertRaisesRegex(ValueError, 'STALE'):
            m.sync(dict(self.row, observedAt='2026-09-16T17:00:00+00:00'), {ident: saved}, self.hub)

    def test_scope_change_requires_new_key(self):
        ident, saved = m.sync(self.row, {}, self.hub)
        with self.assertRaisesRegex(ValueError, 'SCOPE_CHANGED'):
            m.sync(dict(self.row, scope='Different action?'), {ident: saved}, self.hub)

    def test_failed_readback_not_acknowledged(self):
        def missing(action, body=None):
            return {'rueckfragen': []} if body is None else {'ok': True}
        with self.assertRaisesRegex(ValueError, 'READBACK_MISSING'):
            m.sync(self.row, {}, missing)


unittest.main()
