import importlib.util, sys, unittest
spec=importlib.util.spec_from_file_location('connectors',sys.argv.pop(1)); c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class Tests(unittest.TestCase):
 def test_read_only_allowlist(self):
  a=c.arguments('postfach','out','cwd')
  self.assertIn('apps._default.enabled=false',a)
  self.assertIn('apps.connector_2128aebfecb84f64a069897515042a44.default_tools_enabled=false',a)
  self.assertFalse(any('send' in x or 'archive' in x or 'modify' in x for x in a))
 def test_partial_rejected(self):
  with self.assertRaises(ValueError):c.validate('postfach',{'ok':True,'vollstaendig':False},{})
 def test_missing_channel_rejected(self):
  with self.assertRaises(ValueError):c.validate('slack',{'ok':True,'vollstaendig':True,'daten':{'wartend':[],'zusammenfassung':{},'kanaele':[]}}, {'kanaele':[{'id':'C1'}]})
 def test_untraceable_rejected(self):
  with self.assertRaises(ValueError):c.validate('postfach',{'ok':True,'vollstaendig':True,'daten':{'wartend':[{'worum':'A'}],'zusammenfassung':{}}},{})
 def test_valid_empty_is_allowed(self):
  x=c.validate('postfach',{'ok':True,'vollstaendig':True,'daten':{'wartend':[],'zusammenfassung':{}}},{})
  self.assertTrue(x['ok']);self.assertIn('stand',x)
unittest.main()