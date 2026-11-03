"""Credential lifecycle tests with a non-secret marker and no API calls."""
import contextlib
import io
import sys
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import collect_real_data as c

class CollectionTests(unittest.TestCase):
    def test_noninteractive_input_is_refused_without_prompting(self):
        with patch.object(c.sys.stdin,'isatty',return_value=False),patch.object(c.getpass,'getpass') as prompt,contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(c.main(),2)
            prompt.assert_not_called()

    def test_secret_reaches_only_tide_child_and_never_stdout_or_parent_environment(self):
        calls=[]
        def run(command,**kwargs):
            calls.append((command,dict(kwargs['env'])))
            return SimpleNamespace(returncode=0)
        output=io.StringIO()
        with patch.object(c.sys.stdin,'isatty',return_value=True),patch.object(c.shutil,'which',return_value='node'),patch.object(c.getpass,'getpass',return_value='fixture-credential-marker'),patch.object(c.subprocess,'run',side_effect=run),patch.dict(c.os.environ,{},clear=True),contextlib.redirect_stdout(output):
            self.assertEqual(c.main(),0)
            self.assertNotIn('API_MAREE_KEY',c.os.environ)
        self.assertEqual(calls[0][1]['API_MAREE_KEY'],'fixture-credential-marker')
        self.assertNotIn('API_MAREE_KEY',calls[1][1])
        self.assertNotIn('fixture-credential-marker',output.getvalue())
        self.assertNotIn('fixture-credential-marker',str([call[0] for call in calls]))

    def test_warning_about_unmasked_input_aborts_collection(self):
        with patch.object(c.sys.stdin,'isatty',return_value=True),patch.object(c.shutil,'which',return_value='node'),patch.object(c.getpass,'getpass',side_effect=c.getpass.GetPassWarning),patch.object(c.subprocess,'run') as run,contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(c.main(),2)
            run.assert_not_called()

if __name__=='__main__':unittest.main()
