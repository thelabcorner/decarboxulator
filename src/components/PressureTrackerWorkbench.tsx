import { useMemo } from 'react';
import { Activity, AlertTriangle, Download, ListPlus, RotateCcw, Trash2 } from 'lucide-react';
import { NumberField } from './NumberField';
import { CannabinoidSelector } from './CannabinoidSelector';
import { FieldGrid, Metric, Metrics, Notice, Panel, Selector, Unavailable } from './ui';
import { WorkspaceActions } from './WorkspaceActions';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import { formatNumber, parseAmount } from '../lib/decarb';
import { parseTemperature, toKelvin } from '../lib/pressure';
import { cannabinoidChemistry, DEFAULT_ACID_CANNABINOID } from '../lib/cannabinoids';
import { asAbsolutePsi, parsePressureReading, parseVentLog, parsePressureLog,
  pressureTracker, type VentEvent, type PressureTrackerMode } from '../lib/pressureTracker';
import './PressureTrackerWorkbench.css';

const DEFAULTS = {
  unit:'g' as const,
  cannabinoid:DEFAULT_ACID_CANNABINOID,
  sampleG:'10',acidPercent:'80',headspaceFloz:'16',ambientPsi:'14.6959488',
  pressureBasis:'psia' as 'psia' | 'psig',
  pressureTrackerMode:'seal' as PressureTrackerMode,
  initialPressure:'14.6959488',initialGasTemp:'21',
  currentPressure:'14.6959488',currentGasTemp:'21',
  targetPercent:'90',
  ventAccounting:'counted' as 'counted' | 'recorded',ventCount:'0',
  ventBeforePressure:'16',ventAfterPressure:'14.6959488',
  ventBeforeTemp:'21',ventAfterTemp:'21',
  ventLog:'[]',pressureLog:'[]',
};
const fmt=(n:number,d=2)=>formatNumber(n,d);
const val=(n:number)=>String(Number(n.toPrecision(11)));

function PressureProgressChart({points}:{points:ReturnType<typeof parsePressureLog>}) {
  if(!points?.length) return <Unavailable>Record pressure snapshots to start the chart.</Unavailable>;
  const ordered=[...points].sort((a,b)=>a.timestamp-b.timestamp);
  const first=ordered[0].timestamp,last=ordered.at(-1)!.timestamp;
  const span=last-first;
  const raw=ordered.map(p=>p.apparentPercent);
  const lo=Math.min(0,...raw),hi=Math.max(100,...raw),range=Math.max(1,hi-lo);
  const x=(i:number)=>span>0?50+500*(ordered[i].timestamp-first)/span:
    ordered.length===1?300:50+500*i/(ordered.length-1);
  const y=(value:number)=>160-(value-lo)*130/range;
  return <div className="pressure-tracker-chart-wrap">
    <div className="pressure-tracker-chart-legend"><span className="pressure-tracker-chart-key"/> Apparent CO2-equivalent progress</div>
    <svg viewBox="0 0 600 205" role="img" aria-label={ordered.length+' recorded apparent-conversion observations over time'}>
      {[0,.25,.5,.75,1].map(step=>{
        const value=lo+range*step,Y=y(value);
        return <g key={step}><line x1="50" x2="550" y1={Y} y2={Y} stroke="currentColor" strokeOpacity=".13"/>
          <text x="42" y={Y+4} fontSize="11" textAnchor="end" fill="currentColor">{fmt(value,1)}%</text></g>;
      })}
      {ordered.length>1&&<polyline fill="none" stroke="var(--accent)" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"
        points={ordered.map((point,i)=>x(i)+','+y(point.apparentPercent)).join(' ')}/>}
      {ordered.map((point,i)=><circle key={point.timestamp+'-'+i} cx={x(i)} cy={y(point.apparentPercent)}
        r="3" fill="var(--accent)">
        <title>{new Date(point.timestamp).toLocaleString()}: {fmt(point.apparentPercent,3)}% at {fmt(point.pressureAbsPsi,3)} PSIA</title>
      </circle>)}
      <text x="50" y="193" fontSize="11" fill="currentColor">{new Date(first).toLocaleTimeString()}</text>
      <text x="550" y="193" fontSize="11" fill="currentColor" textAnchor="end">{new Date(last).toLocaleTimeString()}</text>
    </svg>
    <p className="pressure-tracker-help">Observed points only. Connecting lines are visual aids, not kinetic fits or forecasts.</p>
  </div>;
}

