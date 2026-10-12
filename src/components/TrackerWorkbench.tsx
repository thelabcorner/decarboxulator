import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Archive, ChartNoAxesCombined, Check, ChevronRight, CircleHelp, CloudOff, Download, HardDrive, ListChecks, Pause, Play, Plus, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { NumberField } from './NumberField';
import { ScrollView } from './ScrollView';
import { FieldGrid, Metric, Metrics, Notice, Panel, Selector, Unavailable } from './ui';
import { useTrackerSessions } from '../lib/useTrackerSessions';
import { TRACKER_DEFAULTS, canCreateTrackerSession } from '../lib/trackerSessions';
import { TrackerSessionLibrary } from './TrackerSessionLibrary';
import { formatNumber, parseAmount, trackerSetup, trackerSnapshot, type TrackerConfig } from '../lib/decarb';
import { MAX_TRACKER_READINGS, type TrackerReading } from '../lib/workspacePayload';
import { useTrackerKinetics } from '../lib/useTrackerKinetics';
import { KineticChart } from './KineticChart';
import { analyzeTrackerSeries, restoreTrackerPoints, trackerConfigFromPercent, trackerRawCSV,
  validatedTrackerConfig, type TrackerGraph, type TrackerPoint, type TrackerInputMode } from '../lib/trackerAnalytics';
import './MoreCalculators.css';
import './TrackerSessions.css';

