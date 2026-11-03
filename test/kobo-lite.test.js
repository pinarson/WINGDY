import {test} from 'node:test';
import assert from 'node:assert/strict';
import {liteNavigationDay,provenanceBearing} from '../src/kobo-lite-model.js';
test('Lite selects five real Paris slots across winter transition',()=>{
 const rows=Array.from({length:96},(_,i)=>({time:Date.parse('2026-10-23T00:00Z')+i*3600000,wind:12,gust:18,direction:270}));
 const day=liteNavigationDay(rows,Date.parse('2026-10-24T20:00Z'));
 assert.equal(day.date,'2026-10-25');assert.equal(day.complete,true);
 assert.deepEqual(day.slots.map(s=>new Date(s.row.time).getUTCHours()),[9,11,13,15,17]);
 assert.equal(liteNavigationDay([],Date.parse('2026-10-24T10:00Z')).complete,false);
 assert.equal(provenanceBearing(270),270);assert.equal(provenanceBearing(null),null);
});
