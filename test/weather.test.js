import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeather, chartPath, cardinal, weatherURL, formatTime } from '../src/weather.js';
import { spots } from '../src/spots.js';
// Synthetic fixtures only for unit tests; never bundled into the application.
const fixture = () => ({ hourly_units: { wind_speed_10m: 'kn', wind_gusts_10m: 'kn' }, hourly: { time: [1792890000, 1792893600, 1792897200], wind_speed_10m: [0, null, 20], wind_gusts_10m: [5, null, 25], wind_direction_10m: [0, null, 270] } });
test('Missing values stay absent, zero remains a valid reading', () => {
  const data = parseWeather(fixture()); assert.equal(data.rows[0].wind, 0); assert.equal(data.rows[1].wind, null); assert.equal(data.current, null);
  assert.equal(chartPath(data.rows, 'wind', i => i, n => n), 'M0.00,0.00  M2.00,20.00');
});
test('Unexpected units, malformed data and API errors fail explicitly', () => {
  const f = fixture(); f.hourly_units.wind_speed_10m = 'km/h'; assert.throws(() => parseWeather(f), /Unités/);
  assert.throws(() => parseWeather({}), /absentes/); assert.throws(() => parseWeather({ error: true, reason: 'Bad request' }), /Bad request/);
});
test('Meteorological bearings: north, east, southwest, wrap and missing', () => {
  assert.equal(cardinal(0), 'N'); assert.equal(cardinal(90), 'E'); assert.equal(cardinal(225), 'SO'); assert.equal(cardinal(360), 'N'); assert.equal(cardinal(null), '—');
});
test('Paris times handle the autumn clock change without losing either hour', () => {
  assert.equal(formatTime(Date.parse('2026-10-25T00:00:00Z')), '02:00'); assert.equal(formatTime(Date.parse('2026-10-25T01:00:00Z')), '02:00');
});
test('Each real spot requests knots and unambiguous epoch timestamps', () => {
  for (const spot of spots) { const u = new URL(weatherURL(spot)); assert.equal(u.searchParams.get('latitude'), String(spot.lat)); assert.equal(u.searchParams.get('wind_speed_unit'), 'kn'); assert.equal(u.searchParams.get('forecast_hours'), '96'); assert.equal(u.searchParams.get('timeformat'), 'unixtime'); assert.equal(u.searchParams.get('apikey'), null); }
});
