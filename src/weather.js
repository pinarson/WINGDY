export const CACHE_MS = 15 * 60 * 1000;
export const FORECAST_HOURS = 96;
const cache = new Map();
const variables = ['wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m'];
export const isValue = x => typeof x === 'number' && Number.isFinite(x);
export function weatherURL(spot) {
  const params = new URLSearchParams({ latitude: spot.lat, longitude: spot.lon, hourly: variables.join(','), current: variables.join(','), wind_speed_unit: 'kn', timeformat: 'unixtime', timezone: 'Europe/Paris', forecast_hours: String(FORECAST_HOURS) });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}
export function parseWeather(json, fetchedAt = Date.now()) {
  if (json.error) throw new Error(json.reason || 'Réponse Open-Meteo invalide.');
  if (!Array.isArray(json.hourly?.time)) throw new Error('Prévisions horaires absentes.');
  if (json.hourly_units?.wind_speed_10m !== 'kn' || json.hourly_units?.wind_gusts_10m !== 'kn') throw new Error('Unités de vent inattendues.');
  const clean = (v, direction = false) => isValue(v) && v >= 0 && (!direction || v <= 360) ? v : null;
  const rows = json.hourly.time.map((time, i) => ({ time: isValue(time) ? time * 1000 : null, wind: clean(json.hourly.wind_speed_10m?.[i]), gust: clean(json.hourly.wind_gusts_10m?.[i]), direction: clean(json.hourly.wind_direction_10m?.[i], true) })).filter(r => r.time !== null);
  if (!rows.length || !rows.some(r => r.wind !== null || r.gust !== null)) throw new Error('Aucune prévision de vent disponible.');
  if(rows.some((r,i)=>i&&r.time-rows[i-1].time!==3_600_000))throw new Error('Chronologie des prévisions discontinue.');
  const c = json.current;
  const current = c && isValue(c.time) && json.current_units?.wind_speed_10m === 'kn' && json.current_units?.wind_gusts_10m === 'kn'
    ? { time: c.time * 1000, wind: clean(c.wind_speed_10m), gust: clean(c.wind_gusts_10m), direction: clean(c.wind_direction_10m, true) } : null;
  return { rows, current, fetchedAt, modelLatitude: json.latitude, modelLongitude: json.longitude };
}
export function parseWeatherBundle(bundle,spot) {
  const record=bundle?.spots?.[spot.id];
  if(bundle?.schema_version!==1||bundle.source!=='https://api.open-meteo.com/v1/forecast'||!record||record.latitude!==spot.lat||record.longitude!==spot.lon)throw new Error('Source météo statique invalide.');
  const fetchedAt=Date.parse(record.fetched_at);
  if(!Number.isFinite(fetchedAt)||fetchedAt>Date.now()+60_000)throw new Error('Date météo invalide.');
  const data=parseWeather(record.payload,fetchedAt);
  if(data.rows.at(-1).time<Math.floor(Date.now()/3_600_000)*3_600_000)throw new Error('Prévisions enregistrées expirées.');
  return {...data,sourceMode:'static'};
}
export async function fetchWeather(spot, signal, basePath='/') {
  const saved = cache.get(spot.id);
  if (saved && Date.now() - saved.fetchedAt < CACHE_MS) return saved;
  const snapshot=await fetch(new URL(`${basePath}data/weather.json`,window.location.origin),{signal,credentials:'omit',cache:'no-cache'});
  if(snapshot.ok){
    const data=parseWeatherBundle(await snapshot.json(),spot);
    cache.set(spot.id,data);
    return data;
  }
  if(snapshot.status!==404)throw new Error('Prévisions enregistrées indisponibles.');
  const response = await fetch(weatherURL(spot), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(response.status === 429 ? 'Limite Open-Meteo atteinte. Réessayez plus tard.' : `Open-Meteo indisponible (HTTP ${response.status}).`);
  const data = parseWeather(await response.json());
  cache.set(spot.id, data);
  return data;
}
export function cardinal(degrees) {
  return isValue(degrees) ? ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'][Math.round(degrees / 22.5) % 16] : '—';
}
export function chartPath(rows, key, x, y) {
  let pen = false;
  return rows.map((r, i) => {
    if (!isValue(r[key])) { pen = false; return ''; }
    const point = `${pen ? 'L' : 'M'}${x(i).toFixed(2)},${y(r[key]).toFixed(2)}`;
    pen = true;
    return point;
  }).join(' ');
}
export const formatTime = (ms, full = false) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...(full ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' }) }).format(ms);
