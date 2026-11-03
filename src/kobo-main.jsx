import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {getSpot} from './spots.js';
import {fetchWeather,isValue,cardinal,formatTime} from './weather.js';
import {fetchTides,tideWindow} from './tides.js';
import {liteNavigationDay,liteConditions,provenanceBearing} from './kobo-lite-model.js';
import './kobo-lite.css';

const location=new URL(window.location.href);
const spot=getSpot(location.searchParams.get('spot'));
const base=location.pathname.replace(/kobo\/(?:index\.html)?$/,'');
const integer=value=>isValue(value)?String(Math.round(value)):'—';
function OriginArrow({value,className=''}){
  return isValue(value)?<svg className={`lite-arrow ${className}`} viewBox="0 0 48 48" role="img" aria-label={`Vent venant de ${cardinal(value)}`}>
    <path transform={`rotate(${provenanceBearing(value)} 24 24)`} d="M24 3 9 27 20 23 20 45 28 45 28 23 39 27Z" fill="currentColor"/>
  </svg>:<span>—</span>;
}
function LiteTide({period,station}){
  const {points,extremes,start,end}=period;
  const heights=[...points,...extremes].map(p=>p.height);
  const low=Math.min(...heights),high=Math.max(...heights),span=Math.max(0.2,high-low);
  const x=time=>24+(time-start)/(end-start)*508;
  const y=value=>130-(value-low)/span*80;
  const path=points.map((p,i)=>`${i?'L':'M'}${x(p.time).toFixed(2)},${y(p.height).toFixed(2)}`).join(' ');
  return <section className="lite-tides"><div className="lite-tide-title"><h2>Marées · 24 h</h2><span>{station}</span></div>
    <svg viewBox="0 0 556 192" className="lite-tide-curve" role="img" aria-label="Marées réelles sur 24 heures, horaires de pleine et basse mer en heure de Paris">
      <path className="lite-tide-line" d={path}/>
      {extremes.map(event=>{
        const px=x(event.time),py=y(event.height),pm=event.type==='PM';
        const anchor=px<65?'start':px>490?'end':'middle';
        return <g className="lite-extremum" data-time={event.time} data-type={event.type} key={event.time}>
          <circle cx={px} cy={py} r="4.5" fill={pm?'black':'white'} stroke="black" strokeWidth="2.5"/>
          <text className="lite-extremum-time" x={px} y={py+(pm?-31:25)} textAnchor={anchor}>{event.type} {formatTime(event.time)}</text>
          {event.coefficient!=null&&<text className="lite-coefficient" x={px} y={py-10} textAnchor={anchor}>Coef. {event.coefficient}</text>}
        </g>;
      })}
      <text className="lite-interval" x="0" y="180">{formatTime(start,true)}</text><text className="lite-interval" x="556" y="180" textAnchor="end">{formatTime(end,true)} · Paris</text>
    </svg>
  </section>;
}
function App(){
  const [state,setState]=useState({status:'loading'});
  const [now]=useState(Date.now());
  useEffect(()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    let active=true;
    Promise.all([fetchWeather(spot,controller.signal,base),fetchTides(spot.id,base,controller.signal)]).then(([weather,tides])=>{
      if(active)setState({status:'loaded',weather,tides});
    }).catch(()=>{if(active)setState({status:'error'});}).finally(()=>clearTimeout(timeout));
    return ()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[]);
  const {weather,tides}=state;
  const day=weather?liteNavigationDay(weather.rows,now):null;
  const current=weather?liteConditions(weather,now):null;
  const period=tides?tideWindow(tides,Math.floor(now/3_600_000)*3_600_000,24):null;
  const ready=Boolean(day?.complete&&current&&[current.wind,current.gust,current.direction].every(isValue)&&period?.status==='ready');
  useEffect(()=>{
    window.__KOBO_LITE_STATE__=state.status==='loaded'?(ready?'ready':'partial'):state.status;
    if(weather&&tides)window.__KOBO_LITE_META__={spot:spot.id,day:day.date,weatherFetchedAt:new Date(weather.fetchedAt).toISOString(),tidesFetchedAt:new Date(tides.fetchedAt).toISOString(),times:day.slots.map(s=>s.row?.time??null),tideStart:period.start,tideEnd:period.end,provenanceArrows:true};
  },[state,ready]);
  const weatherTime=weather?formatTime(weather.fetchedAt,true):null,tideTime=tides?formatTime(tides.fetchedAt,true):null;
  return <main className="kobo-lite-sheet" data-spot={spot.id}>
    <header className="lite-header"><p className="lite-brand">WING DASHBOARD</p><h1>{spot.name}</h1><p className="lite-updated">{weatherTime?(weatherTime===tideTime?`Mis à jour le ${weatherTime} · Paris`:`Météo ${weatherTime} · Marées ${tideTime} · Paris`):'Chargement…'}</p></header>
    {state.status==='error'?<p className="lite-error">Données indisponibles. Aucun PNG de remplacement.</p>:<>
      <section className="lite-conditions" aria-label="Conditions de vent">
        <div className="lite-metric"><h2>Vent moyen</h2><p className="lite-number">{integer(current?.wind)}<span>nd</span></p></div>
        <div className="lite-metric"><h2>Rafales</h2><p className="lite-number">{integer(current?.gust)}<span>nd</span></p></div>
        <div className="lite-metric lite-direction"><h2>Direction</h2><strong>{cardinal(current?.direction)}</strong><OriginArrow value={current?.direction}/></div>
      </section>
      <section className="lite-forecast"><h2>Vent · {day?.label||'—'}</h2><table className="lite-wind-table"><tbody>
        <tr><th scope="row">Heure</th>{(day?.slots||[10,12,14,16,18].map(hour=>({hour}))).map(s=><td key={s.hour}>{s.hour}h</td>)}</tr>
        <tr className="lite-wind-values"><th scope="row">Vent</th>{day?.slots.map(s=><td data-time={s.row?.time} key={s.hour}>{integer(s.row?.wind)}</td>)}</tr>
        <tr className="lite-gust-values"><th scope="row">Rafales</th>{day?.slots.map(s=><td key={s.hour}>{integer(s.row?.gust)}</td>)}</tr>
        <tr className="lite-direction-values"><th scope="row">Direction</th>{day?.slots.map(s=><td key={s.hour}><OriginArrow value={s.row?.direction}/></td>)}</tr>
      </tbody></table>{day&&!day.complete&&<p className="lite-incomplete">Prévisions partielles : les valeurs absentes restent indiquées par « — ».</p>}</section>
      {period&&['ready','partial'].includes(period.status)?<LiteTide period={period} station={tides.station.site_name}/>:<section className="lite-tides"><h2>Marées · 24 h</h2><p>Données de marées indisponibles</p></section>}
    </>}
    <footer className="lite-footer">
      <p><a href="https://open-meteo.com/">open-meteo.com</a> · <a href="https://api-maree.fr/">api-maree.fr</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · Valeurs arrondies.</p>
      {tides?.attributions.map(text=><p className="lite-attribution" key={text}>{text}</p>)}
      {tides?.status_notices.map(text=><p className="lite-status-notice" key={text}>{text}</p>)}
    </footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);

