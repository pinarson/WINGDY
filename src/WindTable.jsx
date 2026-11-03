import React from 'react';
import {airflowBearing} from './navigation.js';
import {isValue,cardinal} from './weather.js';

export const rounded=value=>isValue(value)?String(Math.round(value)):'—';
function Arrow({value}){
  if(!isValue(value))return <span aria-label="Direction indisponible">—</span>;
  return <span className="wind-arrow" title={`Vient de ${cardinal(value)} (${rounded(value)}°), souffle vers ${cardinal(airflowBearing(value))}`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path transform={`rotate(${airflowBearing(value)} 12 12)`} d="M12 2 5 14 10 12 10 22 14 22 14 12 19 14Z" fill="currentColor"/></svg>
    <span>{rounded(value)}°</span>
  </span>;
}
function Table({days}){
  const columns=days.flatMap(day=>day.rows);
  return <table className="wind-table"><caption className="sr-only">Prévisions de vent à 10 mètres, en heure de Paris</caption><colgroup><col className="row-label-column"/>{columns.map(row=><col key={row.time}/>)}</colgroup><tbody>
    <tr className="date-row"><th scope="row">Date</th>{days.map(day=><th scope="colgroup" colSpan={day.rows.length} key={day.date}>{day.label}</th>)}</tr>
    <tr className="hour-row"><th scope="row">Heure</th>{columns.map(row=><td key={row.time} data-time={row.time}>{String(row.hour).padStart(2,'0')}h</td>)}</tr>
    <tr className="speed-row"><th scope="row">Vent (nd)</th>{columns.map(row=><td key={row.time} data-time={row.time}>{rounded(row.wind)}</td>)}</tr>
    <tr className="gust-row"><th scope="row">Rafales (nd)</th>{columns.map(row=><td key={row.time} data-time={row.time}>{rounded(row.gust)}</td>)}</tr>
    <tr className="direction-row"><th scope="row">Direction</th>{columns.map(row=><td key={row.time} data-time={row.time}><Arrow value={row.direction}/></td>)}</tr>
  </tbody></table>;
}
export default function WindTable({days}){
  const available=days.filter(day=>day.rows.length);
  const incomplete=days.filter(day=>!day.complete);
  return <>
    {available.length?<><div className="wind-combined"><Table days={available}/></div><div className="wind-daily">{available.map(day=><div className="wind-day" data-date={day.date} key={day.date}><Table days={[day]}/></div>)}</div></>:<div className="empty-state">Aucune prévision disponible entre 8 h et 20 h pour ces journées.</div>}
    {incomplete.length>0&&<p className="coverage-note" role="status">Couverture partielle · {incomplete.map(day=>`${day.label} : ${day.rows.length}/7 créneaux`).join(' · ')}. Seules les heures disponibles sont affichées.</p>}
    <p className="direction-note">Flèches : sens du vent · degrés : provenance.</p>
  </>;
}
