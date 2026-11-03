#!/usr/bin/env python3
"""Read-only api-maree.fr diagnostic. Standard library; never stores credentials."""
import argparse
from datetime import date, datetime, time, timedelta, timezone
import json
import math
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = 'https://api-maree.fr'
SPOTS = {
    'tharon': {'name': 'Tharon-Plage', 'latitude': 47.16957, 'longitude': -2.16599},
    'la-baule': {'name': 'La Baule', 'latitude': 47.28191, 'longitude': -2.39399},
    'suscinio': {'name': 'Suscinio', 'latitude': 47.50468, 'longitude': -2.72878},
}


class ProbeError(Exception):
    """Only fixed, non-sensitive messages may cross the command boundary."""


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def distance_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1, max(0, a))))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ProbeError('Redirection HTTP refusée : authentification non transférée.')


class Client:
    def __init__(self, key):
        self._key = key
        self._opener = urllib.request.build_opener(NoRedirect())

    def get(self, endpoint, **params):
        if endpoint not in ('/sites', '/water-levels', '/tide-extrema'):
            raise ProbeError('Endpoint non autorisé.')
        url = BASE + endpoint
        if params:
            url += '?' + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={
            'Authorization': 'Bearer ' + self._key,
            'Accept': 'application/json',
            'User-Agent': 'WingDashboard-tide-diagnostic/1.0',
        })
        try:
            with self._opener.open(request, timeout=25) as response:
                raw = response.read(10_000_001)
        except urllib.error.HTTPError as exc:
            # Do not print response bodies, URLs, headers or exception reprs.
            raise ProbeError('HTTP %d sur %s.' % (exc.code, endpoint)) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise ProbeError('Connexion API impossible ou délai dépassé sur ' + endpoint + '.') from None
        if len(raw) > 10_000_000:
            raise ProbeError('Réponse API trop volumineuse.')
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeError):
            raise ProbeError('Réponse JSON invalide sur ' + endpoint + '.') from None
        if not isinstance(payload, dict) or payload.get('error'):
            raise ProbeError('Erreur applicative API sur ' + endpoint + '.')
        return payload


