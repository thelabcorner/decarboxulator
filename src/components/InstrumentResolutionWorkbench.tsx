import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { CalculatorStudio } from './CalculatorStudio';
import { CannabinoidSelector } from './CannabinoidSelector';
import { HeadspaceEditor } from './HeadspaceEditor';
import { NumberField } from './NumberField';
import { ResolutionSlider } from './ResolutionSlider';
import { WorkspaceActions } from './WorkspaceActions';
import { FieldGrid, Metric, Metrics, Notice, Panel, Selector, Unavailable } from './ui';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import { cannabinoidChemistry, DEFAULT_ACID_CANNABINOID } from '../lib/cannabinoids';
import { FLOZ_TO_M3, R_SI, PSI_PER_PA } from '../lib/pressure';
import { formatNumber, parseAmount } from '../lib/decarb';
import { HEADSPACE_DEFAULTS, resolveHeadspace } from '../lib/headspace';
import { gaugeResolution, scaleResolution } from '../lib/instrumentResolution';

const DEFAULTS={
  unit:'g' as const,
  cannabinoid:DEFAULT_ACID_CANNABINOID,
  sampleG:'10',
  acidPercent:'80',
  minimumPp:'1',
  recommendedPp:'0.1',
  readingIncrement:'0.01',
  observedPercent:'10',
  headspaceFloz:'16',
  initialTempC:'21',
  currentTempC:'110',
  accountingMode:'seal' as 'seal'|'vent',
  ventCount:'1',
  ventBeforeTempC:'110',
  ventAfterTempC:'110',
  ...HEADSPACE_DEFAULTS,
};
function fmt(n:number) {
  if (!Number.isFinite(n)) return '-';
  if (n>0 && n<0.0001) return n.toExponential(3);
  if (n<0.1) return n.toLocaleString('en-US',{maximumSignificantDigits:6});
  return formatNumber(n,5);
}

