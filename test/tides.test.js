import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseTides,tideWindow,tideTime} from '../src/tides.js';
const bundle=JSON.parse(await readFile(new URL('../public/data/tides.json',import.meta.url),'utf8'));

test('The three approved stations parse genuine provider data with required notices',()=>{
  const ids={'tharon':'pointe-de-saint-gildas','la-baule':'le-pouliguen','suscinio':'le-logeo'};
  for(const [spot,station] of Object.entries(ids)){
    const data=parseTides(bundle,spot);assert.equal(data.station.site_id,station);assert.ok(data.points.length>=144);assert.ok(data.extremes.some(e=>e.type==='PM'));assert.ok(data.extremes.some(e=>e.type==='BM'));assert.ok(data.attributions.length);assert.ok(data.status_notices.length);
  }
});
test('UTC conversion handles French dates, winter time and both occurrences of the repeated hour',()=>{
  assert.match(tideTime(Date.parse('2026-10-23T01:27:00Z')),/03:27.*(?:GMT|UTC)\+2/);
  assert.match(tideTime(Date.parse('2026-10-25T00:30:00Z')),/02:30.*(?:GMT|UTC)\+2/);
  assert.match(tideTime(Date.parse('2026-10-25T01:30:00Z')),/02:30.*(?:GMT|UTC)\+1/);
  assert.match(tideTime(Date.parse('2026-12-31T23:30:00Z'),true),/01\/01.*00:30.*(?:GMT|UTC)\+1/);
});
test('Unavailable data is never extended to fill a requested 48-hour window',()=>{
  const data=parseTides(bundle,'tharon');const start=data.points.at(-1).time-3_600_000;
  const period=tideWindow(data,start,48);assert.equal(period.status,'partial');assert.ok(period.points.at(-1).time<period.end);
  assert.equal(tideWindow(data,data.to+3_600_000,24).status,'expired');
});
test('Wrong stations, absent attribution and gaps are rejected',()=>{
  for(const change of [b=>b.spots.tharon.station.site_id='other',b=>b.spots.tharon.attributions=[],b=>b.spots.tharon.points.splice(10,1)]){
    const b=structuredClone(bundle);change(b);assert.throws(()=>parseTides(b,'tharon'));
  }
});
test('An absent coefficient stays absent',()=>{
  const b=structuredClone(bundle);delete b.spots.tharon.extremes.find(e=>e.type==='PM').coefficient;
  const data=parseTides(b,'tharon');assert.equal(data.extremes.find(e=>e.type==='PM').coefficient,undefined);
});