def sites_from(payload):
    result = []
    records = payload.get('sites')
    if not isinstance(records, list):
        raise ProbeError('Liste /sites absente ou structure inattendue.')
    seen = set()
    for site in records:
        if not isinstance(site, dict):
            continue
        lat, lon = site.get('latitude'), site.get('longitude')
        sid, name = site.get('site_id'), site.get('site_name')
        if not (isinstance(sid, str) and sid and isinstance(name, str) and name):
            continue
        if not (numeric(lat) and numeric(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        if sid in seen:
            raise ProbeError('Identifiant de station dupliqué dans /sites.')
        seen.add(sid)
        result.append({'site_id': sid, 'site_name': name, 'latitude': lat, 'longitude': lon,
                       'demo': site.get('demo') is True})
    if not result:
        raise ProbeError('Aucune station avec coordonnées valides.')
    return result


def rank_sites(sites, spot):
    return sorted((dict(s, distance_km=round(distance_km(spot['latitude'], spot['longitude'],
                  s['latitude'], s['longitude']), 3)) for s in sites),
                  key=lambda s: (s['distance_km'], s['site_id']))


def iso_utc(value):
    if not isinstance(value, str):
        raise ProbeError('Horodatage absent.')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed.astimezone(timezone.utc)
    except ValueError:
        raise ProbeError('Horodatage invalide ou sans fuseau.') from None


def metadata(payload):
    # Whitelist, rather than serializing an entire server response.
    return {k: payload[k] for k in ('attribution', 'status_notice')
            if isinstance(payload.get(k), str) and payload[k].strip()}


def check_identity(payload, sid):
    if payload.get('site_id') != sid or payload.get('unit') != 'm' or payload.get('timezone') != 'UTC':
        raise ProbeError('Station, unité ou fuseau inattendu dans la réponse.')


def parse_levels(payload, sid, start, end):
    check_identity(payload, sid)
    raw = payload.get('data')
    if not isinstance(raw, list) or not raw or len(raw) > 1500:
        raise ProbeError('Série de hauteurs vide ou invalide.')
    points, previous = [], None
    for item in raw:
        if not isinstance(item, dict) or not numeric(item.get('height')):
            raise ProbeError('Hauteur invalide ou manquante ; aucun remplacement synthétique.')
        stamp = iso_utc(item.get('time'))
        if not start <= stamp <= end or (previous is not None and stamp - previous != timedelta(minutes=10)):
            raise ProbeError('Série hors période, non ordonnée ou avec un trou de données.')
        points.append({'time': stamp.isoformat(), 'height': item['height']})
        previous = stamp
    # End may be excluded by the service, but all 10-minute bins must be present.
    if iso_utc(points[0]['time']) != start or iso_utc(points[-1]['time']) < end - timedelta(minutes=10):
        raise ProbeError('La série ne couvre pas la totalité de la période demandée.')
    return points


def parse_extrema(payload, sid, first_day, last_day):
    check_identity(payload, sid)
    groups = payload.get('data')
    if not isinstance(groups, list) or not groups:
        raise ProbeError('Liste PM/BM vide ou invalide.')
    events, seen, days_seen = [], set(), set()
    for group in groups:
        if not isinstance(group, dict):
            raise ProbeError('Groupe PM/BM invalide.')
        try:
            day = date.fromisoformat(group.get('date', ''))
        except (TypeError, ValueError):
            raise ProbeError('Date PM/BM invalide.') from None
        if not first_day <= day <= last_day or day in days_seen:
            raise ProbeError('Journée PM/BM dupliquée ou hors période.')
        days_seen.add(day)
        items = group.get('extrema')
        if not isinstance(items, list):
            raise ProbeError('Liste des extrema absente.')
        for item in items:
            if not isinstance(item, dict) or item.get('type') not in ('PM', 'BM') or not numeric(item.get('height')):
                raise ProbeError('Extremum invalide.')
            try:
                clock = item['time']
                if not isinstance(clock, str) or len(clock) != 5 or clock[2] != ':':
                    raise ValueError()
                stamp = datetime.combine(day, time.fromisoformat(clock), timezone.utc)
            except (KeyError, TypeError, ValueError):
                raise ProbeError('Heure PM/BM invalide.') from None
            identity = (stamp, item['type'])
            if identity in seen:
                raise ProbeError('Extremum dupliqué.')
            seen.add(identity)
            event = {'type': item['type'], 'time': stamp.isoformat(), 'height': item['height']}
            if item.get('coef') is not None:
                if item['type'] != 'PM' or not numeric(item['coef']) or not 0 <= item['coef'] <= 120:
                    raise ProbeError('Coefficient invalide.')
                event['coefficient'] = item['coef']
            events.append(event)
    expected = {first_day + timedelta(days=i) for i in range((last_day - first_day).days + 1)}
    if days_seen != expected or not {'PM', 'BM'} <= {e['type'] for e in events}:
        raise ProbeError('Période PM/BM incomplète.')
    return sorted(events, key=lambda e: e['time'])


def scrub(value, key):
    if isinstance(value, dict):
        return {scrub(k, key): scrub(v, key) for k, v in value.items()}
    if isinstance(value, list):
        return [scrub(v, key) for v in value]
    if isinstance(value, str):
        text = value.replace(key, '[SECRET MASQUÉ]') if key else value
        # Avoid control characters (terminal escapes) supplied by remote text.
        return ''.join(c for c in text if c.isprintable() or c == '\n')
    return value


def save_json(path, value, key):
    text = json.dumps(scrub(value, key), ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    if key and key in text:
        raise ProbeError('Sécurité : export refusé.')
    path.write_text(text, encoding='utf-8')


def probe(client, first_day, days, overrides, emit):
    sites = sites_from(client.get('/sites'))
    start = datetime.combine(first_day, time(), timezone.utc)
    end = start + timedelta(days=days)
    last_day = (end - timedelta(seconds=1)).date()
    report = {'schema_version': 1, 'status': 'diagnostic_only', 'mapping_approved': False,
              'fetched_at': datetime.now(timezone.utc).isoformat(), 'source': BASE,
              'timezone': 'UTC', 'from': start.isoformat(), 'to': end.isoformat(),
              'valid_sites_count': len(sites), 'spots': {}}
    for spot_id, spot in SPOTS.items():
        candidates = rank_sites(sites, spot)
        chosen = next((s for s in candidates if s['site_id'] == overrides.get(spot_id)), None) if spot_id in overrides else candidates[0]
        if chosen is None:
            raise ProbeError('Une station demandée est absente de /sites.')
        emit('\n%s — point %.5f, %.5f' % (spot['name'], spot['latitude'], spot['longitude']))
        for c in candidates[:5]:
            emit('  %s [%s] : %.5f, %.5f ; %.3f km' % (c['site_name'], c['site_id'], c['latitude'], c['longitude'], c['distance_km']))
        emit('Station testée : %s [%s], %.3f km (référence proposée, non validée).' % (chosen['site_name'], chosen['site_id'], chosen['distance_km']))
        result = {'spot': spot, 'candidates': candidates[:5], 'station': chosen,
                  'selection': 'explicit_override' if spot_id in overrides else 'nearest_proposal',
                  'reference_notice': 'Station de référence proposée ; proximité géographique uniquement, correspondance marégraphique à valider.'}
        # Test endpoints independently so PM/BM can succeed even if heights fail.
        for endpoint, name, params in (
            ('/water-levels', 'water_levels', {'site': chosen['site_id'], 'from': start.strftime('%Y-%m-%dT%H:%M'), 'to': end.strftime('%Y-%m-%dT%H:%M'), 'step': 10, 'tz': 'UTC'}),
            ('/tide-extrema', 'tide_extrema', {'site': chosen['site_id'], 'from': first_day.isoformat(), 'to': last_day.isoformat(), 'tz': 'UTC'}),
        ):
            try:
                payload = client.get(endpoint, **params)
                points = parse_levels(payload, chosen['site_id'], start, end) if name == 'water_levels' else parse_extrema(payload, chosen['site_id'], first_day, last_day)
                result[name] = {'status': 'ok', 'data': points, **metadata(payload)}
                emit('%s : OK, %d valeurs.' % (endpoint, len(points)))
                if name == 'tide_extrema':
                    for e in points:
                        coef = ' ; coefficient estimé %s' % e['coefficient'] if 'coefficient' in e else ' ; coefficient non fourni'
                        emit('  %s %s UTC : %.3f m%s' % (e['type'], e['time'], e['height'], coef))
                missing = [k for k in ('attribution', 'status_notice') if k not in result[name]]
                if missing:
                    emit('  Mentions absentes de la réponse : ' + ', '.join(missing) + '. Publication non validée.')
            except ProbeError as exc:
                result[name] = {'status': 'error', 'error': str(exc)}
                emit('%s : ÉCHEC — %s' % (endpoint, exc))
        report['spots'][spot_id] = result
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description='Diagnostic réel de marées, sans modification de l’interface ni publication.')
    parser.add_argument('--date', help='Premier jour UTC YYYY-MM-DD ; aujourd’hui par défaut.')
    parser.add_argument('--days', type=int, choices=range(1, 8), default=1)
    parser.add_argument('--station', action='append', default=[], metavar='SPOT=SITE_ID', help='Remplacer la proposition géographique pour un spot.')
    parser.add_argument('--output-dir', default='output/tide-diagnostic', help='Dossier local de diagnostic uniquement.')
    args = parser.parse_args(argv)
    key = os.environ.get('API_MAREE_KEY', '').strip()
    if not key:
        print('API_MAREE_KEY absente : aucun appel authentifié effectué.', file=sys.stderr)
        return 2
    if '\n' in key or '\r' in key:
        print('API_MAREE_KEY invalide.', file=sys.stderr)
        return 2
    emit = lambda message: print(scrub(message, key))
    try:
        first_day = date.fromisoformat(args.date) if args.date else datetime.now(timezone.utc).date()
        today = datetime.now(timezone.utc).date()
        if first_day < today - timedelta(days=30) or first_day + timedelta(days=args.days) > today + timedelta(days=30):
            raise ProbeError('Dates hors de la fenêtre J-30 à J+30.')
        overrides = {}
        for spec in args.station:
            sid, sep, station = spec.partition('=')
            if not sep or sid not in SPOTS or not station or sid in overrides:
                raise ProbeError('Argument --station invalide ; utiliser SPOT=SITE_ID une fois par spot.')
            overrides[sid] = station
        report = probe(Client(key), first_day, args.days, overrides, emit)
        # All writes are diagnostic-only and occur after response processing.
        target = Path(args.output_dir)
        target.mkdir(parents=True, exist_ok=True)
        save_json(target / 'report.json', report, key)
        for sid, result in report['spots'].items():
            save_json(target / (sid + '.json'), {k: report[k] for k in ('schema_version', 'status', 'mapping_approved', 'fetched_at', 'source', 'timezone', 'from', 'to')} | result, key)
        emit('\nRapports JSON enregistrés localement. Aucune publication ni correspondance approuvée.')
        return 0 if all(s[n]['status'] == 'ok' for s in report['spots'].values() for n in ('water_levels', 'tide_extrema')) else 1
    except ProbeError as exc:
        emit('Diagnostic interrompu : ' + str(exc))
        return 1
    except (ValueError, OSError, TypeError, KeyError, OverflowError):
        emit('Diagnostic interrompu : configuration, schéma ou écriture invalide. Détails bruts masqués.')
        return 1
    except Exception:
        emit('Diagnostic interrompu : erreur inattendue. Détails bruts masqués pour protéger les identifiants.')
        return 1


if __name__ == '__main__':
    sys.exit(main())
