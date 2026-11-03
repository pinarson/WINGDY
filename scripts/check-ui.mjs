import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parseWeather} from '../src/weather.js';
import {navigationDays,parisParts,airflowBearing} from '../src/navigation.js';

const origin=process.env.WING_PREVIEW_URL||'http://127.0.0.1:5174/';
const tides=JSON.parse(await readFile('public/data/tides.json','utf8'));
const weather=JSON.parse(await readFile('public/data/weather.json','utf8'));
const at=new Date().toISOString(),now=Date.parse(at),start=Math.floor(now/3_600_000)*3_600_000;
const strict=process.argv.includes('--require-complete');
const browser=await chromium.launch(process.env.WING_BROWSER_CHANNEL?{channel:process.env.WING_BROWSER_CHANNEL}:{});
const cases=[];
await mkdir('output/v2',{recursive:true});
const reportPath=process.argv.includes('--route-only')?'output/v2/routes.json':'output/v2/ui-results.json';
await writeFile(reportPath,JSON.stringify({passed:false,state:'running',at,strict}));
try{
  for(const [layout,width,height] of (process.argv.includes('--route-only')?[]:[['desktop',1280,1000],['mobile',375,1000]])){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.setFixedTime(new Date(at));
    await page.goto(new URL(layout==='kobo'?'kobo/':'',origin).href);
    for(const [spotId,record] of Object.entries(tides.spots)){
      await page.selectOption('#spot',spotId);
      await page.waitForFunction(name=>document.querySelector('.tide-station strong')?.textContent===name,record.station.site_name);
      await page.waitForFunction(()=>window.__WING_STATE__==='ready');
      await page.waitForFunction(()=>document.querySelector('.provider-attribution'));
      const model=parseWeather(weather.spots[spotId].payload);
      const expectedCurrent=model.current&&Math.abs(now-model.current.time)<3_600_000?model.current:model.rows.find(r=>r.time===start);
      assert.equal(await page.locator('.main-metric .metric-value').innerText(),`${Math.round(expectedCurrent.wind)}nd`);
      assert.equal(await page.locator('.metrics .metric').nth(1).locator('.metric-value').innerText(),`${Math.round(expectedCurrent.gust)}nd`);
      assert.equal(await page.locator('.compass g').getAttribute('transform'),`rotate(${expectedCurrent.direction} 60 60)`);
      assert.equal(await page.locator('.wind-chart,.hourly-table').count(),0);
      for(const windHours of [24,48,72]){
        await page.locator('.wind-range').getByRole('button',{name:`${windHours} h`,exact:true}).click();
        const days=navigationDays(model.rows,now,windHours),expectedRows=days.flatMap(d=>d.rows);
        const visibleTables=page.locator('.wind-table:visible');
        for(const table of await visibleTables.all()){
          assert.equal(await table.locator('tbody>tr').count(),5);
          assert.deepEqual(await table.locator('tbody>tr>th:first-child').allTextContents(),['Date','Heure','Vent (nd)','Rafales (nd)','Direction']);
        }
        const cells=page.locator('.wind-table:visible .hour-row td');
        assert.equal(await cells.count(),expectedRows.length);
        for(const [i,row] of expectedRows.entries()){
          assert.equal(Number(await cells.nth(i).getAttribute('data-time')),row.time);
          const local=parisParts(row.time);
          assert.ok(local.hour>=8&&local.hour<=20&&local.hour%2===0&&local.minute===0);
          assert.equal(await cells.nth(i).innerText(),`${String(local.hour).padStart(2,'0')}h`);
          assert.equal(await page.locator('.wind-table:visible .speed-row td').nth(i).innerText(),String(Math.round(row.wind)));
          assert.equal(await page.locator('.wind-table:visible .gust-row td').nth(i).innerText(),String(Math.round(row.gust)));
          assert.equal(await page.locator('.wind-table:visible .direction-row td svg path').nth(i).getAttribute('transform'),`rotate(${airflowBearing(row.direction)} 12 12)`);
        }
        const complete=days.every(d=>d.complete);
        assert.equal(await page.locator('.wind-panel').getAttribute('data-coverage'),complete?'ready':expectedRows.length?'partial':'unavailable');
        if(!complete)assert.ok(await page.locator('.wind-panel .coverage-note').count());
        if(strict)assert.ok(complete,`${spotId}/${windHours}: journées non couvertes par les données réelles`);
        for(const tideHours of [24,48]){
          await page.locator('.tide-range').getByRole('button',{name:`${tideHours} h`,exact:true}).click();
          assert.equal(await page.locator('.tides').getAttribute('data-status'),'ready');
          const events=record.extremes.filter(e=>Date.parse(e.time)>=start&&Date.parse(e.time)<=start+tideHours*3_600_000);
          assert.equal(await page.locator('.tide-extremum').count(),events.length);
          const curve=await page.locator('.tide-line').getAttribute('d');
          assert.equal((curve.match(/[ML]/g)||[]).length,tideHours*6+1);
          for(const [i,event] of events.entries()){
            const group=page.locator('.tide-extremum').nth(i),stamp=Date.parse(event.time);
            const time=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(stamp);
            assert.equal(await group.locator('.extremum-time').textContent(),time);
            const height=event.height.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
            assert.equal(await group.locator('.extremum-height').textContent(),`${event.type} · ${height} m`);
            if(event.coefficient!=null)assert.equal(await group.locator('.extremum-coef').textContent(),`Coef. ${event.coefficient}`);
            else assert.equal(await group.locator('.extremum-coef').count(),0);
          }
          assert.ok((await page.locator('.legal-footer').innerText()).includes('Ifremer / PREVIMER'));
          assert.ok((await page.locator('.legal-footer').innerText()).includes('non officiels'));
          const bounds=await page.locator('.page-shell').boundingBox();
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${layout}: débordement horizontal`);
          const selector=await page.locator('#spot').boundingBox();assert.ok(selector.x>=0&&selector.x+selector.width<=width);
          if(layout==='kobo')assert.ok(bounds.y+bounds.height<=800,`Kobo/${windHours}/${tideHours}: bas à ${bounds.y+bounds.height}`);
          if(tideHours===48)await page.screenshot({path:`output/v2/${layout}-${spotId}-${windHours}h.png`,fullPage:layout!=='kobo'});
          cases.push({layout,spotId,windHours,tideHours,columns:expectedRows.length,windCoverage:complete?'complete':'partial',extrema:events.length,height:bounds.height});
        }
      }
    }
    await page.clock.setFixedTime(new Date(Date.parse(tides.to)+3_600_000));await page.reload();
    await page.waitForFunction(()=>document.querySelector('.tides')?.dataset.status==='expired');
    assert.equal(errors.length,0,errors.join('\n'));
    await page.close();
  }
  const page=await browser.newPage();
  await page.clock.setFixedTime(new Date(at));
  const response=await page.goto(new URL('kobo/?spot=la-baule',origin).href);
  assert.equal(response.status(),200);await page.waitForFunction(()=>window.__KOBO_LITE_STATE__==='ready');
  assert.equal(await page.locator('.lite-tide-title>span').textContent(),'Le Pouliguen');await page.close();
  const report={passed:true,at,completedAt:new Date().toISOString(),strict,origin,caseCount:cases.length,cases,directRoute:true};
  await writeFile(reportPath,JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,cases:cases.length,completeWindCases:cases.filter(c=>c.windCoverage==='complete').length,partialWindCases:cases.filter(c=>c.windCoverage==='partial').length,directRoute:true}));
}catch(e){await writeFile(reportPath,JSON.stringify({passed:false,at,error:e.message,cases},null,2));throw e;}
finally{await browser.close();}

