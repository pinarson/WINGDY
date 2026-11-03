import {preview} from 'vite';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('test/references/kobo-lite/manifest.json','utf8'));
const tides=JSON.parse(await readFile('public/data/tides.json','utf8'));
const server=await preview({configFile:false,preview:{host:'127.0.0.1',port:4186,strictPort:true}});
let browser;
try{
 browser=await chromium.launch({channel:'chrome'});
 await mkdir('output/kobo-lite',{recursive:true});
 const results=[];
 for(const spot of ['tharon','la-baule','suscinio']){
  const source='test/references/kobo-lite/';
  const meta={tideStart:manifest[spot].time};
  const page=await browser.newPage({viewport:{width:600,height:800},deviceScaleFactor:1,colorScheme:'light'});
  await page.clock.setFixedTime(meta.tideStart);
  await page.goto(`http://127.0.0.1:4186/kobo/?spot=${spot}`);
  await page.waitForFunction(()=>['ready','partial','error'].includes(window.__KOBO_LITE_STATE__));
  assert.equal(await page.evaluate(()=>window.__KOBO_LITE_STATE__),'ready');
  await page.evaluate(()=>document.fonts.ready);
  const footerText=await page.locator('footer').innerText();
  for(const notice of ['open-meteo.com','api-maree.fr','CC BY 4.0','Valeurs arrondies.',...tides.spots[spot].attributions,...tides.spots[spot].status_notices])assert.ok(footerText.includes(notice),`Missing notice ${spot}`);
  const layout=await page.evaluate(()=>{const root=document.querySelector('main'),f=document.querySelector('footer').getBoundingClientRect();const overflow=[];for(const el of root.querySelectorAll('*'))for(const n of el.childNodes)if(n.nodeType===3&&n.textContent.trim()){const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.left<0||b.right>600||b.top<0||b.bottom>800)overflow.push(n.textContent);}return {footerTop:f.top,footerBottom:f.bottom,overflow,scrollHeight:root.scrollHeight};});
  assert.ok(layout.footerTop>=0&&layout.footerBottom<=800);assert.equal(layout.scrollHeight,800);assert.deepEqual(layout.overflow,[]);
  const shot=PNG.sync.read(await page.locator('.kobo-lite-sheet').screenshot());
  assert.equal(shot.width,600);assert.equal(shot.height,800);
  for(let i=0;i<shot.data.length;i+=4){const g=Math.round((.2126*shot.data[i]+.7152*shot.data[i+1]+.0722*shot.data[i+2])/17)*17;shot.data[i]=shot.data[i+1]=shot.data[i+2]=g;shot.data[i+3]=255;}
  const bytes=PNG.sync.write(shot,{colorType:0,inputColorType:6,bitDepth:8});
  await writeFile(`output/kobo-lite/${spot}.png`,bytes);
  const reference=await readFile(`${source}${spot}.png`);
  const refPng=PNG.sync.read(reference,{checkCRC:true}); const identical=shot.data.equals(refPng.data);
  assert.equal(refPng.width,600);assert.equal(refPng.height,800);assert.equal(bytes[24],8);assert.equal(bytes[25],0);assert.equal(bytes[28],0);assert.ok(identical,`Pixel mismatch ${spot}`);
  const item={layout,spot,width:600,height:800,identical,sha256:createHash('sha256').update(bytes).digest('hex')};
  results.push(item);console.log(JSON.stringify(item));await page.close();
 }
 await writeFile('output/kobo-lite/comparison.json',JSON.stringify(results,null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.httpServer.close(r));}

