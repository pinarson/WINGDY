// Run after npm run build. No collection, credentials, or deployment here.
import {preview} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {spots} from '../src/spots.js';

function runExport(spot,url){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/export-kobo.mjs',spot,url],{stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`Export ${spot} échoué.`)));
  });
}

// Refuse stale snapshots before starting the renderer. The page also checks
// full forecast/tide coverage and layout; its ready state is mandatory.
const now=Date.now();
const weather=JSON.parse(await readFile('dist/data/weather.json','utf8'));
const tides=JSON.parse(await readFile('dist/data/tides.json','utf8'));
for(const stamp of [tides.fetched_at,...spots.map(s=>weather.spots?.[s.id]?.fetched_at)]){
  const age=now-Date.parse(stamp);
  if(!Number.isFinite(age)||age < -60_000||age>7*3_600_000)
    throw new Error('Données absentes ou âgées de plus de sept heures : aucun lot PNG préparé.');
}

const server=await preview({configFile:false,base:'./',preview:{host:'127.0.0.1',port:4175,strictPort:true}});
const files=[];
try{
  for(const spot of spots){
    await runExport(spot.id,'http://127.0.0.1:4175/kobo/');
    const bytes=await readFile(`output/kobo-lite/${spot.id}.png`);
    const png=PNG.sync.read(bytes,{checkCRC:true});
    if(png.width!==600||png.height!==800||bytes[24]!==8||bytes[25]!==0||bytes[28]!==0)
      throw new Error(`PNG ${spot.id} incompatible : dimensions, gris 8 bits ou entrelacement.`);
    for(let i=0;i<png.data.length;i+=4){
      if(png.data[i]!==png.data[i+1]||png.data[i]!==png.data[i+2]||png.data[i]%17||png.data[i+3]!==255)
        throw new Error(`PNG ${spot.id} : palette ou transparence incompatible.`);
    }
    const meta=JSON.parse(await readFile(`output/meteo-wingfoil-${spot.id}.json`,'utf8'));
    files.push({spot:spot.id,file:`${spot.id}.png`,width:600,height:800,bytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),...meta});
  }
  // Only stage a complete set. The workflow never uploads Pages on failure.
  await mkdir('dist/kobo/png',{recursive:true});
  for(const file of files){
    await copyFile(`output/kobo-lite/${file.spot}.png`,`dist/kobo/png/${file.file}`);
    await writeFile(`dist/kobo/png/${file.spot}.sha256`,`${file.sha256}  ${file.file}\n`);
  }
  await writeFile('dist/kobo/png/manifest.json',JSON.stringify({schema_version:1,generatedAt:new Date().toISOString(),images:files},null,2)+'\n');
  console.log('Trois PNG Kobo Lite prêts dans dist/kobo/png/. Aucune publication.');
}finally{
  await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
}
