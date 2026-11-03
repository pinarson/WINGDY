import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parseTides,tideWindow} from '../src/tides.js';
import {parseWeatherBundle,isValue} from '../src/weather.js';
import {spots} from '../src/spots.js';

const now=Date.now(), start=Math.floor(now/3_600_000)*3_600_000;
const tides=JSON.parse(await readFile('public/data/tides.json','utf8'));
const weather=JSON.parse(await readFile('public/data/weather.json','utf8'));
const report={checked_at:new Date(now).toISOString(),required_hours:48,required_tide_days:7,spots:[]};
for(const spot of spots){
  const item={spot:spot.id,passed:false};
  try{
    const tide=parseTides(tides,spot.id),period=tideWindow(tide,start,48);
    Object.assign(item,{station:tide.station.site_name,tide_points:tide.points.length,tide_from:new Date(tide.from).toISOString(),tide_to:new Date(tide.to).toISOString(),tide_window:period.status,tide_extrema_48h:period.extremes.length,
      tide_seven_days:tide.to-tide.from===7*86_400_000});
    const wind=parseWeatherBundle(weather,spot);
    const future=wind.rows.filter(r=>r.time>=start).slice(0,48);
    const continuous=future.length===48&&future.every((r,i)=>[r.wind,r.gust,r.direction].every(isValue)&&(!i||r.time-future[i-1].time===3_600_000));
    const current=wind.current&&Math.abs(now-wind.current.time)<3_600_000?wind.current:wind.rows.find(r=>r.time===start);
    Object.assign(item,{weather_transport:'same_origin_json',weather_fetched_at:new Date(wind.fetchedAt).toISOString(),wind_hours:future.length,wind_total_hours:wind.rows.length,wind_continuous:continuous,current});
    item.passed=item.tide_seven_days&&period.status==='ready'&&continuous&&Boolean(current);
  }catch(e){item.error=e.message;}
  report.spots.push(item);
}
report.passed=report.spots.every(s=>s.passed);
await mkdir('output/final-validation',{recursive:true});
await writeFile('output/final-validation/data.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
