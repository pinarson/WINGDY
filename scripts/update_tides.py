#!/usr/bin/env python3
"""Generate an atomic public JSON bundle, without exporting credentials."""
import argparse
from datetime import datetime, time, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import tempfile
from probe_tides import Client, ProbeError, iso_utc, metadata, parse_extrema, parse_levels

ROOT = Path(__file__).resolve().parents[1]
ATTRIBUTION = ('Données de marée fournies par api-maree.fr sous licence CC BY, '
               'calculées à partir de composantes harmoniques Ifremer / PREVIMER, '
               'elles-mêmes sous licence CC BY.')
STATUS = 'Prédictions calculées. Coefficients estimés non officiels, impropres à la navigation.'

def stations():
    return json.loads((ROOT / 'config/tide-stations.json').read_text(encoding='utf-8'))

def assemble(records, start, end, fetched_at):
    result = {'schema_version': 1, 'mapping_approved': True, 'fetched_at': iso_utc(fetched_at).isoformat(),
              'source': 'https://api-maree.fr', 'license': 'https://creativecommons.org/licenses/by/4.0/',
              'timezone': 'UTC', 'from': start.isoformat(), 'to': end.isoformat(), 'step_minutes': 10,
              'datum': 'Mètres au-dessus du zéro de référence local du fournisseur (ZH annoncé ; calage modélisé possible).',
              'spots': {}}
    for sid, station in stations().items():
        levels, extrema = records[sid]
        points = parse_levels(levels, station['site_id'], start, end)
        events = parse_extrema(extrema, station['site_id'], start.date(), (end - timedelta(seconds=1)).date())
        credits = list(dict.fromkeys([metadata(p)['attribution'] for p in (levels, extrema) if 'attribution' in metadata(p)]))
        notices = list(dict.fromkeys([metadata(p)['status_notice'] for p in (levels, extrema) if 'status_notice' in metadata(p)]))
        result['spots'][sid] = {'station': station, 'points': points, 'extremes': events,
                                'attributions': credits or [ATTRIBUTION], 'status_notices': notices or [STATUS],
                                'credit_origin': 'api_response' if credits else 'provider_documentation',
                                'notice_origin': 'api_response' if notices else 'provider_documentation'}
    return result

def from_report(path):
    report = json.loads(path.read_text(encoding='utf-8'))
    if report.get('source') != 'https://api-maree.fr' or report.get('timezone') != 'UTC':
        raise ProbeError('Source ou fuseau du rapport invalide.')
    start, end = iso_utc(report['from']), iso_utc(report['to'])
    records = {}
    for sid, station in stations().items():
        record = report['spots'][sid]
        if record['station']['site_id'] != station['site_id']:
            raise ProbeError('Le rapport ne correspond pas aux stations approuvées.')
        if any(record[name]['status'] != 'ok' for name in ('water_levels', 'tide_extrema')):
            raise ProbeError('Rapport incomplet : aucune mise à jour effectuée.')
        identity = {'site_id': station['site_id'], 'unit': 'm', 'timezone': 'UTC'}
        levels = dict(identity, data=record['water_levels']['data'], **metadata(record['water_levels']))
        groups = {}
        for event in record['tide_extrema']['data']:
            stamp = iso_utc(event['time'])
            item = {'type': event['type'], 'time': stamp.strftime('%H:%M'), 'height': event['height']}
            if 'coefficient' in event:
                item['coef'] = event['coefficient']
            groups.setdefault(stamp.date().isoformat(), []).append(item)
        extrema = dict(identity, data=[{'date': day, 'extrema': values} for day, values in groups.items()], **metadata(record['tide_extrema']))
        records[sid] = (levels, extrema)
    # Importing must not make old data look freshly retrieved.
    return assemble(records, start, end, report['fetched_at'])

def fetch_bundle(key, days=7):
    start = datetime.combine(datetime.now(timezone.utc).date(), time(), timezone.utc)
    end = start + timedelta(days=days)
    client, records = Client(key), {}
    for sid, station in stations().items():
        levels = client.get('/water-levels', **{'site': station['site_id'], 'from': start.strftime('%Y-%m-%dT%H:%M'), 'to': end.strftime('%Y-%m-%dT%H:%M'), 'step': 10, 'tz': 'UTC'})
        extrema = client.get('/tide-extrema', **{'site': station['site_id'], 'from': start.date().isoformat(), 'to': (end - timedelta(seconds=1)).date().isoformat(), 'tz': 'UTC'})
        records[sid] = (levels, extrema)
    return assemble(records, start, end, datetime.now(timezone.utc).isoformat())

def write_bundle(bundle, target, key=''):
    encoded = json.dumps(bundle, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n'
    if key and key in encoded:
        raise ProbeError('Export refusé : donnée sensible détectée.')
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = None
    try:
        with tempfile.NamedTemporaryFile('w', dir=target.parent, suffix='.tmp', encoding='utf-8', delete=False) as output:
            tmp = Path(output.name)
            output.write(encoded)
        os.replace(tmp, target)
    finally:
        if tmp and tmp.exists():
            tmp.unlink()

def main(argv=None):
    parser = argparse.ArgumentParser(description='Générer les marées statiques des trois stations approuvées, sans publication.')
    parser.add_argument('--from-report', type=Path, help='Importer un diagnostic réel existant sans appel API.')
    parser.add_argument('--days', type=int, choices=range(1, 8), default=7)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/tides.json')
    args = parser.parse_args(argv)
    key = '' if args.from_report else os.environ.get('API_MAREE_KEY', '').strip()
    if not args.from_report and (not key or '\n' in key or '\r' in key):
        print('API_MAREE_KEY absente ou invalide. Aucun appel effectué.', file=sys.stderr)
        return 2
    try:
        bundle = from_report(args.from_report) if args.from_report else fetch_bundle(key, args.days)
        write_bundle(bundle, args.output, key)
        print('JSON de marées validé : trois stations, période et date de récupération conservées. Aucune publication.')
        return 0
    except Exception:
        print('Mise à jour échouée : vérifier connexion, clé, schéma et période. Ancien JSON conservé.', file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
