import {isValue} from './weather.js';

const partsFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export const navigationHours=[8,10,12,14,16,18,20];
export function parisParts(time){
  const parts=Object.fromEntries(partsFormatter.formatToParts(time).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour),minute:Number(parts.minute)};
}
export function addCalendarDays(key,offset){
  const [y,m,d]=key.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+offset,12)).toISOString().slice(0,10);
}
export function dayLabel(key){
  const [y,m,d]=key.split('-').map(Number);
  const label=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'short',day:'2-digit',month:'2-digit'}).format(Date.UTC(y,m-1,d,12));
  return label.charAt(0).toUpperCase()+label.slice(1);
}
export function navigationDays(rows,now,hours){
  if(![24,48,72].includes(hours))throw new Error('Mode de navigation invalide.');
  const local=parisParts(now);
  const first=addCalendarDays(local.date,local.hour>=20?1:0);
  const days=Array.from({length:hours/24},(_,i)=>({date:addCalendarDays(first,i),rows:[]}));
  const byDate=new Map(days.map(d=>[d.date,d]));
  for(const row of rows){
    const p=parisParts(row.time),day=byDate.get(p.date);
    if(day&&p.minute===0&&navigationHours.includes(p.hour)&&[row.wind,row.gust,row.direction].some(isValue))day.rows.push({...row,hour:p.hour});
  }
  return days.map(day=>{
    const sorted=day.rows.sort((a,b)=>a.time-b.time);
    const unique=sorted.filter((r,i)=>!i||r.hour!==sorted[i-1].hour);
    const missingHours=navigationHours.filter(hour=>!unique.some(r=>r.hour===hour));
    return {...day,label:dayLabel(day.date),rows:unique,missingHours,complete:missingHours.length===0};
  });
}
// Open-Meteo bearings describe where wind comes from. Table arrows show airflow.
export const airflowBearing=from=>isValue(from)?(from+180)%360:null;
