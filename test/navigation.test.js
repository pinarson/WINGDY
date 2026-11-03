import {test} from 'node:test';
import assert from 'node:assert/strict';
import {navigationDays,parisParts,addCalendarDays,airflowBearing} from '../src/navigation.js';

const row=time=>({time:Date.parse(time),wind:18.4,gust:24.8,direction:270}); // Test fixture only.
test('Navigation days include only real two-hour slots, 08–20 in Paris',()=>{
  const rows=[row('2026-10-24T06:00Z'),row('2026-10-24T07:00Z'),row('2026-10-24T08:00Z'),row('2026-10-24T18:00Z'),row('2026-10-24T19:00Z')];
  const days=navigationDays(rows,Date.parse('2026-10-24T07:30Z'),24);
  assert.deepEqual(days[0].rows.map(r=>r.hour),[8,10,20]);assert.equal(days[0].complete,false);
  assert.deepEqual(days[0].missingHours,[12,14,16,18]);
});
test('After 20:00 local, navigation begins tomorrow; modes represent 1/2/3 calendar days',()=>{
  assert.equal(navigationDays([],Date.parse('2026-10-23T17:59Z'),24)[0].date,'2026-10-23');
  assert.equal(navigationDays([],Date.parse('2026-10-23T18:00Z'),24)[0].date,'2026-10-24');
  assert.deepEqual(navigationDays([],Date.parse('2026-12-31T20:00Z'),72).map(d=>d.date),['2027-01-01','2027-01-02','2027-01-03']);
});
test('DST changes preserve calendar groups and select 08h correctly on both sides',()=>{
  assert.equal(parisParts(Date.parse('2026-10-24T06:00Z')).hour,8);
  assert.equal(parisParts(Date.parse('2026-10-25T07:00Z')).hour,8);
  const days=navigationDays([row('2026-10-24T06:00Z'),row('2026-10-25T07:00Z')],Date.parse('2026-10-24T05:00Z'),48);
  assert.deepEqual(days.map(d=>d.rows[0].hour),[8,8]);
  assert.equal(addCalendarDays('2026-03-28',1),'2026-03-29');
  assert.equal(parisParts(Date.parse('2026-03-28T07:00Z')).hour,8);
  assert.equal(parisParts(Date.parse('2026-03-29T06:00Z')).hour,8);
});
test('Airflow arrows point opposite the meteorological origin; null remains absent',()=>{
  assert.equal(airflowBearing(0),180);assert.equal(airflowBearing(270),90);assert.equal(airflowBearing(283),103);assert.equal(airflowBearing(null),null);
});
test('Missing days and hours are never filled with fabricated forecasts',()=>{
  const days=navigationDays([row('2026-10-24T06:00Z')],Date.parse('2026-10-24T05:00Z'),72);
  assert.deepEqual(days.map(d=>d.rows.length),[1,0,0]);
  assert.throws(()=>navigationDays([],Date.now(),96));
});
