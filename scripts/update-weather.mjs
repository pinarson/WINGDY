import {readFile,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {spots} from '../src/spots.js';
import {FORECAST_HOURS,weatherURL,parseWeather,isValue} from '../src/weather.js';

export function validateForecast(payload,expectedHours=FORECAST_HOURS){
  const data=parseWeather(payload);
  if(data.rows.length!==expectedHours||data.rows.some((r,i)=>![r.wind,r.gust,r.direction].every(isValue)||(i&&r.time-data.rows[i-1].time!==3_600_000))||!data.current||![data.current.wind,data.current.gust,data.current.direction].every(isValue))throw new Error('Prévisions réelles incomplètes.');
  return data;
}
function publicRecord(spot,payload,fetchedAt){
  if(!Number.isFinite(Date.parse(fetchedAt))||Date.parse(fetchedAt)>Date.now()+60_000)throw new Error('Date de récupération invalide.');
  const safe={};
  for(const key of ['latitude','longitude','elevation','timezone','timezone_abbreviation','utc_offset_seconds','current_units','current','hourly_units','hourly'])safe[key]=payload[key];
  return {latitude:spot.lat,longitude:spot.lon,fetched_at:fetchedAt,payload:safe};
}
export async function createWeatherBundle(reportPath){
  const bundle={schema_version:1,source:'https://api.open-meteo.com/v1/forecast',spots:{}};
  const report=reportPath?JSON.parse(await readFile(reportPath,'utf8')):null;
  if(report&&report.source!==bundle.source)throw new Error('Source du rapport météo invalide.');
  for(const spot of spots){
    let payload,fetchedAt;
    if(report){
      const record=report.spots?.[spot.id];
      if(record?.status!=='ok'||record.http!==200||record.request_url!==weatherURL(spot))throw new Error('Rapport météo incomplet ou mauvais spot.');
      validateForecast(record.payload);payload=record.payload;fetchedAt=record.fetched_at;
    }else{
      // Three complete Paris navigation days after 20h + six-hour refresh margin.
      const url=new URL(weatherURL(spot));
      const response=await fetch(url,{signal:AbortSignal.timeout(25000),credentials:'omit'});
      if(!response.ok)throw new Error('Open-Meteo HTTP '+response.status);
      payload=await response.json();validateForecast(payload);fetchedAt=new Date().toISOString();
    }
    bundle.spots[spot.id]=publicRecord(spot,payload,fetchedAt);
  }
  return bundle;
}
export async function main(){
  const args=process.argv.slice(2),index=args.indexOf('--from-report');
  if(index>=0&&!args[index+1])throw new Error('Chemin du rapport requis.');
  const bundle=await createWeatherBundle(index>=0?args[index+1]:null);
  await mkdir('public/data',{recursive:true});
  const temporary=`public/data/weather-${process.pid}.tmp`;
  try{await writeFile(temporary,JSON.stringify(bundle)+'\n');await rename(temporary,'public/data/weather.json');}
  finally{await unlink(temporary).catch(()=>{});}
  console.log('JSON météo réel validé pour les trois spots. Aucune publication.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{
  const code=error.cause?.code||error.code;
  const networkCode=['EACCES','ENOTFOUND','ETIMEDOUT','ECONNRESET','ECONNREFUSED','UND_ERR_CONNECT_TIMEOUT'].includes(code)?` (réseau : ${code})`:'';
  console.error(`Actualisation météo échouée${networkCode} ; ancien JSON conservé.`);process.exitCode=1;
});
