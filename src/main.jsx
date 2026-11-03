import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {spots,getSpot} from './spots.js';
import {fetchWeather,cardinal,isValue,formatTime} from './weather.js';
import {navigationDays} from './navigation.js';
import WindTable,{rounded} from './WindTable.jsx';
import TidePanel from './TidePanel.jsx';
import './style.css';

const initial=new URL(window.location.href);
const isKobo=/\/kobo\/?$/.test(initial.pathname)||initial.hash.startsWith('#/kobo');
const basePath=initial.pathname.replace(/kobo\/?$/,'').replace(/index\.html$/,'').replace(/\/?$/,'/');
function Mark(){return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 29 20 7 36 29 20 23Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M20 8V34M10 34h20" fill="none" stroke="currentColor" strokeWidth="2"/></svg>;}
function Compass({direction}){return <svg className="compass" viewBox="0 0 120 120" role="img" aria-label={isValue(direction)?`Vent venant de ${cardinal(direction)}, ${rounded(direction)} degrés`:'Direction indisponible'}>
  <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor"/><path d="M60 14v8M60 98v8M14 60h8M98 60h8" stroke="currentColor"/>
  <text x="60" y="10" textAnchor="middle">N</text><text x="60" y="119" textAnchor="middle">S</text><text x="5" y="64" textAnchor="middle">O</text><text x="115" y="64" textAnchor="middle">E</text>
  {isValue(direction)&&<g transform={`rotate(${direction} 60 60)`}><path d="M60 26 48 68 60 61 72 68Z" fill="currentColor"/><path d="M60 61v27" stroke="currentColor" strokeWidth="2"/></g>}<circle cx="60" cy="60" r="3" fill="currentColor"/>
</svg>;}
function LegalFooter({weather,tides}){
  const newest=Math.max(weather?.fetchedAt||0,tides?.fetchedAt||0);
  return <footer className="legal-footer">
    <div className="footer-line"><strong>WING DASHBOARD <span>/ v0.2</span></strong><span>{newest?`Mis à jour le ${formatTime(newest,true)} · Paris`:'Aucune donnée récupérée'}</span></div>
    <p className="source-links">Météo : <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Marées : <a href="https://api-maree.fr/" target="_blank" rel="noreferrer">api-maree.fr</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · Prévisions à 10 m, valeurs arrondies, heures Europe/Paris.</p>
    {tides?.attributions.map(text=><p className="provider-attribution" key={text}>{text}</p>)}
    {tides&&<p className="provider-links"><a href="https://sextant.ifremer.fr/" target="_blank" rel="noreferrer">Ifremer / PREVIMER</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · {tides.datum}</p>}
    {tides?.status_notices.map(text=><p className="provider-notice" key={text}>{text}</p>)}
    {weather&&tides&&formatTime(weather.fetchedAt,true)!==formatTime(tides.fetchedAt,true)&&<p className="retrieval-dates">Récupération météo : {formatTime(weather.fetchedAt,true)} · marées : {formatTime(tides.fetchedAt,true)} · Paris.</p>}
  </footer>;
}
function App(){
  const [spotId,setSpotId]=useState(getSpot(initial.searchParams.get('spot')).id);
  const [windHours,setWindHours]=useState(24);
  const [tideHours,setTideHours]=useState(48);
  const [data,setData]=useState(null),[tides,setTides]=useState(null);
  const [status,setStatus]=useState('loading'),[error,setError]=useState('');
  const [revision,setRevision]=useState(0),[clock,setClock]=useState(Date.now());
  const spot=getSpot(spotId);
  useEffect(()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    let active=true;setData(null);setStatus('loading');setError('');
    fetchWeather(spot,controller.signal,basePath).then(value=>{if(active){setData(value);setStatus('ready');}}).catch(e=>{if(active){setError(e.name==='AbortError'?'Le chargement a expiré.':e instanceof TypeError?'Service météo inaccessible.':e.message);setStatus('error');}}).finally(()=>clearTimeout(timeout));
    return ()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[spotId,revision]);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return ()=>clearInterval(timer);},[]);
  useEffect(()=>{const url=new URL(window.location.href);url.searchParams.set('spot',spotId);window.history.replaceState(null,'',url);},[spotId]);
  useEffect(()=>{window.__WING_READY__=status==='ready';window.__WING_STATE__=status;},[status]);
  const current=data?.current&&Math.abs(clock-data.current.time)<3_600_000?data.current:data?.rows.find(r=>r.time===Math.floor(clock/3_600_000)*3_600_000);
  const days=navigationDays(data?.rows||[],clock,windHours);
  const windCoverage=days.every(day=>day.complete)?'ready':days.some(day=>day.rows.length)?'partial':'unavailable';
  useEffect(()=>{window.__WING_WIND_COVERAGE__=windCoverage;window.__WING_WIND_MODE__=windHours;},[windCoverage,windHours]);
  return <div className={isKobo?'app kobo':'app'} data-wind-hours={windHours}><main className="page-shell">
    <header className="masthead"><a className="brand" href={`${basePath}?spot=${spot.id}`}><Mark/><span><b>WING</b> DASHBOARD</span></a><time className="header-time">{formatTime(current?.time||clock,true)} <span>PARIS</span></time></header>
    <div className="spot-bar"><label className="select-box"><span className="sr-only">Choisir le spot</span><select id="spot" value={spotId} onChange={e=>setSpotId(e.target.value)}>{spots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><span className="select-caret" aria-hidden="true">▾</span></label><div className="view-tools"><a href={`${basePath}${isKobo?'':'kobo/'}?spot=${spotId}`}>{isKobo?'Vue web':'Vue Kobo'} ↗</a><button type="button" className="refresh" disabled={status==='loading'} onClick={()=>setRevision(n=>n+1)} title="Recharger les fichiers météo et marées" aria-label="Actualiser les données">↻</button></div></div>
    {status==='loading'&&<p className="notice" role="status">Chargement des prévisions…</p>}
    {status==='error'&&<p className="notice" role="alert">Prévisions météo indisponibles. {error}</p>}
    <section className="metrics" aria-label="Conditions du modèle à 10 mètres">
      <div className="metric main-metric"><h1>Vent moyen</h1><p className="metric-value">{rounded(current?.wind)}<span>nd</span></p><p className="metric-note">Prévision à 10 m</p></div>
      <div className="metric"><h2>Rafales</h2><p className="metric-value">{rounded(current?.gust)}<span>nd</span></p><p className="metric-note">À 10 m de hauteur</p></div>
      <div className="metric direction-metric"><div><h2>Direction</h2><p className="direction-value">{cardinal(current?.direction)}</p><p className="direction-degrees">{isValue(current?.direction)?`${rounded(current.direction)}°`:'—'}</p></div><Compass direction={current?.direction}/></div>
    </section>
    <section className="wind-panel panel" data-coverage={windCoverage} aria-label="Prévisions du vent">
      <div className="section-title"><h2>Prévisions du vent <span>(nœuds) · 8 h → 20 h</span></h2><div className="range-control wind-range" aria-label="Journées de navigation">{[24,48,72].map(hours=><button type="button" key={hours} aria-pressed={windHours===hours} onClick={()=>setWindHours(hours)}>{hours} h</button>)}</div></div>
      <WindTable days={days}/>
    </section>
    <TidePanel spotId={spotId} hours={tideHours} onHoursChange={setTideHours} start={Math.floor(clock/3_600_000)*3_600_000} basePath={basePath} revision={revision} onData={setTides}/>
    <LegalFooter weather={data} tides={tides}/>
  </main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
