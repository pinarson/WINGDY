import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spots} from '../src/spots.js';
const spot=process.argv[2]||'tharon';
if(!spots.some(s=>s.id===spot))throw new Error('Spot inconnu');
const target=new URL(process.argv[3]||'http://127.0.0.1:5173/kobo/');
if(!['http:','https:'].includes(target.protocol))throw new Error('URL HTTP(S) requise');
target.searchParams.set('spot',spot);
const channel=process.env.WING_BROWSER_CHANNEL||'chrome';
const browser=await chromium.launch(channel==='chromium'?{}:{channel});
try{
 const page=await browser.newPage({viewport:{width:600,height:800},deviceScaleFactor:1,colorScheme:'light'});
 await page.goto(target.href);
 await page.waitForFunction(()=>['ready','partial','error'].includes(window.__KOBO_LITE_STATE__),{timeout:35000});
 const state=await page.evaluate(()=>window.__KOBO_LITE_STATE__);
 if(state!=='ready')throw new Error(`Donnees incompletes (${state}) : aucun PNG cree.`);
 await page.evaluate(()=>document.fonts.ready);
 const bounds=await page.locator('.kobo-lite-sheet').evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight,overflow:el.scrollHeight>el.clientHeight,footer:el.querySelector('footer').getBoundingClientRect().bottom}));
 if(bounds.w!==600||bounds.h!==800||bounds.overflow||bounds.footer>800)throw new Error('Contenu hors cadre');
 if(await page.locator('button,select,input').count())throw new Error('Controle interactif inattendu');
 const shot=PNG.sync.read(await page.locator('.kobo-lite-sheet').screenshot());
 if(shot.width!==600||shot.height!==800)throw new Error('Dimensions incorrectes');
 for(let i=0;i<shot.data.length;i+=4){const g=Math.round((.2126*shot.data[i]+.7152*shot.data[i+1]+.0722*shot.data[i+2])/17)*17;shot.data[i]=shot.data[i+1]=shot.data[i+2]=g;shot.data[i+3]=255;}
 const bytes=PNG.sync.write(shot,{colorType:0,inputColorType:6,bitDepth:8});
 await mkdir('output/kobo-lite',{recursive:true});
 const path=resolve(`output/meteo-wingfoil-${spot}.png`);
 await writeFile(path,bytes);
 await writeFile(`output/kobo-lite/${spot}.png`,bytes);
 const meta=await page.evaluate(()=>window.__KOBO_LITE_META__);
 await writeFile(path.replace(/\.png$/,'.json'),JSON.stringify({layout:'kobo-lite',exportedAt:new Date().toISOString(),...meta},null,2));
 console.log(path);
}finally{await browser.close();}