const EMPTY_READINGS: TrackerReading[] = [];
function smallTime(hours: number | null) {
  if (hours === null || !Number.isFinite(hours) || hours < 0) return '—';
  const minutes = Math.round(hours*60);
  return minutes >= 60 ? `${Math.floor(minutes/60)}h ${minutes%60}m` : `${minutes}m`;
}
function SeriesChart({points, mode, expectedLoss}: {points:TrackerPoint[];mode:TrackerGraph;expectedLoss:number}) {
  if (!points.length) return <Unavailable>Record a measurement to start the chart.</Unavailable>;
  const first = points[0].timestamp, end = points.at(-1)!.timestamp;
  const columns: Array<{label:string;color:string;values:number[]}> = mode === 'completion'
    ? [{label:'Completion',color:'var(--accent)',values:points.map(p=>p.snapshot.completion)}] :
    mode === 'composition'
    ? [{label:'THCa %',color:'var(--accent)',values:points.map(p=>p.snapshot.thcaPct)},
       {label:'THC %',color:'#579bcc',values:points.map(p=>p.snapshot.thcPct)}] :
    mode === 'loss'
    ? [{label:'CO₂-only inferred loss (g)',color:'var(--accent)',values:points.map(p=>p.snapshot.weightLossG)},
       {label:'Expected maximum (g)',color:'#a18e5a',values:points.map(()=>expectedLoss)}] :
    [{label:'THC rate (g/h)',color:'var(--accent)',values:points.map((p,i)=>{
      if (!i || p.timestamp <= points[i-1].timestamp) return 0;
      return (p.snapshot.convertedThcG-points[i-1].snapshot.convertedThcG) /
        ((p.timestamp-points[i-1].timestamp)/3600000);
    })}];
  const all = columns.flatMap(s=>s.values.filter(Number.isFinite));
  const ymax = Math.max(1,...all), ymin = Math.min(0,...all);
  const den = Math.max(1e-10,ymax-ymin);
  const toX = (i:number) => end===first ? (points.length===1 ? 300 : 48 + i*504/(points.length-1))
    : 48+(points[i].timestamp-first)/(end-first)*504;
  const toY = (v:number) => 168-(v-ymin)/den*138;
  return <div className="tracker-chart-wrap">
    <div className="tracker-chart-legend">{columns.map(s=><span key={s.label}>
      <i style={{background:s.color}}/>{s.label}</span>)}</div>
    <svg className="tracker-chart" viewBox="0 0 600 204" role="img"
      aria-label={`${mode} chart for ${points.length} readings`} preserveAspectRatio="xMidYMid meet">
      {[0,.25,.5,.75,1].map(t=><g key={t}>
        <line x1="48" x2="552" y1={168-t*138} y2={168-t*138} stroke="currentColor" strokeOpacity=".12"/>
        <text x="40" y={172-t*138} fill="currentColor" fontSize="11" textAnchor="end">{formatNumber(ymin+t*den,1)}</text>
      </g>)}
      <line x1="48" x2="552" y1="168" y2="168" stroke="currentColor" strokeOpacity=".28"/>
      {columns.map(series=><g key={series.label}>
        {series.values.length>1 && <polyline fill="none" stroke={series.color} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
          points={series.values.map((n,i)=>`${toX(i)},${toY(n)}`).join(' ')}/>}
        {series.values.map((n,i)=><circle key={i} cx={toX(i)} cy={toY(n)} r="3.3" fill={series.color}>
          <title>{new Date(points[i].timestamp).toLocaleString()}: {formatNumber(n,3)}</title>
        </circle>)}
      </g>)}
      <text x="48" y="191" fontSize="11" fill="currentColor">{new Date(first).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</text>
      <text x="552" y="191" fontSize="11" textAnchor="end" fill="currentColor">{new Date(end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</text>
    </svg>
  </div>;
}
export function TrackerWorkbench() {
  const ws = useTrackerSessions();
  const session=ws.active;
  const {tare,thca,other,current,trackerMode,totalContent,acidPercent,
    otherPercent,autoBalance,scaleResolution,measurementTempC,measurementNote} = session?.fields ?? TRACKER_DEFAULTS;
  const startedAt=session?.startedAt??0;
  const [libraryOpen,setLibraryOpen]=useState(false);
  const [showLockedSetup,setShowLockedSetup]=useState(false);
  const [tab,setTab]=useState<'live'|'setup'|'analysis'|'records'>('live');
  const userSelectedTab=useRef(false);
  const initialHydrationHandled=useRef(false);
  const [view,setView] = useState<TrackerGraph>('completion');
  const [clock,setClock] = useState(0);
  const isTracking = session?.status === 'running';
  const activeSessionId=session?.id;
  const storedReadings = session?.readings ?? EMPTY_READINGS;
  const locked = storedReadings.length>0 || isTracking || session?.status === 'completed' || session?.status === 'paused';
  const mode: TrackerInputMode = trackerMode === 'percentage' ? 'percentage' : 'manual';
  useEffect(()=>{
    if (!ws.ready || !activeSessionId || initialHydrationHandled.current) return;
    initialHydrationHandled.current=true;
    // The initialization default applies only once. Changing the active run
    // must not undo a deliberate New run → Setup or Review → Monitor transition.
    if (!userSelectedTab.current) setTab('live');
  },[ws.ready,activeSessionId]);
  useEffect(()=>{
    if (!isTracking) return;
    const handle = window.setInterval(()=>setClock(Date.now()),15000);
    return ()=>window.clearInterval(handle);
  },[isTracking]);

  const numbers = useMemo(()=>({
    tare:parseAmount(tare),thca:parseAmount(thca),other:parseAmount(other),
    total:parseAmount(totalContent),acid:parseAmount(acidPercent,{max:100}),
    otherPercent:parseAmount(otherPercent,{max:100}),current:parseAmount(current),
    resolution:parseAmount(scaleResolution,{min:0.000001,max:100}),
    temp:measurementTempC.trim()===''?{value:null,error:null}:parseAmount(measurementTempC,{max:500}),
  }),[tare,thca,other,totalContent,acidPercent,otherPercent,current,scaleResolution,measurementTempC]);
  const cfg: TrackerConfig | null = useMemo(()=>{
    const t=numbers.tare.value;
    if(t===null) return null;
    if (mode==='percentage') {
      if(numbers.total.value===null||numbers.acid.value===null||numbers.otherPercent.value===null) return null;
      return trackerConfigFromPercent(t,numbers.total.value,numbers.acid.value,numbers.otherPercent.value);
    }
    if(numbers.thca.value===null||numbers.other.value===null) return null;
    return validatedTrackerConfig({tareG:t,thcaG:numbers.thca.value,otherG:numbers.other.value});
  // A new live weight/temperature/note must NOT re-create the entire historical
  // point series or restart bootstrap fitting while a technician is typing.
  },[mode,numbers.tare.value,numbers.total.value,numbers.acid.value,
    numbers.otherPercent.value,numbers.thca.value,numbers.other.value]);
  const setup=useMemo(()=>cfg?trackerSetup(cfg):null,[cfg]);
  const points=useMemo(()=>cfg?restoreTrackerPoints(storedReadings,cfg):[],[cfg,storedReadings]);
  const allMeasurements=useMemo(()=>storedReadings.map(reading=>({
    ...reading,snapshot:cfg&&setup?trackerSnapshot(reading.weightG,cfg,setup):null,
  })),[storedReadings,cfg,setup]);
  const flagged=allMeasurements.filter(reading=>!reading.snapshot);
  const newestOutside=Boolean(allMeasurements.length&&!allMeasurements.at(-1)!.snapshot);
  const currentSnapshot=cfg&&setup&&numbers.current.value!==null
    ? trackerSnapshot(numbers.current.value,cfg,setup):null;
  const last=points.at(-1);
  const analytics=useMemo(()=>cfg?analyzeTrackerSeries(points,cfg,Number(startedAt)) : null,[cfg,points,startedAt]);
  const kinetics=useTrackerKinetics(points,Number(startedAt),
    numbers.resolution.value??undefined,setup?.expectedCo2LossG,
    storedReadings,setup?.initialTotalG);
  const durationH = startedAt>0 && (isTracking?clock:(last?.timestamp??0))>startedAt
    ? ((isTracking?clock:last!.timestamp)-startedAt)/3600000 : null;
  const uncertainty = setup && numbers.resolution.value !== null
    ? 100*numbers.resolution.value/setup.expectedCo2LossG : null;
  function startSession(){
    if(!cfg||!setup||!ws.ready||session?.status==='completed') return;
    ws.start();
    setTab('live');
  }
  function addReading(){
    if(!isTracking||numbers.current.value===null||numbers.current.value<=0 ||
      numbers.temp.error || storedReadings.length>=MAX_TRACKER_READINGS) return;
    const timestamp = Date.now();
    if(last && timestamp<=last.timestamp) return;
    ws.addReading({
      weightG:numbers.current.value,timestamp,
      ...(numbers.temp.value===null?{}:{temperatureC:numbers.temp.value}),
      ...(measurementNote.trim()?{note:measurementNote.trim()}:{}),
    });
  }
  function exportCSV(){
    const text=trackerRawCSV(storedReadings,cfg);
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='decarboxulator-tracker-readings.csv';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function setAcidPercent(v:string){
    ws.updateFields(autoBalance==='yes' && Number.isFinite(Number(v)) && Number(v)>=0 && Number(v)<=100
      ? {acidPercent:v,otherPercent:String(100-Number(v))}
      : {acidPercent:v});
  }

  return <div className="tracker-workbench" data-review={locked}>
    <header className="tracker-runbar">
      <div className="tracker-run-identity">
        <span className="tracker-status-dot" data-status={session?.status??'draft'}/>
        <div className="tracker-run-copy">
          <strong title={session?.title}>{session?.title??'Loading run...'}</strong>
          <span><b>{session?.status??'loading'}</b><i/> {session?.readings.length??0} readings</span>
        </div>
      </div>
      <div className="tracker-runbar-actions">
        <span className="tracker-save-label" data-state={ws.saveState} role="status"
          title={ws.saveState==='saved'?'Changes stored in IndexedDB on this device':ws.saveState==='error'?'Changes are not saved':'Saving tracker data'}>
          {ws.saveState==='error'?<CloudOff size={13}/>:<HardDrive size={13}/>}
          <span>{ws.saveState==='saved'?'Saved':ws.saveState==='saving'?'Saving…':ws.saveState==='loading'?'Opening…':'Not saved'}</span>
        </span>
        <button type="button" className="tracker-mini-button" onClick={()=>setLibraryOpen(true)}
          disabled={!ws.ready} title="Review tracker sessions"><Archive size={14}/> Sessions ({ws.sessions.length})</button>
        <button type="button" className="tracker-mini-button tracker-mini-button-primary" onClick={()=>{
          ws.newSession();setTab('setup');
        }} disabled={!ws.ready||!canCreateTrackerSession(ws.sessions.length)}>
          <Plus size={14}/> New run</button>
      </div>
    </header>
    <nav className="tracker-mode-bar" role="tablist" aria-label="Tracker workspace sections">
      {([
        ['live','Monitor',Activity],['setup','Setup',SlidersHorizontal],
        ['analysis','Analysis',ChartNoAxesCombined],['records','Log',ListChecks],
      ] as const).map(([key,label,Icon])=>
        <button type="button" key={key} id={`tracker-tab-${key}`} role="tab"
          aria-controls={`tracker-panel-${key}`} aria-selected={tab===key}
           tabIndex={tab===key?0:-1} onClick={()=>{userSelectedTab.current=true;setTab(key);}}
          onKeyDown={event=>{
            const order=['live','setup','analysis','records'] as const;
            const index=order.indexOf(key);
            const next=event.key==='ArrowRight'?(index+1)%order.length:
              event.key==='ArrowLeft'?(index+order.length-1)%order.length:
              event.key==='Home'?0:event.key==='End'?order.length-1:-1;
             if(next>=0){event.preventDefault();userSelectedTab.current=true;setTab(order[next]);
              requestAnimationFrame(()=>document.getElementById('tracker-tab-'+order[next])?.focus());}
          }}>
          <Icon size={14} aria-hidden="true"/><span>{label}</span>
          {key==='records'&&storedReadings.length>0&&<small>{storedReadings.length}</small>}
        </button>)}
    </nav>
    {ws.error&&<div className="tracker-warning-compact"><Notice variant="warning">
      IndexedDB autosave is unavailable: {ws.error}. Don't close this page without exporting a backup.
      <button type="button" className="tracker-mini-button" onClick={ws.retrySave}>Retry save</button>
    </Notice></div>}
    {tab==='live'&&<section className="tracker-tab-content tracker-monitor-view"
      id="tracker-panel-live" role="tabpanel" aria-labelledby="tracker-tab-live">
      <div className="tracker-monitor-hero">
        <div className="tracker-hero-overline">
          <span><Activity size={13}/> Apparent conversion</span>
          <span className="tracker-monitor-status" data-status={session?.status??'draft'}>
            <span className="tracker-status-dot" data-status={session?.status??'draft'}/>
            {session?.status==='running'?'Recording':session?.status==='completed'?'Complete':
              session?.status==='paused'?'Paused':'Ready to set up'}
          </span>
        </div>
        <div className="tracker-hero-number">
          <strong>{last?formatNumber(last.snapshot.completion,2):'—'}</strong>
          {last?<span>%</span>:<span className="tracker-awaiting">Awaiting first reading</span>}
        </div>
        <div className="tracker-hero-caption">{last
          ? `${formatNumber(last.snapshot.weightLossG,4)} g inferred CO₂ loss · ${points.length} measured`
          : 'No readings yet · CO₂-only estimate, not an assay'}</div>
        <div className="tracker-progress-bar" role="progressbar" aria-valuemin={0}
          aria-valuemax={100} aria-valuenow={last?.snapshot.completion}
          aria-label="Apparent decarboxylation completion">
          <div className="tracker-progress-fill" style={{width:`${last?.snapshot.completion??0}%`}}/>
        </div>
        <div className="tracker-monitor-metrics">
          <div><span>Initial vessel</span><strong>{setup?formatNumber(setup.initialTotalG,3):'—'} <small>g</small></strong></div>
          <div><span>Last reading</span><strong>{last?formatNumber(last.weightG,3):'—'} <small>g</small></strong></div>
          <div><span>Expected CO₂</span><strong>{setup?formatNumber(setup.expectedCo2LossG,3):'—'} <small>g</small></strong></div>
        </div>
      </div>
      {setup&&session?.startedAt&&<KineticChart points={points} startedAt={session.startedAt}
        fit={kinetics} compact flagged={flagged.map(p=>({timestamp:p.timestamp,weight:p.weightG,
          percent:100*(setup.initialTotalG-p.weightG)/setup.expectedCo2LossG}))}/>}
      {newestOutside&&setup&&<Notice variant="warning">Latest measured vessel mass is outside
        the CO₂-only range. The raw value remains in the log and CSV, but no chemical
        conversion is assigned and it is excluded from the kinetic fit.</Notice>}
      {kinetics?.status==='fitted'&&<div className="kinetic-monitor-outlook">
        <span><strong>Empirical forecast</strong><small>Conditional on the observed run · not chemical completion</small></span>
        <span><small>90% apparent · remaining</small><strong>{kinetics.forecast90Hours!==null&&kinetics.forecast90Hours>kinetics.elapsedHours
          ?smallTime(kinetics.forecast90Hours-kinetics.elapsedHours):'—'}</strong></span>
        <span><small>95% apparent · remaining</small><strong>{kinetics.forecast95Hours!==null&&kinetics.forecast95Hours>kinetics.elapsedHours
          ?smallTime(kinetics.forecast95Hours-kinetics.elapsedHours):'—'}</strong></span>
      </div>}
      <div className="tracker-live-commands">
        {session?.status==='completed'
          ? <button type="button" className="tracker-command-primary" onClick={ws.reopen}>
              <RotateCcw size={15}/> Reopen run</button>
          : isTracking
            ? <button type="button" className="tracker-command-secondary" onClick={ws.pause}>
                <Pause size={15}/> Pause recording</button>
            : <button type="button" className="tracker-command-primary" disabled={!cfg||!ws.ready}
                onClick={startSession}><Play size={15}/>{session?.status==='paused'?'Resume recording':'Start recording'}</button>}
        {session?.status!=='completed'&&storedReadings.length>0&&
          <button type="button" className="tracker-command-secondary" onClick={ws.complete}>
            <Check size={15}/> Mark run complete</button>}
        <button type="button" className="tracker-command-link" onClick={()=>setTab('setup')}>
          Baseline <ChevronRight size={14}/></button>
      </div>
      {!isTracking&&<div className="tracker-next-step">
        <span>{session?.status==='completed'?'Run archived':'Baseline'}</span>
        <strong>{cfg&&setup
          ? `${formatNumber(cfg.thcaG,2)} g THCa · ${formatNumber(cfg.tareG,2)} g tare`
          : 'Complete the setup to begin'}</strong>
        <button type="button" onClick={()=>setTab('setup')}>Review setup <ChevronRight size={13}/></button>
      </div>}
      {(isTracking||storedReadings.length>0)&&
    <Panel title="Measurement station" className="tracker-measurement-panel" detail={isTracking?'Recording enabled · updates saved automatically':
      session?.status==='completed'?'Read-only measurements · run completed':'Paused or not started · all readings retained'}>
      <div className="input-stack">
        {isTracking&&cfg&&setup?<div className="tracker-toolbar">
           <div className="tracker-input-flex"><NumberField id="tracker-measurement" label="Current vessel + contents" value={current}
             onChange={v=>ws.setField('current',v)} suffix="g" prominent
             error={numbers.current.error}/></div>
           <button type="button" className="action-button" disabled={numbers.current.value===null||numbers.current.value<=0||
             Boolean(numbers.temp.error)||storedReadings.length>=MAX_TRACKER_READINGS}
            onClick={addReading}><Plus size={15}/> Record</button>
        </div>:null}
        {isTracking&&<div className="tracker-reading-context">
          <NumberField id="tracker-observed-temp" label="Observed temperature (optional)" value={measurementTempC}
            onChange={v=>ws.setField('measurementTempC',v)} suffix="°C" max={500} error={numbers.temp.error}
            hint="Only enter a measured value; it is not used to infer conversion."/>
          <label className="tracker-text-field">Reading note (optional)
            <input type="text" value={measurementNote} maxLength={300} placeholder="e.g. Stirred sample; balance stabilized"
              onChange={e=>ws.setField('measurementNote',e.target.value)}/></label>
        </div>}
         {currentSnapshot && setup && isTracking && <Notice>
           Preview: {formatNumber(currentSnapshot.completion,2)}% apparent ·
           {formatNumber(currentSnapshot.weightLossG,4)} g attributed to CO₂. Tap Record to save this reading.
         </Notice>}
         {isTracking&&numbers.current.value!==null&&!currentSnapshot&&setup&&<Notice variant="warning">
           This measurement is outside the ideal CO₂-only range ({formatNumber(setup.initialTotalG-setup.expectedCo2LossG,4)}–{formatNumber(setup.initialTotalG,4)} g).
           Record the raw value for your lab audit; it will be flagged, not interpreted as conversion.
         </Notice>}
        {last&&<Metrics>
          <Metric label="THCa remaining" value={formatNumber(last.snapshot.remainingThcaG,3)} suffix="g"/>
          <Metric label="THC formed" value={formatNumber(last.snapshot.convertedThcG,3)} suffix="g" accent/>
          <Metric label="THCa fraction" value={formatNumber(last.snapshot.thcaPct,2)} suffix="%"/>
          <Metric label="THC fraction" value={formatNumber(last.snapshot.thcPct,2)} suffix="%"/>
        </Metrics>}

      </div>
    </Panel>
      }
      {storedReadings.length>0&&<button type="button" className="tracker-inline-navigation"
        onClick={()=>setTab('analysis')}><ChartNoAxesCombined size={15}/>
        Review trends & rates <ChevronRight size={14}/></button>}
      <p className="tracker-model-note">Mass-loss results are theoretical CO₂-only estimates. Volatiles, transfers, and balance drift can affect the reading.</p>
    </section>}
    {tab==='setup'&&<section className="tracker-tab-content tracker-setup-view"
      id="tracker-panel-setup" role="tabpanel" aria-labelledby="tracker-tab-setup">
      <p className="tracker-setup-hint">Define the starting sample and balance. The baseline locks after recording begins to preserve measurement consistency.</p>
    <Panel title="Baseline configuration" detail={locked ? 'Locked to preserve the session measurement basis' : 'Define the initial material before recording'} className="tracker-config-panel"
      action={<span className="tracker-mini-tag">{mode==='percentage'?'ASSAY %':'MEASURED MASSES'}</span>}>
      <div className="input-stack">
        {locked&&!showLockedSetup&&<button type="button" className="tracker-mini-button"
          onClick={()=>setShowLockedSetup(true)}>Review original baseline inputs</button>}
        {(!locked||showLockedSetup)&&
        <fieldset className="studio-fieldset" disabled={locked}>
          <Selector label="Starting material definition" value={mode}
            onChange={v=>ws.setField('trackerMode',v)}
            options={[{value:'manual',label:'Masses'},{value:'percentage',label:'Composition %'}]}/>
          {mode==='manual'?<>
            <FieldGrid>
              <NumberField id="tracker-tare" label="Empty vessel + lid tare" value={tare} onChange={v=>ws.setField('tare',v)} suffix="g" error={numbers.tare.error}/>
              <NumberField id="tracker-thca" label="Initial THCa (acid) mass" value={thca} onChange={v=>ws.setField('thca',v)} suffix="g" error={numbers.thca.error}/>
            </FieldGrid>
            <NumberField id="tracker-other" label="Other assumed nonvolatile solids" value={other} onChange={v=>ws.setField('other',v)} suffix="g" error={numbers.other.error}/>
            <label className="studio-check"><input type="checkbox" checked={numbers.other.value===0}
              onChange={e=>e.target.checked&&ws.setField('other','0')}/> Pure THCa isolate (no other mass)</label>
          </>:<>
            <FieldGrid>
              <NumberField id="tracker-tare-pct" label="Empty vessel + lid tare" value={tare} onChange={v=>ws.setField('tare',v)} suffix="g" error={numbers.tare.error}/>
              <NumberField id="tracker-total-content" label="Total starting content" value={totalContent}
                onChange={v=>ws.setField('totalContent',v)} suffix="g" error={numbers.total.error}/>
            </FieldGrid>
            <FieldGrid>
              <NumberField id="tracker-acid-pct" label="THCa (% of material mass)" value={acidPercent} onChange={setAcidPercent} suffix="%" max={100} error={numbers.acid.error}/>
              <NumberField id="tracker-other-pct" label="Remaining compounds" value={otherPercent}
                onChange={v=>ws.setField('otherPercent',v)} suffix="%" max={100}
                error={numbers.otherPercent.error}/>
            </FieldGrid>
            <label className="studio-check"><input type="checkbox" checked={autoBalance==='yes'}
               onChange={e=>ws.updateFields(e.target.checked?{autoBalance:'yes',otherPercent:String(100-Number(acidPercent))}:{autoBalance:'no'})}/>
              Balance remaining percentage automatically</label>
            {numbers.acid.value!==null&&numbers.otherPercent.value!==null&&
              Math.abs(numbers.acid.value+numbers.otherPercent.value-100)>1e-7&&
              <Notice variant="warning">THCa and remaining-compound percentages must equal 100%.</Notice>}
          </>}
        </fieldset>}
        <div className="tracker-session-form">
          <label className="tracker-text-field">Run name / batch identifier
            <input type="text" maxLength={120} placeholder="e.g. Batch A · THCa isolate · Run 03"
              value={session?.title??''} disabled={!ws.ready} onChange={e=>ws.updateActive({title:e.target.value})}/></label>
          <label className="tracker-text-field">Technician notes (optional)
            <textarea rows={2} maxLength={4000} placeholder="Record preparation, apparatus, sample changes, balance conditions, or anomalies."
              value={session?.notes??''} disabled={!ws.ready} onChange={e=>ws.updateActive({notes:e.target.value})}/></label>
          <fieldset className="studio-fieldset" disabled={locked}>
            <NumberField id="tracker-resolution" label="Balance readability (1 digit, e.g. 0.01 g)" value={scaleResolution}
              onChange={v=>ws.setField('scaleResolution',v)} suffix="g" error={numbers.resolution.error}
              min={0.000001} max={100}/>
          </fieldset>
        </div>
        {cfg&&setup?<Metrics>
          <Metric label="Initial vessel mass" value={formatNumber(setup.initialTotalG,3)} suffix="g"/>
          <Metric label="Maximum CO₂ loss" value={formatNumber(setup.expectedCo2LossG,3)} suffix="g"/>
          <Metric label="Theoretical final vessel mass" value={formatNumber(cfg.tareG+setup.expectedFinalContentG,3)} suffix="g"/>
          <Metric label="Potential THC formed" value={formatNumber(setup.expectedFinalThcG,3)} suffix="g"/>
        </Metrics>:<Unavailable>Complete a physically valid starting composition.</Unavailable>}
        {uncertainty!==null&&<Notice>One balance increment corresponds to approximately
          <strong> ±{formatNumber(uncertainty,2)} percentage points</strong> of apparent conversion.
          This is scale readability sensitivity, not a measured uncertainty interval.</Notice>}
        {session?.status==='draft'&&<button type="button" className="tracker-command-primary"
          disabled={!cfg||!ws.ready} onClick={startSession}><Play size={15}/> Start recording</button>}
        {session?.status==='completed'&&<Notice>Run marked complete on {new Date(session.completedAt!).toLocaleString()}.
          This describes the lab record's status—not independently verified conversion.</Notice>}
      </div>
    </Panel>
    <Panel title="Method & measurement guide" detail="Expanded v2.3 instructions · essential assumptions" className="panel-full">
      <div className="tracker-help">
        <details open>
          <summary><CircleHelp size={14}/> Taking comparable measurements</summary>
          <div><ol>
            <li><strong>Before heating:</strong> use a clean, dry vessel and include every piece that will remain on the balance (lid, liner, etc.) in the tare.</li>
            <li><strong>Establish the baseline:</strong> enter starting THCa mass or an assay-derived THCa percentage, and material mass excluding tare. The calculator predicts a starting vessel + contents mass.</li>
            <li><strong>At each interval:</strong> record the mass of exactly the same complete vessel + contents arrangement. Use the same balance, tare convention, and weighing conditions.</li>
            <li><strong>Let temperature stabilize:</strong> hot vessels, convection and thermal drift can distort readings. Only weigh with safe procedures appropriate to your apparatus.</li>
            <li><strong>Finish:</strong> review the final trend, document anomalies, and mark the run complete yourself. Sessions and measurements are automatically retained in this device's IndexedDB.</li>
          </ol></div>
        </details>
        <details><summary><CircleHelp size={14}/> How apparent conversion is calculated</summary>
          <div><p>For THCa → THC + CO₂, theoretical CO₂ fraction = (358.47 − 314.46) / 358.47 ≈ 12.28% of starting THCa mass.</p>
            <p><strong>Apparent conversion %</strong> = (initial vessel mass − current vessel mass) / expected maximum CO₂ mass × 100.</p>
            <p>Predicted THC formed = initial THCa mass × (314.46 / 358.47) × apparent conversion fraction. All values remain conditional on the CO₂-only mass-loss model.</p>
          </div>
        </details>
        <details><summary><CircleHelp size={14}/> Why readings can be rejected or misleading</summary>
           <div><p>A reading above initial mass or below the CO₂-only theoretical final mass cannot be explained by this model. The raw measurement is still retained, but flagged and excluded from conversion estimates; it is never silently converted to 0% or 100%.</p>
             <p>Moisture, solvents and volatile terpenes may produce additional loss; air currents, balance readability, changing equipment, incomplete gas escape or retained material can obscure it. A flat mass curve does not establish reaction completion. Independent assay is needed for measured chemical conversion.</p>
           </div>
        </details>
        <details><summary><CircleHelp size={14}/> Reading the kinetic graph and forecast</summary>
          <div>
            <p><strong>Green points are observations.</strong> They represent the mass-loss-derived estimate at the instant you weighed the vessel. The blue line is an empirical mathematical fit across the observation history; portions extending beyond the last point are predictions, never additional measurements.</p>
            <p>The model compares a first-order curve with optional stretched-exponential and induction-lag variants. It selects among eligible candidates using residual fit and a small-sample complexity penalty (AICc). Several measurements over a meaningful time span are needed; the graph can legitimately report that no rate or future crossing is identifiable.</p>
            <p><strong>90% and 95% times</strong> are conditional crossings of apparent mass-loss conversion, not confirmation of neutral THC yield or product quality. The faint sensitivity region explores plausible fitted trajectories under this particular model and measured balance readability. It does not account for unrelated volatiles, changing heating conditions, or erroneous starting composition.</p>
            <p>Temperature observations help document the run and detect nonisothermal conditions. This tracker cannot identify activation energy or temperature-corrected Arrhenius kinetics from one nonisothermal weight-loss trace. Compare repeated, assayed batches before interpreting the fitted shape chemically.</p>
          </div>
        </details>
      </div>
    </Panel>

      <button type="button" className="tracker-inline-navigation" onClick={()=>setTab('live')}>
        <Activity size={14}/> Return to monitor <ChevronRight size={14}/></button>
    </section>}
    {tab==='analysis'&&<section className="tracker-tab-content tracker-analysis-view"
      id="tracker-panel-analysis" role="tabpanel" aria-labelledby="tracker-tab-analysis">
    <Panel title="Kinetic modeling" detail="Robust nonlinear fitting · empirical mass-loss kinetics, not cannabinoid assay" className="panel-full"
       action={<button type="button" className="text-button" disabled={!storedReadings.length} onClick={exportCSV}>
        <Download size={14}/> Export CSV</button>}>
      <div className="input-stack">
        {session?.startedAt&&setup&&<KineticChart points={points} startedAt={session.startedAt} fit={kinetics}
          flagged={flagged.map(p=>({timestamp:p.timestamp,weight:p.weightG,
            percent:100*(setup.initialTotalG-p.weightG)/setup.expectedCo2LossG}))}/>}
        {kinetics?.status==='fitted'&&<div className="kinetic-fit-stats" aria-label="Kinetic model statistics">
          <div><span>Best model · AICc</span><strong>{kinetics.model?.replace(/-/g,' ')} · {formatNumber(kinetics.aicc??0,1)}</strong></div>
          <div><span>Effective k</span><strong>{formatNumber(kinetics.kPerHour??0,3)} <small>h⁻¹</small></strong></div>
          <div><span>R² / RMSE</span><strong>{formatNumber(kinetics.rSquared??0,3)} / {formatNumber(kinetics.rmsePercent??0,2)} <small>pp</small></strong></div>
          <div><span>Latest 20% holdout RMSE</span><strong>{kinetics.holdoutRmsePercent===null?'Not enough readings':
            formatNumber(kinetics.holdoutRmsePercent,2)+' pp'}</strong></div>
          <div><span>Shape β / induction</span><strong>{formatNumber(kinetics.shape??1,2)} / {smallTime(kinetics.inductionHours??null)}</strong></div>
          <div><span>Balance rounding σ</span><strong>{kinetics.balanceNoisePp===null?'Not configured':formatNumber(kinetics.balanceNoisePp,3)+' pp'}</strong></div>
          <div><span>Modeled 90%</span><strong>{kinetics.forecast90Hours===null?'Not identifiable':smallTime(kinetics.forecast90Hours)}
            {kinetics.forecast90Range&&<small> 80% model range {smallTime(kinetics.forecast90Range[0])}–{smallTime(kinetics.forecast90Range[1])}</small>}</strong></div>
          <div><span>Modeled 95%</span><strong>{kinetics.forecast95Hours===null?'Not identifiable':smallTime(kinetics.forecast95Hours)}
            {kinetics.forecast95Range&&<small> 80% model range {smallTime(kinetics.forecast95Range[0])}–{smallTime(kinetics.forecast95Range[1])}</small>}</strong></div>
        </div>}
        {kinetics&&kinetics.status!=='fitted'&&<Notice>{kinetics.reason} Kinetic forecasts unlock only when multiple
          time-separated observations establish an identifiable trend.</Notice>}
        {kinetics?.warnings.map(w=><Notice variant="warning" key={w}>{w}</Notice>)}
        <div className="tracker-graph-tabs" role="group" aria-label="Choose additional tracker chart">
          {([
            ['completion','Completion'],['composition','Composition'],['loss','Mass loss'],['rate','Rate'],
          ] as [TrackerGraph,string][]).map(([id,label])=>
            <button type="button" key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}
        </div>
         {setup&&view!=='completion'?<SeriesChart points={points} mode={view} expectedLoss={setup.expectedCo2LossG}/>:
          view==='completion'?<p className="kinetic-secondary-note">Measured apparent conversion and the conditional kinetic fit appear in the main graph above.</p>:
           <Unavailable>Configure the starting sample to view readings.</Unavailable>}
        <Metrics>
          <Metric label="Elapsed" value={smallTime(analytics?.elapsedHours??durationH)}/>
          <Metric label="Readings (raw)" value={storedReadings.length}/>
          <Metric label="Average THC formation" value={analytics?.avgThcRateGph==null?'—':formatNumber(analytics.avgThcRateGph,4)} suffix="g/h"/>
          <Metric label="Latest interval rate" value={analytics?.intervalThcRateGph==null?'—':formatNumber(analytics.intervalThcRateGph,4)} suffix="g/h"/>
          <Metric label="Latest interval" value={smallTime(analytics?.lastIntervalHours??null)}/>
          <Metric label="Linear ETA (descriptive only)" value={smallTime(analytics?.estimatedRemainingHours??null)}/>
        </Metrics>
        {analytics?.massRebound?<Notice variant="warning">The newest weight increased. This may be scale variation or a changed setup; the interval rate is negative. Verify the reading before interpreting trends.</Notice>:null}
          <Notice>Fits compare first-order, stretched exponential, and optional induction models using robust
            residual weighting and small-sample AICc. With at least 12 readings, a time-blocked holdout tests
            the fitted family against later measurements before forecasts are enabled.
            The shaded 80% envelope is a conditional residual-resampling
            model-sensitivity band, <strong>not</strong> a chemical conversion or assay confidence interval.
            When balance readability is provided, independent quantization of the baseline and observation
            supplies a lower noise floor; it does not cover systematic instrument errors.
            Estimated k is empirical for this run, not a temperature-normalized Arrhenius rate constant.
            Variable temperature, volatile loss, heat-up lag, and scale uncertainty may invalidate extrapolation.
            Linear ETA above is a separate naive comparison, not a kinetic prediction.</Notice>
      </div>
    </Panel>

    </section>}
    {tab==='records'&&<section className="tracker-tab-content tracker-records-view"
      id="tracker-panel-records" role="tabpanel" aria-labelledby="tracker-tab-records">
    <Panel title="Measurement log" detail={`${storedReadings.length} timestamped readings · ${flagged.length} flagged · most recent first`} className="panel-full">
       {storedReadings.length ? <>
        <ScrollView className="tracker-table-wrap" orientation="horizontal" viewportLabel="Measurement log columns"><table className="readings-table">
          <thead><tr><th scope="col">#</th><th scope="col">Time</th><th scope="col">Vessel mass</th>
             <th scope="col">Inferred CO₂ loss</th><th scope="col">Apparent %</th><th scope="col">Temp (°C)</th>
             <th scope="col">Note</th><th scope="col">Action</th></tr></thead>
           <tbody>{allMeasurements.map((point,i)=><tr key={point.timestamp} data-flagged={!point.snapshot}>
            <td>{i+1}</td>
            <td>{new Date(point.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
            <td>{formatNumber(point.weightG,4)} g</td>
             <td>{setup?formatNumber(setup.initialTotalG-point.weightG,4)+' g':'—'}</td>
             <td>{point.snapshot?formatNumber(point.snapshot.completion,2)+'%':
               <span className="tracker-invalid-reading">Outside model</span>}</td>
             <td>{point.temperatureC==null?'—':formatNumber(point.temperatureC,1)}</td>
             <td title={point.note??''} className="tracker-note-cell">{point.note||'—'}</td>
             <td><button type="button" className="text-button" aria-label={`Remove reading ${i+1}`}
               disabled={session?.status==='completed'}
               title={session?.status==='completed'?'Reopen the completed run to edit readings':'Delete this measurement'}
               onClick={()=>{if(window.confirm(`Remove reading ${i+1} (${formatNumber(point.weightG,4)} g)?`))ws.removeReading(i);}}>
              <Trash2 size={14}/></button></td>
          </tr>).reverse()}</tbody>
        </table></ScrollView>
         {storedReadings.length>=MAX_TRACKER_READINGS&&<Notice variant="warning">The {MAX_TRACKER_READINGS}-reading limit is reached. Export your results and begin another session; this one remains preserved.</Notice>}
      </> : <Unavailable>Your measurements will appear here as they are recorded.</Unavailable>}
    </Panel>

    </section>}
    {libraryOpen&&<TrackerSessionLibrary sessions={ws.sessions} activeId={ws.activeId}
      onClose={()=>setLibraryOpen(false)}
      onOpen={id=>{ws.selectSession(id);setTab('live');setLibraryOpen(false);}}
      onClone={id=>{ws.cloneSession(id);setTab('setup');setLibraryOpen(false);}}
      onDelete={ws.removeSession} onComplete={ws.markSessionComplete} onReopen={ws.reopenSession}
      onImport={ws.importBackup} saveState={ws.saveState}/>}
  </div>;
}
