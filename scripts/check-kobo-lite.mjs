import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {parseWeather,formatTime,cardinal} from '../src/weather.js';
import {liteNavigationDay,liteConditions} from '../src/kobo-lite-model.js';
const weather=JSON.parse(await readFile('public/data/weather.json','utf8'));
const tides=JSON.parse(await readFile('public/data/tides.json','utf8'));
const browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 for(const spot of ['tharon','la-baule','suscinio']){
  const page=await browser.newPage({viewport:{width:600,height:800},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const now=Date.now();await page.clock.setFixedTime(now);
  await page.goto(`http://127.0.0.1:5174/kobo/?spot=${spot}`);
  await page.waitForFunction(()=>window.__KOBO_LITE_STATE__==='ready');
  const model=parseWeather(weather.spots[spot].payload),day=liteNavigationDay(model.rows,now),current=liteConditions(model,now);
  assert.equal(await page.locator('button,select,input').count(),0);
  assert.equal(await page.locator('tbody tr').count(),4);
  assert.deepEqual(await page.locator('tbody tr:first-child td').allTextContents(),['10h','12h','14h','16h','18h']);
  for(const [i,key] of ['wind','gust'].entries()){
   assert.equal(await page.locator('.lite-number').nth(i).innerText(),`${Math.round(current[key])}nd`);
   assert.deepEqual(await page.locator(i?'.lite-gust-values td':'.lite-wind-values td').allTextContents(),day.slots.map(s=>String(Math.round(s.row[key]))));
  }
  assert.equal(await page.locator('.lite-direction strong').innerText(),cardinal(current.direction));
  assert.deepEqual(await page.locator('.lite-direction-values path').evaluateAll(els=>els.map(e=>e.getAttribute('transform'))),day.slots.map(s=>`rotate(${s.row.direction} 24 24)`));
  const meta=await page.evaluate(()=>window.__KOBO_LITE_META__);
  const events=tides.spots[spot].extremes.filter(e=>Date.parse(e.time)>=meta.tideStart&&Date.parse(e.time)<=meta.tideEnd);
  assert.deepEqual(await page.locator('.lite-extremum-time').allTextContents(),events.map(e=>`${e.type} ${formatTime(Date.parse(e.time))}`));
  assert.deepEqual(await page.locator('.lite-coefficient').allTextContents(),events.filter(e=>e.coefficient!=null).map(e=>`Coef. ${e.coefficient}`));
  for(const notice of [...tides.spots[spot].attributions,...tides.spots[spot].status_notices])assert.ok((await page.locator('footer').innerText()).includes(notice));
  const layout=await page.evaluate(()=>{const root=document.querySelector('main'),r=root.getBoundingClientRect();return {w:r.width,h:r.height,overflow:root.scrollHeight>800,footer:document.querySelector('footer').getBoundingClientRect().bottom,metricBottom:Math.max(...[...document.querySelectorAll('.lite-metric')].map(e=>e.getBoundingClientRect().bottom)),conditionsBottom:document.querySelector('.lite-conditions').getBoundingClientRect().bottom};});
  assert.equal(layout.w,600);assert.equal(layout.h,800);assert.equal(layout.overflow,false);assert.ok(layout.footer<=800);assert.ok(layout.metricBottom<layout.conditionsBottom);assert.deepEqual(errors,[]);
  results.push({spot,day:day.date,slots:5,tideEvents:events.length,layout,passed:true});await page.close();
 }
 // The existing web retains its selectors and range controls.
 const web=await browser.newPage();await web.goto('http://127.0.0.1:5174/');await web.waitForFunction(()=>window.__WING_STATE__==='ready');
 assert.equal(await web.locator('#spot').count(),1);assert.equal(await web.locator('.wind-range button').count(),3);
 await writeFile('output/kobo-lite/tests.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
