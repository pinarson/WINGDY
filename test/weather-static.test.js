import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseWeatherBundle,parseWeather} from '../src/weather.js';
import {validateForecast} from '../scripts/update-weather.mjs';
import {spots} from '../src/spots.js';

const real=JSON.parse(await readFile(new URL('../public/data/weather.json',import.meta.url),'utf8'));
test('Actual static weather preserves retrieval dates and the three spot identities',t=>{
  t.mock.method(Date,'now',()=>Math.max(...Object.values(real.spots).map(r=>Date.parse(r.fetched_at))));
  for(const spot of spots){const data=parseWeatherBundle(real,spot);assert.equal(data.sourceMode,'static');assert.equal(data.fetchedAt,Date.parse(real.spots[spot.id].fetched_at));assert.ok(data.rows.length>=48);assert.ok(data.current);}
});
test('Static weather rejects mismatched coordinates, source and future retrieval date',()=>{
  for(const mutate of [b=>b.spots.tharon.latitude=0,b=>b.source='https://example.invalid',b=>b.spots.tharon.fetched_at=new Date(Date.now()+86_400_000).toISOString()]){const b=structuredClone(real);mutate(b);assert.throws(()=>parseWeatherBundle(b,spots[0]));}
});
test('Updater rejects absent hourly values and discontinuous timestamps',()=>{
  const payload=real.spots.tharon.payload;
  validateForecast(payload,payload.hourly.time.length);
  const missing=structuredClone(payload);missing.hourly.wind_speed_10m[3]=null;assert.throws(()=>validateForecast(missing,payload.hourly.time.length));
  const gap=structuredClone(payload);gap.hourly.time[2]+=60;assert.throws(()=>parseWeather(gap),/discontinue/);
});
test('Expired static forecast cannot appear as successful current weather',()=>{
  const b=structuredClone(real),p=b.spots.tharon.payload;
  const shift=p.hourly.time.at(-1)-Math.floor(Date.now()/1000)+7200;
  p.hourly.time=p.hourly.time.map(t=>t-shift);
  assert.throws(()=>parseWeatherBundle(b,spots[0]),/expirées/);
});
