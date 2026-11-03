import json
import sys
from pathlib import Path
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import update_tides as u

class UpdateTests(unittest.TestCase):
    def test_approved_station_mapping_is_fixed(self):
        self.assertEqual({k:v['site_id'] for k,v in u.stations().items()}, {'tharon':'pointe-de-saint-gildas','la-baule':'le-pouliguen','suscinio':'le-logeo'})

    def test_sensitive_output_refused_without_overwriting_previous_bundle(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'tides.json';target.write_text('previous',encoding='utf-8')
            with self.assertRaises(u.ProbeError):u.write_bundle({'echo':'fixture-credential-marker'},target,'fixture-credential-marker')
            self.assertEqual(target.read_text(encoding='utf-8'),'previous')

    def test_atomic_output_is_json(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'tides.json';u.write_bundle({'status':'test fixture only'},target)
            self.assertEqual(json.loads(target.read_text(encoding='utf-8')),{'status':'test fixture only'})
            self.assertEqual(len(list(Path(temp).iterdir())),1)

if __name__=='__main__':unittest.main()
