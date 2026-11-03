import React,{useEffect,useState} from 'react';
import {fetchTides,tideWindow,tideTime} from './tides.js';
import {formatTime} from './weather.js';

export const tideHeight=n=>n.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
function TideChart({period}){
  const {points,extremes,start,end}=period;
  const values=[...points,...extremes].map(p=>p.height);
  const min=Math.min(0,Math.floor(Math.min(...values))),max=Math.max(1,Math.ceil(Math.max(...values)));
  const x=time=>54+(time-start)/(end-start)*916,y=value=>240-(value-min)/(max-min)*140;
  const path=points.map((point,i)=>`${i?'L':'M'}${x(point.time).toFixed(2)},${y(point.height).toFixed(2)}`).join(' ');
  const ticks=(end-start)/3_600_000===48?8:4;
  return <svg className="tide-chart" viewBox="0 0 1000 380" preserveAspectRatio="none" role="img" aria-label="Courbe des hauteurs de marée, horaires PM/BM et coefficients estimés sur les extrema">
    {[0,1,2,3].map(i=>{const value=min+(max-min)*i/3;return <g key={i}><line x1="54" x2="970" y1={y(value)} y2={y(value)} className="grid-line"/><text className="axis-number" x="35" y={y(value)+6} textAnchor="end">{Number(value.toFixed(1)).toLocaleString('fr-FR')}</text></g>;})}
    <path className="tide-line" d={path}/>
    {extremes.map(event=>{
      const px=x(event.time),py=y(event.height),anchor=px<90?'start':px>930?'end':'middle',pm=event.type==='PM';
      return <g className="tide-extremum" data-time={event.time} data-type={event.type} key={event.time}>
        <circle cx={px} cy={py} r="5" fill={pm?'currentColor':'white'} stroke="currentColor" strokeWidth="2"/>
        <text className="extremum-time" x={px} y={py+(pm?-57:24)} textAnchor={anchor}>{formatTime(event.time)}</text>
        <text className="extremum-height" x={px} y={py+(pm?-35:46)} textAnchor={anchor}>{event.type} · {tideHeight(event.height)} m</text>
        {event.coefficient!=null&&<text className="extremum-coef" x={px} y={py-13} textAnchor={anchor}>Coef. {event.coefficient}</text>}
        <title>{event.type} {tideTime(event.time,true)} · {tideHeight(event.height)} m{event.coefficient!=null?` · Coef. ${event.coefficient} estimé`:''}</title>
      </g>;
    })}
    <line x1="54" x2="970" y1="330" y2="330" className="axis-line"/>
    {Array.from({length:ticks+1},(_,i)=>{const time=start+(end-start)*i/ticks;return <g key={i}><line x1={x(time)} x2={x(time)} y1="330" y2="338" className="axis-line"/><text className="axis-hour" x={x(time)} y="353" textAnchor="middle">{formatTime(time)}</text><text className="axis-date" x={x(time)} y="375" textAnchor="middle">{new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit'}).format(time)}</text></g>;})}
  </svg>;
}
export default function TidePanel({spotId,hours,onHoursChange,start,basePath,revision,onData}){
  const [state,setState]=useState({status:'loading',data:null,spotId});
  useEffect(()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    let active=true;setState({status:'loading',data:null,spotId});
    fetchTides(spotId,basePath,controller.signal).then(data=>{if(active)setState({status:'ready',data,spotId});}).catch(()=>{if(active)setState({status:'error',data:null,spotId});}).finally(()=>clearTimeout(timeout));
    return ()=>{active=false;controller.abort();clearTimeout(timeout);};
  },[spotId,basePath,revision]);
  const data=state.spotId===spotId?state.data:null;
  const period=data?tideWindow(data,start,hours):null;
  const usable=period&&['ready','partial'].includes(period.status);
  const status=period?.status||(state.spotId===spotId?state.status:'loading');
  useEffect(()=>{window.__WING_TIDE_STATE__=status;},[status]);
  useEffect(()=>{onData?.(data);},[data,onData]);
  return <section className="tides panel" data-status={status} aria-label="Prévisions de marées">
    <div className="section-title"><h2>Marées <span>(hauteur d’eau en m)</span></h2><div className="range-control tide-range" aria-label="Durée des marées">{[24,48].map(value=><button type="button" key={value} aria-pressed={hours===value} onClick={()=>onHoursChange(value)}>{value} h</button>)}</div></div>
    {data&&<p className="tide-station">Référence : <strong>{data.station.site_name}</strong> · heure de Paris</p>}
    {usable?<><TideChart period={period}/>{status==='partial'&&<p className="coverage-note">Marées partiellement couvertes, jusqu’au {formatTime(data.points.at(-1).time,true)}.</p>}</>:<div className="empty-state">{status==='loading'?'Chargement des marées…':'Données de marées indisponibles'}{status==='expired'&&' · période expirée'}</div>}
    {usable&&<div className="sr-only"><table className="tide-accessible"><caption>Horaires des marées en Europe/Paris</caption><thead><tr><th>Type</th><th>Heure</th><th>Hauteur</th><th>Coefficient estimé</th></tr></thead><tbody>{period.extremes.map(event=><tr key={event.time}><td>{event.type}</td><td>{tideTime(event.time,true)}</td><td>{tideHeight(event.height)} m</td><td>{event.coefficient??'—'}</td></tr>)}</tbody></table></div>}
  </section>;
}
