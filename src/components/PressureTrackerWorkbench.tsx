import { useMemo } from 'react';
import { Activity, AlertTriangle, Download, ListPlus, RotateCcw, Trash2 } from 'lucide-react';
import { HeadspaceEditor } from './HeadspaceEditor';
import { MathEquation } from './MathNotation';
import {Co2DissolutionEditor, CO2_DISSOLUTION_DEFAULTS, getDissolution} from './Co2DissolutionEditor';
import { HEADSPACE_DEFAULTS, resolveHeadspace } from '../lib/headspace';
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
  ...HEADSPACE_DEFAULTS,
  ...CO2_DISSOLUTION_DEFAULTS,
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
  const volume=resolveHeadspace(s,s.headspaceFloz,s.sampleG);
  const dissolution=getDissolution(s);
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
    currentTemp.value!==null&&target.value!==null&&ambient.value!==null&&vents!==null&&
    (s.co2Dissolution==='off'||dissolution.value!==null);
  const result=valid?pressureTracker({
    mode,sampleG:sample.value!,acidPercent:acid.value!,
    headspaceFloz:volume.value!,initialPsi:initialAbs!,initialTempC:initialTemp.value!,
    currentPsi:currentAbs!,currentTempC:currentTemp.value!,targetPercent:target.value!,
    vents:vents!,cannabinoid:s.cannabinoid,
    ...(dissolution.value?{dissolution:dissolution.value}:{}),
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
      <div className="pressure-tracker-toolbar-heading">
        <span className="pressure-tracker-eyebrow"><Activity size={13}/> Measurement workspace</span>
        <small>{locked?'Baseline locked · clear history to edit':mode==='seal'?'Closed gas balance · temperature corrected':'Retained + vented gas · temperature corrected'}</small>
      </div>
      <fieldset className="studio-fieldset pressure-tracker-method" disabled={locked}>
        <Selector label="Accounting mode" value={mode}
          onChange={v=>ws.setField('pressureTrackerMode',v)}
          options={[{value:'seal',label:'Seal'},{value:'vent',label:'Vent'}]}/>
      </fieldset>
      <WorkspaceActions onReset={ws.reset} shareUrl={ws.shareUrl} tool="Pressure tracker"
        result={result?fmt(result.apparentPercent)+'% apparent progress':null}/>
    </header>
    <div className="pressure-tracker-overview">
      <div className="pressure-tracker-primary">
        <span>APPARENT CONVERSION</span>
        <output aria-live="polite">{progress===null?'-':fmt(progress)}<small>%</small></output>
        <div className="pressure-tracker-progress" role="progressbar"
          aria-label="Apparent progress within theoretical range" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={progress===null?undefined:Math.max(0,Math.min(100,progress))}>
          <div style={{width:String(progress===null?0:Math.max(0,Math.min(100,progress)))+'%'}}/>
        </div>
        <p>{result?.status==='above-theoretical'?'Above theoretical CO2 capacity. Measurement flagged':
          result?.status==='below-baseline'?'Below initial gas inventory. Measurement flagged':
          'CO2-only ideal-gas interpretation, not assay-confirmed conversion'}</p>
      </div>
      <div className="pressure-tracker-kpis">
        <div><span>Target pressure · current state</span>
          <strong>{result?.targetPressureAbsPsi===null||!result?'-':fmt(result.targetPressureAbsPsi)} <small>PSIA</small></strong>
          <small>{result?.targetPressureGaugePsi!==null&&result?fmt(result.targetPressureGaugePsi)+' PSIG':'Not physically attainable under recorded vent balance'}</small></div>
        <div><span>Observed gas equivalent</span><strong>{result?fmt(result.co2EquivalentG,4):'-'} <small>g CO2 eq.</small></strong></div>
        <div><span>Theoretical maximum</span><strong>{result?fmt(result.theoreticalCo2G,4):'-'} <small>g CO2</small></strong></div>
      </div>
    </div>
    <div className="pressure-tracker-model-limits">
      <AlertTriangle size={14} aria-hidden="true"/>
      <span>Model estimate only · not a pressure rating. Sealed heated vessels can rupture.</span>
      <details><summary>Assumptions &amp; limitations</summary>
        <p>{mode==='seal'
          ? 'No intentional gas release; initial trapped gas is temperature corrected.'
          : 'Vents require before/after pressure and temperature measurements. All releases must be accounted for.'}
          The model excludes unmeasured vapor, leaks, changing gas volume and structural failure. A vacuum baseline
          does not make a heated sealed vessel safe.</p>
      </details>
    </div>
    <div className="pressure-tracker-columns">
      <Panel title="Run setup" detail={locked?'Baseline locked while snapshots exist':'Initial sample, vessel, and gas baseline'}>
        <fieldset className="studio-fieldset" disabled={locked}>
          <CannabinoidSelector context="tracker" value={s.cannabinoid} onChange={v=>ws.setField('cannabinoid',v)}/>
          <FieldGrid>
            <NumberField label="Material mass" value={s.sampleG} suffix="g"
              onChange={v=>ws.setField('sampleG',v)} error={sample.error} min={0.000001}/>
            <NumberField label={chem.acid+' fraction'} value={s.acidPercent} suffix="%"
              onChange={v=>ws.setField('acidPercent',v)} error={acid.error} max={100}/>
          </FieldGrid>
          <Co2DissolutionEditor fields={s} disabled={locked}
            onChange={(key,value)=>ws.setFields({[key]:value})}/>
          <HeadspaceEditor fields={s} sampleMassG={s.sampleG} manualFloz={s.headspaceFloz}
            onField={(key,value)=>ws.setFields({[key]:value})} onManual={v=>ws.setField('headspaceFloz',v)}
            disabled={locked}/>
          <details className="pressure-tracker-gas-baseline" open>
            <summary>Initial gas conditions <span>vacuum / ambient</span></summary>
          <NumberField label="Surrounding atmosphere" value={s.ambientPsi} suffix="PSIA"
            onChange={v=>ws.setField('ambientPsi',v)} error={ambient.error} min={0.000001}/>
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
          <p className="pressure-tracker-help">Negative PSIG denotes vacuum relative to local atmosphere. Baseline must precede measurable CO2 generation.</p>
          </details>
        </fieldset>
        {locked&&<Notice>Baseline locked while measurements are recorded. Clear the reading history before changing it.</Notice>}
      </Panel>
      <Panel title="Live observation" detail="Measured pressure and gas temperature">
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
          {s.co2Dissolution==='on'&&<Metric label="CO2 dissolved at equilibrium" value={fmt(result.dissolvedCo2Mol,6)} suffix="mol"/>}
        </Metrics>}
        <button type="button" className="tracker-command-primary" onClick={record}
          disabled={!result||readings.length>=200}><ListPlus size={15}/> Record pressure snapshot</button>
        <p className="pressure-tracker-help">Pressure targets depend on the gas temperature, baseline and vent history.
          {s.co2Dissolution==='on'&&mode==='vent'?' Assumes no further venting beyond the recorded events.':''}</p>
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
    <details className="pressure-tracker-derivation" aria-label="Calculation methodology">
      <summary><AlertTriangle size={15}/> Calculation method &amp; interpretation</summary>
      <MathEquation compact label="01 / GAS INVENTORY"
        tex={String.raw`n_{g,t}=\frac{P_tV_g}{RT_t}\qquad n_{g,0}=\frac{P_0V_g}{RT_0}`}
        caption="Temperature-corrected initial and current total gas inventory at fixed headspace."/>
      <MathEquation compact label="02 / VENT MASS BALANCE"
        tex={String.raw`n_{\mathsf{generated}}=n_{g,t}-n_{g,0}+\sum_j\frac{V_g}{R}\left(\frac{P_{j,b}}{T_{j,b}}-\frac{P_{j,a}}{T_{j,a}}\right)`}
        caption="Measured before/after vent pressures and temperatures. Counted cycles approximate repeated identical events."/>
      {s.co2Dissolution==='on'&&<MathEquation compact label="03 / DISSOLVED CARBON DIOXIDE"
        tex={String.raw`\begin{aligned}P_{\mathsf{CO_2}}&=P_{\mathsf{total}}-P_{\mathsf{inert}}\\n_{\mathsf{diss}}&=k_HV_{\ell}\frac{P_{\mathsf{CO_2}}}{P_{\mathsf{atm}}}\end{aligned}`}
        caption="Optional equilibrium correction with inferred CO2 partial pressure; no gas analyzer is required."/>}
      <p>The derived gas equivalent is divided by the selected {chem.acid} theoretical CO2 capacity to estimate apparent completion. Results outside 0 to 100% are flagged rather than clipped. Short, well-mixed vents are assumed to reduce all gas species proportionally. Significant dissolution, exsolution, gas production or inflow during a vent cannot be resolved by the pressure drop alone.</p>
      <p>Any initial air, water vapor, solvents, other evolved gases, leaks, gas uptake or change in
        free headspace can invalidate the CO2-only interpretation. Gas composition and actual
        molecular conversion are not measured. An emergency relief system must never be treated
        as the metering element.</p>
    </details>
  </div>;
}
