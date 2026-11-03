import {mkdir,writeFile} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {spots} from '../src/spots.js';
import {FORECAST_HOURS,weatherURL,parseWeather,isValue} from '../src/weather.js';

const results={schema_version:1,source:'https://api.open-meteo.com/v1/forecast',collected_at:new Date().toISOString(),spots:{}};
for(const spot of spots){
  const result={spot:spot.name,request_url:weatherURL(spot)};
  try{
    result.dns=(await lookup('api.open-meteo.com')).address;
    const response=await fetch(result.request_url,{signal:AbortSignal.timeout(25000),credentials:'omit'});
    result.http=response.status;
    result.cors=response.headers.get('access-control-allow-origin');
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    const fetchedAt=Date.now();
    const data=parseWeather(payload,fetchedAt);
    if(data.rows.length!==FORECAST_HOURS||data.rows.some((r,i)=>![r.wind,r.gust,r.direction].every(isValue)||(i&&r.time-data.rows[i-1].time!==3_600_000)))throw new Error('Prévisions horaires incomplètes ou discontinues.');
    if(!data.current||![data.current.wind,data.current.gust,data.current.direction].every(isValue))throw new Error('Conditions actuelles incomplètes.');
    Object.assign(result,{status:'ok',fetched_at:new Date(fetchedAt).toISOString(),hourly_count:data.rows.length,
      from:new Date(data.rows[0].time).toISOString(),last_hour:new Date(data.rows.at(-1).time).toISOString(),
      current:{time:new Date(data.current.time).toISOString(),wind_kn:data.current.wind,gust_kn:data.current.gust,direction_deg:data.current.direction},payload});
    console.log(`${spot.name} : HTTP ${response.status}, ${FORECAST_HOURS} heures continues, vent ${data.current.wind} nd, rafales ${data.current.gust} nd, direction ${data.current.direction}°.`);
  }catch(e){
    Object.assign(result,{status:'error',error:e.message,network_code:e.cause?.code||null,syscall:e.cause?.syscall||null});
    console.log(`${spot.name} : échec — ${result.network_code||result.error}.`);
  }
  results.spots[spot.id]=result;
}
await mkdir('output/weather-diagnostic',{recursive:true});
await writeFile('output/weather-diagnostic/report.json',JSON.stringify(results,null,2)+'\n');
console.log('Rapport météo enregistré localement, sans clé ni publication.');
if(Object.values(results.spots).some(s=>s.status!=='ok'))process.exitCode=1;
