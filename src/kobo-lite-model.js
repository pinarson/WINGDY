import {parisParts,addCalendarDays,dayLabel} from './navigation.js';
import {isValue} from './weather.js';

export const liteHours=[10,12,14,16,18];
export function liteNavigationDay(rows,now){
  const local=parisParts(now);
  const date=addCalendarDays(local.date,local.hour>=18?1:0);
  const slots=liteHours.map(hour=>{
    const row=rows.find(row=>{const p=parisParts(row.time);return p.date===date&&p.hour===hour&&p.minute===0;});
    return {hour,row:row||null};
  });
  return {date,label:dayLabel(date),slots,complete:slots.every(({row})=>row&&[row.wind,row.gust,row.direction].every(isValue))};
}
export function liteConditions(weather,now){
  return weather.current&&Math.abs(now-weather.current.time)<3_600_000?weather.current:weather.rows.find(row=>row.time===Math.floor(now/3_600_000)*3_600_000)||null;
}
// SVG arrows point north before rotation. A meteorological bearing is its origin.
export const provenanceBearing=value=>isValue(value)?((value%360)+360)%360:null;
