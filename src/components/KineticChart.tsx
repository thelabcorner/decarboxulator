import { useRef, useState } from 'react';
import type { KineticResult } from '../lib/trackerKinetics';
import type { TrackerPoint } from '../lib/trackerAnalytics';
import { formatNumber } from '../lib/decarb';

/** Responsive vector laboratory plot: no canvas raster blurring, no chart dependency.
 * Motion follows input via requestAnimationFrame, never a setInterval-driven re-render.
 * All numbers are persisted measurements or a clearly separated empirical estimate.
 */
export function KineticChart({points,startedAt,fit,compact=false,flagged=[]}:{
  points:TrackerPoint[];startedAt:number;fit:KineticResult|null;compact?:boolean;
  flagged?:Array<{timestamp:number;weight:number;percent:number}>;
}){
  const svg=useRef<SVGSVGElement>(null);
  const crosshair=useRef<SVGGElement>(null);
  const pointer=useRef<{x:number;y:number}|null>(null);
  const frame=useRef<number|null>(null);
  const [selected,setSelected]=useState<number|null>(null);
  const duration=Math.max(1/60,fit?.curve.at(-1)?.hours??
    (points.length?Math.max(0,(points.at(-1)!.timestamp-startedAt)/3600000):0));
  const x=(t:number)=>54+Math.max(0,Math.min(1,t/duration))*682;
  const y=(pct:number)=>260-Math.max(0,Math.min(100,pct))/100*232;
  const observed=points.map((p,i)=>({index:i,hours:(p.timestamp-startedAt)/3600000,
    pct:p.snapshot.completion,weight:p.weightG,temp:p.temperatureC}));
  const curve=fit?.curve??[];
  const path=(items:Array<{hours:number;pct:number}>)=>
    items.map((p,i)=>(i?'L':'M')+x(p.hours).toFixed(2)+' '+y(p.pct).toFixed(2)).join(' ');
  const actualPath=path(observed);
  const fitPath=path(curve.map(p=>({hours:p.hours,pct:p.estimate})));
  const band=curve.length>0&&curve.every(p=>p.lower!==null&&p.upper!==null)
    ?path(curve.map(p=>({hours:p.hours,pct:p.upper!})))+' '+
      path([...curve].reverse().map(p=>({hours:p.hours,pct:p.lower!}))).replace(/^M/,'L')+' Z'
    :'';
  const lastObserved=observed.at(-1)?.hours??0;
  const picked=selected===null?null:observed[selected]??null;
  const hoursLabel=(hours:number)=>hours>=1?formatNumber(hours,2)+' h':formatNumber(hours*60,1)+' min';
  function moveClient(clientX:number,clientY:number) {
    const element=svg.current;
    if(!element)return;
    const rect=element.getBoundingClientRect();
    pointer.current={x:(clientX-rect.left)/rect.width*790,y:(clientY-rect.top)/rect.height*302};
    if(frame.current!==null)return;
    frame.current=requestAnimationFrame(()=>{
      frame.current=null;
      const pt=pointer.current,el=crosshair.current;
      if(!pt||!el)return;
      const xx=Math.max(54,Math.min(736,pt.x));
      el.setAttribute('transform','translate('+xx+' 0)');
      el.setAttribute('opacity','1');
      if(observed.length){
        let nearest=0,best=Infinity;
        for(let i=0;i<observed.length;i++){
          const d=Math.abs(x(observed[i].hours)-xx);
          if(d<best){best=d;nearest=i;}
        }
        setSelected(previous=>previous===nearest?previous:nearest);
      }
    });
  }
  function hide(){
    pointer.current=null;
    if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}
    crosshair.current?.setAttribute('opacity','0');
    setSelected(null);
  }
  return <section className={'kinetic-chart-shell'+(compact?' kinetic-chart-compact':'')}
    aria-label="Time-resolved apparent conversion graph">
    <div className="kinetic-chart-top">
      <div className="kinetic-chart-title"><strong>Conversion trajectory</strong>
        <span>Time elapsed · CO2-only apparent conversion</span></div>
      <div className="kinetic-chart-legend">
        <span><i className="kinetic-legend-measured"/>Measurements</span>
        {fit?.status==='fitted'&&<span><i className="kinetic-legend-fit"/>Empirical fit</span>}
        {band&&<span><i className="kinetic-legend-band"/>80% model sensitivity</span>}
        {flagged.length>0&&<span><i className="kinetic-legend-flagged"/>Outside model</span>}
      </div>
    </div>
    <div className="kinetic-chart-stage">
      <svg ref={svg} viewBox="0 0 790 302" className="kinetic-chart-svg" role="img"
        tabIndex={0} aria-label={'Apparent conversion over '+hoursLabel(duration)+'. '+
          points.length+' measured readings. Focus and use arrow keys to inspect readings.'}
        onPointerMove={e=>moveClient(e.clientX,e.clientY)}
        onPointerLeave={hide}
        onBlur={hide}
        onKeyDown={e=>{
          if(!observed.length)return;
          if(e.key==='ArrowRight'||e.key==='ArrowLeft'||e.key==='Home'||e.key==='End'){
            e.preventDefault();
            const next=e.key==='Home'?0:e.key==='End'?observed.length-1:
              Math.max(0,Math.min(observed.length-1,(selected??observed.length-1)+(e.key==='ArrowRight'?1:-1)));
            setSelected(next);
            crosshair.current?.setAttribute('transform','translate('+x(observed[next].hours)+' 0)');
            crosshair.current?.setAttribute('opacity','1');
          }
        }}>
        <defs>
          <clipPath id={compact?'kinetic-monitor-clip':'kinetic-analysis-clip'}>
            <rect x="54" y="28" width="682" height="232"/>
          </clipPath>
        </defs>
        {[0,25,50,75,100].map(v=><g key={v}>
          <line x1="54" x2="736" y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity=".13"/>
          <text x="45" y={y(v)+4} textAnchor="end" fill="currentColor" fontSize="12">{v}%</text>
        </g>)}
        {[0,.25,.5,.75,1].map(v=><g key={v}>
          <line x1={54+682*v} x2={54+682*v} y1="28" y2="260" stroke="currentColor" strokeOpacity=".055"/>
          <text x={54+682*v} y="287" textAnchor={v===0?'start':v===1?'end':'middle'}
            fill="currentColor" fontSize="12">{hoursLabel(duration*v)}</text>
        </g>)}
        {curve.length>0&&lastObserved<duration&&
          <rect x={x(lastObserved)} y="28" width={Math.max(0,736-x(lastObserved))}
            height="232" fill="currentColor" opacity=".025"/>}
        <g clipPath={'url(#'+(compact?'kinetic-monitor-clip':'kinetic-analysis-clip')+')'}>
          {band&&<path d={band} className="kinetic-confidence-band"/>}
          {fit?.status==='fitted'&&<path key={fit.model} d={fitPath} className="kinetic-fitted-path" pathLength="1000"/>}
          {actualPath&&<path d={actualPath} className="kinetic-measured-path"/>}
          {observed.map(p=><circle key={p.index} cx={x(p.hours)} cy={y(p.pct)}
            r={selected===p.index?6:4.3} className="kinetic-measured-dot"/>)}
          {flagged.map((p,i)=>{
            const xx=x((p.timestamp-startedAt)/3600000);
            const yy=p.percent>100?36:p.percent<0?251:y(p.percent);
            return <path key={i} className="kinetic-flagged-dot"
              d={'M'+xx+' '+(yy-6)+'l6 11h-12Z'}>
              <title>Uninterpretable raw mass: {formatNumber(p.weight,4)} g.
                Apparent loss is outside the CO2-only range and excluded from fitting.</title>
            </path>;
          })}
        </g>
        <g ref={crosshair} opacity="0" pointerEvents="none">
          <line x1="0" x2="0" y1="28" y2="260" className="kinetic-crosshair"/>
        </g>
      </svg>
    </div>
    <div className="kinetic-chart-footer">
      <span>{picked?'Reading '+(picked.index+1)+' · '+hoursLabel(picked.hours)+
        ' · '+formatNumber(picked.pct,2)+'% apparent · '+formatNumber(picked.weight,4)+' g':
        (points.length?points.length+' observed measurements · scroll/touch or focus to inspect':'Record measurements to reveal the curve')}</span>
      <span>{fit?.status==='fitted'?'Conditional fit · not assay':fit?.reason??'Awaiting baseline'}</span>
    </div>
  </section>;
}
