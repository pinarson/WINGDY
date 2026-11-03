import stations from '../config/tide-stations.json' with { type: 'json' };
const TEN_MINUTES = 600_000;
const finite = n => typeof n === 'number' && Number.isFinite(n);
const timestamp = s => typeof s === 'string' && /(?:Z|\+00:00)$/.test(s) && Number.isFinite(Date.parse(s)) ? Date.parse(s) : NaN;

export function parseTides(bundle, spotId) {
  const reference = stations[spotId];
  const record = bundle?.spots?.[spotId];
  const from = timestamp(bundle?.from), to = timestamp(bundle?.to), fetchedAt = timestamp(bundle?.fetched_at);
  if (!reference || bundle.schema_version !== 1 || bundle.mapping_approved !== true || bundle.timezone !== 'UTC' || bundle.source !== 'https://api-maree.fr' || bundle.step_minutes !== 10 || !record || record.station?.site_id !== reference.site_id || ![from,to,fetchedAt].every(Number.isFinite) || to <= from) throw new Error('Données de marées invalides.');
  if (!Array.isArray(record.points) || record.points.length < 2 || !Array.isArray(record.extremes)) throw new Error('Données de marées incomplètes.');
  const points = record.points.map(p => ({time: timestamp(p.time), height: p.height}));
  if (points.some((p,i) => !finite(p.height) || !finite(p.time) || p.time < from || p.time > to || (i && p.time - points[i-1].time !== TEN_MINUTES)) || points[0].time !== from || points.at(-1).time < to - TEN_MINUTES) throw new Error('Série de marées incomplète.');
  const extremes = record.extremes.map(e => ({...e,time:timestamp(e.time)}));
  if (extremes.some(e => !['PM','BM'].includes(e.type) || !finite(e.time) || e.time < from || e.time >= to || !finite(e.height) || (e.coefficient != null && (e.type !== 'PM' || !finite(e.coefficient) || e.coefficient < 0 || e.coefficient > 120)))) throw new Error('Horaires de marées invalides.');
  for (const key of ['attributions','status_notices']) if (!Array.isArray(record[key]) || !record[key].length || record[key].some(s => typeof s !== 'string' || !s.trim())) throw new Error('Mentions de marées absentes.');
  return {...record, station:reference, points, extremes, from, to, fetchedAt, datum:bundle.datum};
}

export function tideWindow(data, start, hours) {
  const end = start + hours * 3_600_000;
  const points = data.points.filter(p => p.time >= start && p.time <= end);
  const extremes = data.extremes.filter(p => p.time >= start && p.time <= end);
  const expired = data.points.at(-1).time < start;
  const partial = !expired && (data.from > start || data.points.at(-1).time < end - TEN_MINUTES);
  return {points, extremes, start, end, status:expired ? 'expired' : points.length < 2 ? 'unavailable' : partial ? 'partial' : 'ready', old:Date.now() - data.fetchedAt > 36 * 3_600_000};
}

export async function fetchTides(spotId, basePath, signal) {
  const url = new URL(`${basePath}data/tides.json`, window.location.origin);
  const response = await fetch(url, {signal, credentials:'omit',cache:'no-cache'});
  if (!response.ok) throw new Error('Données de marées indisponibles.');
  return parseTides(await response.json(), spotId);
}

export const tideTime = (ms, date = false) => new Intl.DateTimeFormat('fr-FR', {timeZone:'Europe/Paris', ...(date ? {day:'2-digit',month:'2-digit'} : {}),hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset'}).format(ms);
