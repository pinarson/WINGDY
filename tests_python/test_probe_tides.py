"""Synthetic parser/security fixtures only; no real API data or credentials."""
import contextlib
from datetime import date, datetime, timedelta, timezone
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('probe_tides', Path(__file__).parents[1] / 'scripts' / 'probe_tides.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class TideDiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.start = datetime(2026, 10, 23, tzinfo=timezone.utc)
        self.end = self.start + timedelta(days=1)
        self.base = {'site_id': 'fixture-site', 'timezone': 'UTC', 'unit': 'm'}

    def levels(self):
        return dict(self.base, data=[{'time': (self.start + timedelta(minutes=10 * i)).isoformat(), 'height': 0.0} for i in range(145)])

    def test_distance_and_station_ranking(self):
        self.assertEqual(p.distance_km(47, -2, 47, -2), 0)
        self.assertAlmostEqual(p.distance_km(0, 0, 0, 1), 111.195, places=2)
        sites = p.sites_from({'sites': [
            {'site_id': 'far', 'site_name': 'Far fixture', 'latitude': 49, 'longitude': -2},
            {'site_id': 'near', 'site_name': 'Near fixture', 'latitude': 47.17, 'longitude': -2.166},
            {'site_id': 'bad', 'site_name': 'Bad fixture', 'latitude': None, 'longitude': -2},
        ]})
        self.assertEqual(len(sites), 2)
        self.assertEqual(p.rank_sites(sites, p.SPOTS['tharon'])[0]['site_id'], 'near')

    def test_levels_accept_real_zero_but_reject_missing_values_and_gaps(self):
        payload = self.levels()
        self.assertEqual(len(p.parse_levels(payload, 'fixture-site', self.start, self.end)), 145)
        payload['data'][0]['height'] = None
        with self.assertRaises(p.ProbeError): p.parse_levels(payload, 'fixture-site', self.start, self.end)
        payload = self.levels()
        del payload['data'][50]
        with self.assertRaises(p.ProbeError): p.parse_levels(payload, 'fixture-site', self.start, self.end)

    def test_levels_reject_wrong_site_units_timezone_and_truncated_period(self):
        for key, value in [('site_id', 'wrong'), ('unit', 'ft'), ('timezone', 'Europe/Paris')]:
            payload = self.levels(); payload[key] = value
            with self.assertRaises(p.ProbeError): p.parse_levels(payload, 'fixture-site', self.start, self.end)
        payload = self.levels(); payload['data'] = payload['data'][:10]
        with self.assertRaises(p.ProbeError): p.parse_levels(payload, 'fixture-site', self.start, self.end)

    def test_extrema_preserve_optional_coefficient_and_utc_dates(self):
        payload = dict(self.base, data=[{'date': '2026-10-23', 'extrema': [
            {'type': 'PM', 'time': '01:00', 'height': 4.0, 'coef': 80},
            {'type': 'BM', 'time': '07:00', 'height': 1.0},
        ]}])
        events = p.parse_extrema(payload, 'fixture-site', date(2026, 10, 23), date(2026, 10, 23))
        self.assertEqual(events[0]['coefficient'], 80)
        self.assertNotIn('coefficient', events[1])
        self.assertEqual(events[0]['time'], '2026-10-23T01:00:00+00:00')
        payload['data'][0]['extrema'][0]['coef'] = None
        events = p.parse_extrema(payload, 'fixture-site', date(2026, 10, 23), date(2026, 10, 23))
        self.assertNotIn('coefficient', events[0])

    def test_api_uses_header_not_url_and_masks_server_errors(self):
        client = p.Client('fixture-not-a-real-credential')
        class Opener:
            def open(inner_self, request, timeout):
                self.assertEqual(request.get_header('Authorization'), 'Bearer fixture-not-a-real-credential')
                self.assertNotIn('fixture-not-a-real-credential', request.full_url)
                self.assertEqual(timeout, 25)
                raise urllib.error.HTTPError(request.full_url, 401, 'fixture-not-a-real-credential', {}, None)
        client._opener = Opener()
        with self.assertRaises(p.ProbeError) as caught: client.get('/sites')
        self.assertNotIn('fixture-not-a-real-credential', str(caught.exception))
        self.assertIn('401', str(caught.exception))

    def test_redirect_never_forwards_authentication(self):
        with self.assertRaises(p.ProbeError):
            p.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.invalid/')

    def test_whitelist_and_scrub_protect_saved_json(self):
        marker = 'fixture-not-a-real-credential'
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'report.json'
            p.save_json(path, {'metadata': p.metadata({'attribution': 'Source ' + marker, 'status_notice': 'Statut', 'private': marker}), 'name': '\x1b[31m' + marker}, marker)
            text = path.read_text(encoding='utf-8')
            self.assertNotIn(marker, text)
            self.assertNotIn('private', text)
            self.assertNotIn('\x1b', json.loads(text)['name'])

    def test_missing_key_exits_before_network(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(p.Client, 'get') as get, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(p.main([]), 2)
            get.assert_not_called()


if __name__ == '__main__':
    unittest.main()