export function PressureTrackerWorkbench() {
  const ws=useCalculatorWorkspace('pressure-tracker',DEFAULTS);
  const s=ws.values;
  const chem=cannabinoidChemistry(s.cannabinoid);
  const ambient=parseAmount(s.ambientPsi,{min:Number.MIN_VALUE});
  const sample=parseAmount(s.sampleG,{min:Number.MIN_VALUE});
  const acid=parseAmount(s.acidPercent,{max:100,min:Number.MIN_VALUE});
  const volume=parseAmount(s.headspaceFloz,{min:Number.MIN_VALUE});
  const initialTemp=parseTemperature(s.initialGasTemp,'C');
  const currentTemp=parseTemperature(s.currentGasTemp,'C');
  const initialRaw=parsePressureReading(s.initialPressure);
  const currentRaw=parsePressureReading(s.currentPressure);
  const target=parseAmount(s.targetPercent,{max:100});
  const initialAbs=initialRaw.value===null||ambient.value===null?null:
    asAbsolutePsi(initialRaw.value,s.pressureBasis,ambient.value);
  const currentAbs=currentRaw.value===null||ambient.value===null?null:
    asAbsolutePsi(currentRaw.value,s.pressureBasis,ambient.value);
  const mode=s.pressureTrackerMode;
  const beforeRaw=parsePressureReading(s.ventBeforePressure);
  const afterRaw=parsePressureReading(s.ventAfterPressure);
  const beforeTemp=parseTemperature(s.ventBeforeTemp,'C');
  const afterTemp=parseTemperature(s.ventAfterTemp,'C');
  const beforeAbs=beforeRaw.value===null||ambient.value===null?null:
    asAbsolutePsi(beforeRaw.value,s.pressureBasis,ambient.value);
  const afterAbs=afterRaw.value===null||ambient.value===null?null:
    asAbsolutePsi(afterRaw.value,s.pressureBasis,ambient.value);
  const counted=parseAmount(s.ventCount,{max:500});
  const event:VentEvent|null=beforeAbs===null||afterAbs===null||
    beforeTemp.value===null||afterTemp.value===null ? null : {
      beforePsi:beforeAbs,afterPsi:afterAbs,
      beforeTempC:beforeTemp.value,afterTempC:afterTemp.value,count:1,
    };
  // V cancels from the before/after moles comparison. A temperature-corrected
  // inventory must actually fall before it qualifies as a measured vent.
  const eventValid=event!==null &&
    event.beforePsi/toKelvin(event.beforeTempC,'C') >
    event.afterPsi/toKelvin(event.afterTempC,'C');
  const loggedVents=useMemo(()=>parseVentLog(s.ventLog)??[],[s.ventLog]);
  const readings=useMemo(()=>parsePressureLog(s.pressureLog)??[],[s.pressureLog]);
  const locked=readings.length>0;
  const countedValid=counted.value!==null && Number.isSafeInteger(counted.value);
  const vents:VentEvent[]|null=mode==='seal'?[]:
    s.ventAccounting==='recorded'?loggedVents:
    countedValid && (counted.value===0 || eventValid) ?
      (counted.value===0?[]:[{...event!,count:counted.value!}]):null;
  const valid=sample.value!==null&&acid.value!==null&&volume.value!==null&&
    initialAbs!==null&&currentAbs!==null&&initialTemp.value!==null&&
    currentTemp.value!==null&&target.value!==null&&ambient.value!==null&&vents!==null;
  const result=valid?pressureTracker({
    mode,sampleG:sample.value!,acidPercent:acid.value!,
    headspaceFloz:volume.value!,initialPsi:initialAbs!,initialTempC:initialTemp.value!,
    currentPsi:currentAbs!,currentTempC:currentTemp.value!,targetPercent:target.value!,
    vents:vents!,cannabinoid:s.cannabinoid,
  },ambient.value!):null;

  function setPressureBasis(next:'psia'|'psig') {
    if(next===s.pressureBasis)return;
    const a=ambient.value;
    const patch:Partial<typeof s>={pressureBasis:next};
    if(a!==null) {
      for(const key of ['initialPressure','currentPressure','ventBeforePressure','ventAfterPressure'] as const) {
        const n=parsePressureReading(s[key]).value;
        const absolute=n===null?null:asAbsolutePsi(n,s.pressureBasis,a);
        if(absolute!==null)patch[key]=val(next==='psia'?absolute:absolute-a);
      }
    }
    ws.setFields(patch);
  }
  function addEvent() {
    if(!eventValid||!event||loggedVents.length>=100||mode!=='vent')return;
    ws.setField('ventLog',JSON.stringify([...loggedVents,event]));
  }
  function record() {
    if(!result||currentAbs===null||currentTemp.value===null||readings.length>=200)return;
    ws.setField('pressureLog',JSON.stringify([...readings,{
      timestamp:new Date().getTime(),pressureAbsPsi:currentAbs,tempC:currentTemp.value,
      apparentPercent:result.apparentPercent,ventedMol:result.ventedMol,
    }]));
  }
  function exportCsv() {
    if(!readings.length)return;
    const rows=['time_iso,pressure_abs_psi,temperature_c,apparent_percent,vented_mol',
      ...readings.map(r=>[new Date(r.timestamp).toISOString(),r.pressureAbsPsi,
        r.tempC,r.apparentPercent,r.ventedMol].join(','))];
    const url=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='decarboxulator-pressure-readings.csv';
    document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  const progress=result?result.apparentPercent:null;
  return <div className="pressure-tracker-workbench">
    <header className="pressure-tracker-header">
      <div><span className="pressure-tracker-eyebrow"><Activity size={13}/> CO2-EQUIVALENT PROGRESS</span>
        <h2>{mode==='seal'?'Seal mode':'Vent mode'} / live estimate</h2>
        <p>Pressure measurements, not mass loss. Results are conditional on the gas inventory model.</p></div>
      <WorkspaceActions onReset={ws.reset} shareUrl={ws.shareUrl} tool="Pressure tracker"
        result={result?fmt(result.apparentPercent)+'% apparent progress':null}/>
    </header>
    <div className="pressure-tracker-overview">
      <div className="pressure-tracker-primary">
        <span>APPARENT CONVERSION</span>
        <output aria-live="polite">{progress===null?'—':fmt(progress)}<small>%</small></output>
        <div className="pressure-tracker-progress" role="progressbar"
          aria-label="Apparent progress within theoretical range" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={progress===null?undefined:Math.max(0,Math.min(100,progress))}>
          <div style={{width:String(progress===null?0:Math.max(0,Math.min(100,progress)))+'%'}}/>
        </div>
        <p>{result?.status==='above-theoretical'?'Above the theoretical CO2 capacity — measurement is flagged':
          result?.status==='below-baseline'?'Below initial gas inventory — measurement is flagged':
          'CO2-only ideal-gas interpretation, not assay-confirmed conversion'}</p>
      </div>
      <div className="pressure-tracker-kpis">
        <div><span>Target at current temperature & vent history</span>
          <strong>{result?.targetPressureAbsPsi===null||!result?'—':fmt(result.targetPressureAbsPsi)} <small>PSIA</small></strong>
          <small>{result?.targetPressureGaugePsi!==null&&result?fmt(result.targetPressureGaugePsi)+' PSIG':'Not physically attainable under recorded vent balance'}</small></div>
        <div><span>Observed gas equivalent</span><strong>{result?fmt(result.co2EquivalentG,4):'—'} <small>g CO2 eq.</small></strong></div>
        <div><span>Theoretical maximum</span><strong>{result?fmt(result.theoreticalCo2G,4):'—'} <small>g CO2</small></strong></div>
      </div>
    </div>
    <Notice variant="warning">A hot sealed vessel can rupture without warning. This tracker calculates an idealized gas inventory;
      it cannot establish containment safety, a maximum pressure, or a safe venting practice. Use a purpose-rated,
      independently protected measurement apparatus. Vacuum does not eliminate the danger.</Notice>
    <Panel title="Tracking mode" detail="Choose how gas is accounted for">
      <fieldset className="studio-fieldset" disabled={locked}>
      <Selector label="Method" value={mode} onChange={v=>ws.setField('pressureTrackerMode',v)}
        options={[{value:'seal',label:'Seal · no gas escapes'},{value:'vent',label:'Vent · measured releases'}]}/>
      </fieldset>
      <p className="pressure-tracker-explain">{mode==='seal'
        ? 'No intentional gas release. The observed inventory change is corrected for the initially trapped gas and its initial temperature.'
        : 'Pressure drops must be measured before and after each event. Released gas plus the change in retained gas determines net evolved-gas equivalents.'}</p>
    </Panel>
    <div className="pressure-tracker-columns">
      <Panel title="Starting inventory" detail={locked?'Locked after recording to preserve the interpretation':'Composition and baseline gas conditions'}>
        <fieldset className="studio-fieldset" disabled={locked}>
          <CannabinoidSelector context="tracker" value={s.cannabinoid} onChange={v=>ws.setField('cannabinoid',v)}/>
          <FieldGrid>
            <NumberField label="Material mass" value={s.sampleG} suffix="g"
              onChange={v=>ws.setField('sampleG',v)} error={sample.error} min={0.000001}/>
            <NumberField label={chem.acid+' fraction'} value={s.acidPercent} suffix="%"
              onChange={v=>ws.setField('acidPercent',v)} error={acid.error} max={100}/>
          </FieldGrid>
          <FieldGrid>
            <NumberField label="Free gas headspace" value={s.headspaceFloz} suffix="fl oz"
              onChange={v=>ws.setField('headspaceFloz',v)} error={volume.error} min={0.000001}
              hint="Gas volume, not vessel capacity"/>
            <NumberField label="Surrounding atmosphere" value={s.ambientPsi} suffix="PSIA"
              onChange={v=>ws.setField('ambientPsi',v)} error={ambient.error} min={0.000001}/>
          </FieldGrid>
          <Selector label="Pressure reading reference" value={s.pressureBasis}
            onChange={setPressureBasis}
            options={[{value:'psia',label:'Absolute · PSIA'},{value:'psig',label:'Gauge / vacuum · PSIG'}]}/>
          <FieldGrid>
            <NumberField label="Initial pressure" value={s.initialPressure}
              onChange={v=>ws.setField('initialPressure',v)} suffix={s.pressureBasis.toUpperCase()}
              min={s.pressureBasis==='psia'?0:-1e9}
              error={initialRaw.error??(initialAbs===null?'Negative absolute pressure':null)}
              hint="At the moment the zero-progress baseline is established"/>
            <NumberField label="Initial gas temperature" value={s.initialGasTemp} suffix="°C"
              onChange={v=>ws.setField('initialGasTemp',v)} min={-273.14999} error={initialTemp.error}/>
          </FieldGrid>
          <p className="pressure-tracker-help">A vacuum starting condition is a pressure below local ambient PSIA, or a negative PSIG reading.
            Enter the baseline before measurable CO2 generation.</p>
        </fieldset>
        {locked&&<Notice>Baseline locked while measurements are recorded. Clear the reading history before changing it.</Notice>}
      </Panel>
      <Panel title="Current observation" detail="Enter measured gas pressure and temperature together">
        <FieldGrid>
          <NumberField label="Current pressure" value={s.currentPressure}
            onChange={v=>ws.setField('currentPressure',v)} suffix={s.pressureBasis.toUpperCase()}
            min={s.pressureBasis==='psia'?0:-1e9}
            error={currentRaw.error??(currentAbs===null?'Negative absolute pressure':null)} prominent/>
          <NumberField label="Current gas temperature" value={s.currentGasTemp} suffix="°C"
            onChange={v=>ws.setField('currentGasTemp',v)} min={-273.14999} error={currentTemp.error}/>
        </FieldGrid>
        <NumberField label="Desired apparent completion" value={s.targetPercent} suffix="%"
          onChange={v=>ws.setField('targetPercent',v)} max={100} error={target.error}/>
        {result&&<Metrics>
          <Metric label="Current absolute pressure" value={fmt(currentAbs!,3)} suffix="PSIA"/>
          <Metric label="Retained inventory change" value={fmt(result.retainedChangeMol,6)} suffix="mol"/>
          <Metric label="Pressure readout sensitivity" value={fmt(result.percentagePointsPerPsi,3)} suffix="pp/PSI"/>
          <Metric label="Gas accounted for by vents" value={fmt(result.ventedMol,6)} suffix="mol"/>
        </Metrics>}
        <button type="button" className="tracker-command-primary" onClick={record}
          disabled={!result||readings.length>=200}><ListPlus size={15}/> Record pressure snapshot</button>
        <p className="pressure-tracker-help">A pressure crossing is only meaningful at its stated gas temperature and vent history.
          The target changes as those inputs change.</p>
      </Panel>
    </div>
    {mode==='vent'&&<Panel title="Vented-gas accounting" detail="Count calibrated identical cycles or record individual pressure drops">
      <Selector label="Vent accounting" value={s.ventAccounting} onChange={v=>ws.setField('ventAccounting',v)}
        options={[{value:'counted',label:'Counted identical vents'},{value:'recorded',label:'Measured event log'}]}/>
      <FieldGrid>
        <NumberField label="Immediately before vent" value={s.ventBeforePressure}
          onChange={v=>ws.setField('ventBeforePressure',v)} suffix={s.pressureBasis.toUpperCase()}
          min={s.pressureBasis==='psia'?0:-1e9}
          error={beforeRaw.error??(beforeAbs===null?'Negative absolute pressure':null)}/>
        <NumberField label="Immediately after vent" value={s.ventAfterPressure}
          onChange={v=>ws.setField('ventAfterPressure',v)} suffix={s.pressureBasis.toUpperCase()}
          min={s.pressureBasis==='psia'?0:-1e9}
          error={afterRaw.error??(afterAbs===null?'Negative absolute pressure':null)}/>
      </FieldGrid>
      <FieldGrid>
        <NumberField label="Gas temperature before" value={s.ventBeforeTemp} suffix="°C"
          onChange={v=>ws.setField('ventBeforeTemp',v)} min={-273.14999} error={beforeTemp.error}/>
        <NumberField label="Gas temperature after" value={s.ventAfterTemp} suffix="°C"
          onChange={v=>ws.setField('ventAfterTemp',v)} min={-273.14999} error={afterTemp.error}/>
      </FieldGrid>
      {s.ventAccounting==='counted'
        ? <><NumberField label="Identical vent cycles counted" value={s.ventCount} suffix="vents"
          onChange={v=>ws.setField('ventCount',v)} error={!countedValid?'Enter a whole count from 0 to 500':null} max={500}/>
          <Notice variant="warning">Counting multiplies one temperature-corrected pressure drop by the entered count.
            This is an approximation valid only when all cycles genuinely share the recorded endpoints, volume,
            gas behavior, and no gas is formed or enters during venting.</Notice></>
        : <><button className="tracker-command-secondary" type="button" disabled={!eventValid||loggedVents.length>=100}
          onClick={addEvent}><ListPlus size={14}/> Add measured vent</button>
          <div className="pressure-tracker-events">{loggedVents.map((v,i)=>
            <div key={i}><span>Event {i+1} · {fmt(v.beforePsi,3)} → {fmt(v.afterPsi,3)} PSIA
              · {fmt(v.beforeTempC,1)} → {fmt(v.afterTempC,1)} °C</span>
              <button type="button" aria-label={'Remove vent '+(i+1)} onClick={()=>
                ws.setField('ventLog',JSON.stringify(loggedVents.filter((_,j)=>j!==i)))}><Trash2 size={13}/></button>
            </div>)}</div>
          <p className="pressure-tracker-help">Each event retains its own absolute pressure and temperatures.
            Add each measured release separately; do not assume a valve opening discharges a fixed amount.</p></>}
      {!eventValid&&s.ventAccounting==='recorded'&&<Notice variant="warning">The entered vent must reduce
        temperature-corrected gas inventory. These readings do not describe a measurable gas release.</Notice>}
    </Panel>}
    <Panel title="Recorded pressure history" detail="Saved locally with the current calculator workspace">
      <PressureProgressChart points={readings}/>
      <div className="pressure-tracker-logbar">
        <span>{readings.length} snapshots · {result?.eventCount??0} counted or recorded vents</span>
        <button type="button" disabled={!readings.length} onClick={exportCsv}><Download size={14}/> CSV</button>
        <button type="button" disabled={!readings.length} onClick={()=>{
          if(window.confirm('Clear recorded pressure snapshots? This cannot be undone.')) ws.setField('pressureLog','[]');
        }}><RotateCcw size={14}/> Clear snapshots</button>
      </div>
      {readings.length?<div className="pressure-tracker-history" role="list">
        {readings.slice().reverse().map((r,i)=><div role="listitem" key={r.timestamp+'-'+i}>
          <span>{new Date(r.timestamp).toLocaleString()}</span>
          <strong>{fmt(r.apparentPercent)}%</strong>
          <small>{fmt(r.pressureAbsPsi,3)} PSIA · {fmt(r.tempC,1)}°C</small>
        </div>)}</div>:<Unavailable>Record a pressure snapshot to retain an observed history.</Unavailable>}
    </Panel>
    <section className="pressure-tracker-derivation" aria-label="Calculation methodology">
      <h2><AlertTriangle size={15}/> Interpreting the estimate</h2>
      <p>At fixed gas volume V, retained inventory is n = PV/(RT). Seal mode computes the difference
        between current and starting inventory. Vent mode adds Σ V/R × (Pbefore/Tbefore − Pafter/Tafter),
        with measured absolute P and Kelvin T at each vent. The result divided by the selected
        {chem.acid} theoretical CO2 moles yields an apparent percentage; values outside 0–100%
        are flagged, never silently clipped.</p>
      <p>Any initial air, water vapor, solvents, other evolved gases, leaks, gas uptake or change in
        free headspace can invalidate the CO2-only interpretation. Gas composition and actual
        molecular conversion are not measured. An emergency relief system must never be treated
        as the metering element.</p>
    </section>
  </div>;
}