export function InstrumentResolutionWorkbench({kind}:{kind:'scale'|'gauge'}) {
  const ws=useCalculatorWorkspace(kind+'-resolution',DEFAULTS);
  const s=ws.values;
  const pressure=kind==='gauge';
  const sample=parseAmount(s.sampleG,{min:Number.MIN_VALUE});
  const acid=parseAmount(s.acidPercent,{min:Number.MIN_VALUE,max:100});
  const minimum=parseAmount(s.minimumPp,{min:Number.MIN_VALUE,max:100});
  const recommended=parseAmount(s.recommendedPp,{min:Number.MIN_VALUE,max:100});
  const increment=parseAmount(s.readingIncrement,{min:Number.MIN_VALUE});
  const observed=parseAmount(s.observedPercent,{min:Number.MIN_VALUE,max:100});
  const volume=resolveHeadspace(s,s.headspaceFloz,s.sampleG);
  const initial=parseAmount(s.initialTempC,{min:-273.149999});
  const current=parseAmount(s.currentTempC,{min:-273.149999});
  const ventCount=parseAmount(s.ventCount,{max:500});
  const before=parseAmount(s.ventBeforeTempC,{min:-273.149999});
  const after=parseAmount(s.ventAfterTempC,{min:-273.149999});
  const ventsValid=s.accountingMode==='seal'||(ventCount.value!==null&&
    Number.isSafeInteger(ventCount.value)&&before.value!==null&&after.value!==null);
  const result=useMemo(()=>{
    const common={sampleMassG:sample.value!,acidPercent:acid.value!,minimumTargetPp:minimum.value!,
      recommendedTargetPp:recommended.value!,cannabinoid:s.cannabinoid};
    if(Object.values(common).some(x=>x===null)||!(recommended.value!<minimum.value!))return null;
    if(!pressure) return scaleResolution(common);
    if(volume.value===null||initial.value===null||current.value===null||!ventsValid)return null;
    return gaugeResolution({...common,headspaceFloz:volume.value,
      initialTempC:initial.value,currentTempC:current.value,
      vents:s.accountingMode==='vent'&&ventCount.value!>0?[{
        count:ventCount.value!,beforeTempC:before.value!,afterTempC:after.value!,
      }]:[]});
  },[sample.value,acid.value,minimum.value,recommended.value,s.cannabinoid,pressure,
    volume.value,initial.value,current.value,ventsValid,s.accountingMode,
    ventCount.value,before.value,after.value]);
  const unit=pressure?'PSI':'g';
  const implied=result&&increment.value!==null
    ?result.percentagePointsPerUnit*increment.value:null;
  const name=pressure?'Gauge resolution':'Scale resolution';
  const margin=implied!==null&&implied>0&&observed.value!==null?observed.value/implied:null;
  const minimumMass=margin!==null&&margin>0&&sample.value!==null?sample.value*2/margin:null;
  const clearMass=margin!==null&&margin>0&&sample.value!==null?sample.value*5/margin:null;
  const status=margin===null?null:margin<2?'below':margin<5?'marginal':'clear';
  const statusText=status==='below'?'Below display threshold'
    :status==='marginal'?'Visible with limited margin'
    :status==='clear'?'Clearly within display range':'Enter measurements';
  const possibleSteps=pressure?[0.001,0.01,0.1,1]:[0.0001,0.001,0.01,0.1];
  const signal=result&&observed.value!==null
    ?pressure&&volume.value!==null&&current.value!==null
      ?result.theoreticalCo2G/cannabinoidChemistry(s.cannabinoid).co2Mw
        *observed.value/100*R_SI*(current.value+273.15)/(volume.value*FLOZ_TO_M3)*PSI_PER_PA
      :result.theoreticalCo2G*observed.value/100:null;
  const signalUnit=pressure?'PSI':'g';
  const applyThreshold=(mass:number)=>{
    const quantum=10**(Math.floor(Math.log10(mass))-5);
    const rounded=Math.ceil(mass/quantum+1e-8)*quantum;
    ws.setField('sampleG',String(Number(rounded.toPrecision(8))));
  };
  return <CalculatorStudio name={name} category="Instrumentation" summary="Quantization sensitivity model"
    label="Maximum acceptable display increment" value={result?fmt(result.minimumStep):null} unit={unit}
    note={`At most ${s.minimumPp} percentage point apparent-conversion rounding error, under the stated assumptions`}
    metrics={[
      {label:'Selected display rounding bound',value:implied===null?'-':fmt(implied),unit:'pp'},
      {label:'Expected signal at selected progress',value:signal===null?'-':fmt(signal),unit:signalUnit},
      {label:'2× minimum sample mass',value:minimumMass===null?'-':fmt(minimumMass),unit:'g'},
      {label:'5× clear sample mass',value:clearMass===null?'-':fmt(clearMass),unit:'g'},
    ]}
    overviewExtra={status&&margin!==null&&minimumMass!==null&&clearMass!==null
      ?<div className="instrument-live-status" data-status={status}
          aria-label="Readability of the selected sample and instrument">
        <div className="instrument-live-line" aria-live="polite">
          <span className="instrument-live-state">{statusText}</span>
          <strong>{fmt(margin)}×</strong>
        </div>
        <div className="instrument-live-track" role="img"
          aria-label={'Signal-to-rounding margin: '+fmt(margin)+'. Below 2 is below threshold, 2 to 5 is limited, 5 or higher is clear.'}>
          <span className="instrument-live-fill"
            style={{width:Math.max(0,Math.min(100,margin/8*100))+'%'}}/>
          <span className="instrument-live-threshold" data-mark="2"/>
          <span className="instrument-live-threshold" data-mark="5"/>
        </div>
        <div className="instrument-live-markers">
          <span>0×</span><span>2× · minimum</span><span>5× · clear</span><span>8×+</span>
        </div>
        <div className="instrument-minimums">
          <div className="instrument-minimum">
            <small>Minimum sample · 2×</small>
            <strong>{fmt(minimumMass)} g</strong>
            <button type="button" onClick={()=>applyThreshold(minimumMass)}>Try this mass</button>
          </div>
          <div className="instrument-minimum">
            <small>Clearer signal · 5×</small>
            <strong>{fmt(clearMass)} g</strong>
            <button type="button" onClick={()=>applyThreshold(clearMass)}>Try this mass</button>
          </div>
        </div>
        <span className="instrument-mini-comparison-label">Other display increments · same sample</span>
        <div className="instrument-mini-comparison">
          {possibleSteps.map(step=><div key={step} data-selected={increment.value===step}>
            <strong>{step} {unit}</strong>
            <small>{increment.value!==null?fmt(margin*increment.value/step):'-'}×</small>
          </div>)}
        </div>
      </div>:null}
    input={<Panel title="Instrument selection" detail="Use actual readability, not claimed accuracy"
      action={<WorkspaceActions onReset={ws.reset} shareUrl={ws.shareUrl}
        tool={name} result={result?`Maximum ${fmt(result.minimumStep)} ${unit}`:null}/>}>
      <div className="input-stack">
        <CannabinoidSelector context="tracker" value={s.cannabinoid}
          onChange={v=>ws.setField('cannabinoid',v)}/>
        <div className="instrument-resolution-sliders">
          <ResolutionSlider id="resolution-readability" label="Instrument display increment"
            value={s.readingIncrement} onChange={v=>ws.setField('readingIncrement',v)}
            unit={unit} min={0.00000001} max={1000}
            sliderMin={possibleSteps[0]} sliderMax={possibleSteps[3]} presets={possibleSteps}
            hint="Select a common increment or enter your actual instrument value."/>
          <ResolutionSlider id="resolution-sample" label="Starting sample mass"
            value={s.sampleG} onChange={v=>ws.setField('sampleG',v)}
            unit="g" min={0.000001} max={1000000} sliderMin={0.001} sliderMax={1000}
            mode="log" digits={4}/>
          <ResolutionSlider id="resolution-acid" label={s.cannabinoid+' fraction'}
            value={s.acidPercent} onChange={v=>ws.setField('acidPercent',v)}
            unit="%" min={0.000001} max={100} sliderMin={0.1} sliderMax={100}
            mode="log" digits={3}/>
          <ResolutionSlider id="resolution-observed" label="Reaction progress to observe"
            value={s.observedPercent} onChange={v=>ws.setField('observedPercent',v)}
            unit="%" min={0.000001} max={100} sliderMin={1} sliderMax={100} digits={3}/>
        </div>
        {pressure&&<>
          <HeadspaceEditor fields={s} sampleMassG={s.sampleG} manualFloz={s.headspaceFloz}
            onField={(key,value)=>ws.setFields({[key]:value})}
            onManual={v=>ws.setField('headspaceFloz',v)}/>
          <div className="instrument-resolution-sliders">
            <div className="instrument-slider-pair">
              <ResolutionSlider id="resolution-initial-temp" label="Initial gas temperature"
                value={s.initialTempC} unit="°C" onChange={v=>ws.setField('initialTempC',v)}
                min={-273.14} max={1000} sliderMin={-20} sliderMax={200} digits={3}/>
              <ResolutionSlider id="resolution-current-temp" label="Observed gas temperature"
                value={s.currentTempC} unit="°C" onChange={v=>ws.setField('currentTempC',v)}
                min={-273.14} max={1000} sliderMin={-20} sliderMax={250} digits={3}/>
            </div>
          </div>
          <Selector label="Gas accounting" value={s.accountingMode}
            onChange={v=>ws.setField('accountingMode',v)}
            options={[{value:'seal',label:'Seal'},{value:'vent',label:'Vent'}]}/>
          {s.accountingMode==='vent'&&<>
            <FieldGrid>
              <NumberField id="resolution-vent-count" label="Accounted vent cycles" value={s.ventCount}
                onChange={v=>ws.setField('ventCount',v)} suffix="vents"
                error={!ventsValid?'Enter an integer from 0 to 500':null}/>
              <div className="instrument-method-detail">Worst-case bound includes the pressure measured before and after each event.
                Identical counted endpoints are conservatively counted once per cycle.</div>
            </FieldGrid>
            <FieldGrid>
              <NumberField id="resolution-vent-before" label="Gas temperature before vent" value={s.ventBeforeTempC}
                onChange={v=>ws.setField('ventBeforeTempC',v)} suffix="°C" error={before.error} min={-273.149999}/>
              <NumberField id="resolution-vent-after" label="Gas temperature after vent" value={s.ventAfterTempC}
                onChange={v=>ws.setField('ventAfterTempC',v)} suffix="°C" error={after.error} min={-273.149999}/>
            </FieldGrid>
          </>}
        </>}
        <div className="instrument-section-label">Planning tolerance <small>Apparent completion, percentage points</small></div>
        <FieldGrid>
          <NumberField id="resolution-minimum" label="Minimum specification target" value={s.minimumPp}
            onChange={v=>ws.setField('minimumPp',v)} suffix="pp" error={minimum.error}/>
          <NumberField id="resolution-recommended" label="Recommended target" value={s.recommendedPp}
            onChange={v=>ws.setField('recommendedPp',v)} suffix="pp"
            error={recommended.error??(recommended.value!==null&&minimum.value!==null&&
              recommended.value>=minimum.value?'Must be below the minimum target':null)}/>
        </FieldGrid>
      </div>
    </Panel>}
    output={<Panel title="Readability requirements" detail="Worst-case rounding model for the listed readings">
      {result?<>
        <Metrics>
          <Metric label="Maximum permissible increment" value={fmt(result.minimumStep)} suffix={unit} accent/>
          <Metric label="Recommended increment" value={fmt(result.recommendedStep)} suffix={unit}/>
          <Metric label="Expected CO2 mass" value={fmt(result.theoreticalCo2G)} suffix="g"/>
          <Metric label={`Sensitivity per 1 ${unit} readout step`}
            value={fmt(result.percentagePointsPerUnit)} suffix="pp"/>
          <Metric label="Your instrument step" value={increment.value===null?'-':fmt(increment.value)} suffix={unit}/>
          <Metric label="Your instrument worst-case bound" value={implied===null?'-':fmt(implied)} suffix="pp"/>
        </Metrics>
        {implied!==null&&<Notice>{implied<=recommended.value!
          ?'The entered display increment satisfies the stricter, user-selected recommendation.'
          :implied<=minimum.value!
          ?'The entered display increment meets the minimum target, but not the recommended target.'
          :'The entered display increment is coarser than the selected minimum target.'}</Notice>}
        <Notice>{pressure
          ?'PSIA and PSIG readings have identical increments. The estimate includes initial and current pressure rounding plus entered vent endpoints, assuming equal fixed headspace. Pressure drift, temperature errors, sensor accuracy, repeatability, calibration, and gas composition are not included.'
          :'Based on the difference between two displayed vessel masses. Tare and sample must be measured consistently. Display increment is not accuracy, repeatability, thermal drift, or chemical specificity.'}</Notice>
        <p className="instrument-related">These default 1 pp and 0.1 pp targets are editable planning conventions, not universal laboratory requirements.
          The gauge finder uses the dry ideal-gas sensitivity; optional Henry-law absorption changes that sensitivity and is not included here.
          For the operating model, open the <Link to={pressure?'/tools/pressure-tracker':'/tools/decarb-tracker'}>
          {pressure?'Pressure tracker':'Progress tracker'}</Link>.</p>
      </>:<Unavailable>Enter valid positive sample, target, and measurement inputs.</Unavailable>}
    </Panel>}
  />;
}
