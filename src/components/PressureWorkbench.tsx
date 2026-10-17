import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, FlaskConical, Info, RotateCcw, Thermometer, Wind, Grid3x3 } from 'lucide-react';
import { NumberField } from './NumberField';
import { HeadspaceEditor } from './HeadspaceEditor';
import { HEADSPACE_DEFAULTS, resolveHeadspace } from '../lib/headspace';
import { CannabinoidSelector } from './CannabinoidSelector';
import { FieldGrid, Formula, Notice, Selector, Unavailable } from './ui';
import { WorkspaceActions } from './WorkspaceActions';
import { PressureHeatmap } from './PressureHeatmap';
import { asAbsolutePsi, parsePressureReading } from '../lib/pressureTracker';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import { formatNumber, parseAmount, MAX_INPUT } from '../lib/decarb';
import {
  buildPressureHeatmap, computePressure, convertTemp, P_ATM_PSI,
  parseTemperature, type TempUnit,
} from '../lib/pressure';
import {
  cannabinoidChemistry, DEFAULT_ACID_CANNABINOID, isAcidCannabinoid, type AcidCannabinoid,
} from '../lib/cannabinoids';
import './PressureWorkbench.css';

const PRESSURE_DEFAULTS = {
  ...HEADSPACE_DEFAULTS,
  unit:'g' as const, weight:'28',thcaPct:'85',temp:'240',volume:'16',
  tempUnit:'F' as TempUnit,sealTemp:'70',ambientPsi:'14.6959488',
  sealPressure:'14.6959488',sealPressureBasis:'psia' as 'psia' | 'psig',conversionPct:'100',
  cannabinoid: DEFAULT_ACID_CANNABINOID as AcidCannabinoid,
};
const value = (number:number,places=1) => formatNumber(number,places);
const display = (number:number) => String(Number(number.toPrecision(10)));

/**
 * Screening workbench: the pressure field is the product, not an appendix.
 * Exact point at the center; explicit scenario assumptions; no safety bands.
 */
export function PressureWorkbench(){
  const ws=useCalculatorWorkspace('pressure',PRESSURE_DEFAULTS);
  const {weight,thcaPct,temp,volume,tempUnit,sealTemp,ambientPsi,sealPressure,sealPressureBasis,conversionPct,cannabinoid}=ws.values;
  const unit:TempUnit=tempUnit==='C'?'C':'F';
  const validCannabinoid: AcidCannabinoid = isAcidCannabinoid(cannabinoid) ? cannabinoid : DEFAULT_ACID_CANNABINOID;
  const chem = cannabinoidChemistry(validCannabinoid);
  const parsed={
    mass:parseAmount(weight,{max:MAX_INPUT}),
    acid:parseAmount(thcaPct,{max:100}),
    temperature:parseTemperature(temp,unit),
    volume:resolveHeadspace(ws.values,volume,weight),
    seal:parseTemperature(sealTemp,unit),
    ambient:parseAmount(ambientPsi,{min:Number.MIN_VALUE}),
    sealPressure:parsePressureReading(sealPressure),
    conversion:parseAmount(conversionPct,{max:100}),
  };
  const sealAbsolute = parsed.ambient.value!==null && parsed.sealPressure.value!==null
    ? asAbsolutePsi(parsed.sealPressure.value,sealPressureBasis,parsed.ambient.value):null;
  const inputsValid=Object.values(parsed).every(p=>p.value!==null) && sealAbsolute!==null;
  const modelInput=inputsValid?{
      weightG:parsed.mass.value!,thcaPct:parsed.acid.value!,
      tempValue:parsed.temperature.value!,tempUnit:unit,
      headspaceFloz:parsed.volume.value!,sealTempF:convertTemp(parsed.seal.value!,unit,'F'),
      ambientPsi:parsed.ambient.value!,sealPsi:sealAbsolute!,efficiency:parsed.conversion.value!/100,
      cannabinoid:validCannabinoid,
    }:null;
  // 50 closed-form gas-law evaluations are cheaper than memo machinery; every
  // render is directly traceable to current validated inputs with no stale fit.
  const result=modelInput?computePressure(modelInput):null;
  const field=modelInput&&result?buildPressureHeatmap(modelInput):[];
  function changeUnit(next:TempUnit){
    if(next===unit)return;
    const t=parsed.temperature.value,s=parsed.seal.value;
    ws.setFields({tempUnit:next,
      temp:t===null?temp:display(convertTemp(t,unit,next)),
      sealTemp:s===null?sealTemp:display(convertTemp(s,unit,next))});
  }
  function useScenario(nextTemp:number,nextVolume:number){
    ws.setFields({temp:display(nextTemp),headspaceMode:'manual',volume:display(nextVolume)});
  }
  // Exact counterfactuals, not local tangent approximations or vessel ratings.
  const reducedConversion=result?computePressure({
    weightG:parsed.mass.value!,thcaPct:parsed.acid.value!,
    tempValue:parsed.temperature.value!,tempUnit:unit,headspaceFloz:parsed.volume.value!,
    sealTempF:convertTemp(parsed.seal.value!,unit,'F'),
    ambientPsi:parsed.ambient.value!,sealPsi:sealAbsolute!,efficiency:0,cannabinoid:validCannabinoid,
  }):null;
  const higherVolume=result?computePressure({
    weightG:parsed.mass.value!,thcaPct:parsed.acid.value!,
    tempValue:parsed.temperature.value!,tempUnit:unit,
    headspaceFloz:parsed.volume.value!*1.1,
    sealTempF:convertTemp(parsed.seal.value!,unit,'F'),
    ambientPsi:parsed.ambient.value!,sealPsi:sealAbsolute!,efficiency:parsed.conversion.value!/100,cannabinoid:validCannabinoid,
  }):null;
  const tempPlusTen=result?computePressure({
    weightG:parsed.mass.value!,thcaPct:parsed.acid.value!,
    tempValue:parsed.temperature.value!+(unit==='F'?18:10),
    tempUnit:unit,headspaceFloz:parsed.volume.value!,
    sealTempF:convertTemp(parsed.seal.value!,unit,'F'),
    ambientPsi:parsed.ambient.value!,sealPsi:sealAbsolute!,efficiency:parsed.conversion.value!/100,cannabinoid:validCannabinoid,
  }):null;
  return <div className="pressure-workbench">
    <div className="pressure-kpi-strip">
      <div className="pressure-kpi-primary">
        <span><ChartNoAxesCombined size={13}/> MODELED GAUGE PRESSURE</span>
        <div>{result?<><strong>{value(result.pGaugePsi)}</strong><em>PSI</em></>:<strong>-</strong>}</div>
        <small>Relative to entered ambient pressure · idealized, not a safety rating</small>
      </div>
      <div className="pressure-kpi-secondary">
        <div><span>Absolute pressure</span><strong>{result?value(result.pAbsPsi):'-'} <small>PSIA</small></strong></div>
        <div><span>CO2 contribution</span><strong>{result?value(result.pCo2Psi):'-'} <small>PSI</small></strong></div>
        <div><span>Initial trapped gas at process T</span><strong>{result?value(result.pAirPsi):'-'} <small>PSIA</small></strong></div>
      </div>
    </div>

    <div className="pressure-workspace-grid">
      <div className="pressure-landscape-pane">
        {field.length?<PressureHeatmap cells={field} unit={unit}
          currentPsi={result!.pGaugePsi} onUseScenario={useScenario}/>:
          <div className="pressure-field pressure-field-empty">
            <Unavailable>Enter valid positive free-headspace, material, temperature, and model-assumption values to calculate the field.</Unavailable>
          </div>}
      </div>
      <aside className="pressure-controls" id="pressure-parameters" aria-label="Pressure model inputs">
        <header className="pressure-controls-header">
          <div><span className="pressure-eyebrow"><FlaskConical size={13}/> INPUTS</span>
            <h2>Model parameters</h2><p>Updates every cell instantly</p></div>
          <button type="button" className="pressure-mobile-map" onClick={()=>
            document.getElementById('pressure-landscape')?.scrollIntoView({behavior:'smooth',block:'start'})}>
            <Grid3x3 size={13}/> View map
          </button>
          <WorkspaceActions onReset={ws.reset} shareUrl={ws.shareUrl}
            tool="Vessel pressure" result={result?`${value(result.pGaugePsi)} PSI gauge`:null}/>
        </header>
        <div className="pressure-controls-body">
          <Selector label="Temperature scale" value={unit} onChange={changeUnit}
            options={[{value:'F',label:'°F'},{value:'C',label:'°C'}]}/>
          <FieldGrid>
            <NumberField id="pressure-temp" label="Process temperature" value={temp}
              onChange={v=>ws.setField('temp',v)} suffix={`°${unit}`} error={parsed.temperature.error}
              min={unit==='F'?-459.6699:-273.1499}/>
            <NumberField id="pressure-weight" label="Sample mass" value={weight}
              onChange={v=>ws.setField('weight',v)} suffix="g" error={parsed.mass.error}/>
          </FieldGrid>
          <NumberField id="pressure-thca" label={`${chem.acid} fraction`} value={thcaPct}
            onChange={v=>ws.setField('thcaPct',v)} suffix="%" error={parsed.acid.error} max={100}/>
          <HeadspaceEditor manualId="pressure-vol" fields={ws.values} sampleMassG={weight} manualFloz={volume}
            onField={(key,value)=>ws.setFields({[key]:value})} onManual={v=>ws.setField('volume',v)}/>
          <CannabinoidSelector context="pressure" value={validCannabinoid}
             onChange={v=>ws.setField('cannabinoid',v)}/>
          {validCannabinoid!=='THCa'&&<Notice>Stoichiometry uses {chem.acid} → {chem.neutral} + CO2 (Mᴀ {chem.acidMw} g/mol). This changes the assumed CO2 amount; the model does not predict the conversion rate of {chem.acid}.</Notice>}
          <div className="pressure-presets">
            <span className="pressure-small-caption"><Thermometer size={12}/> Process presets</span>
            <div>
              {(unit==='F'?[150,170,200,220,240]:[65,77,93,104,116]).map(t=>
                <button key={t} type="button" onClick={()=>ws.setField('temp',String(t))}
                  aria-pressed={parsed.temperature.value===t}>{t}°</button>)}
            </div>
          </div>
          <details className="pressure-assumptions">
            <summary><Wind size={14}/> Gas / reaction assumptions <span>Editable</span></summary>
            <p>These defaults define the thought experiment. They are not measurements of your actual vessel or a validated operating procedure.</p>
            <FieldGrid>
              <NumberField id="pressure-seal" label="Temperature when sealed" value={sealTemp}
                onChange={v=>ws.setField('sealTemp',v)} suffix={`°${unit}`} error={parsed.seal.error}
                min={unit==='F'?-459.6699:-273.1499}/>
              <NumberField id="pressure-ambient" label="Outside ambient pressure" value={ambientPsi}
                onChange={v=>ws.setField('ambientPsi',v)} suffix="PSIA"
                error={parsed.ambient.error} min={0.000000001}/>
            </FieldGrid>
            <Selector label="Initial pressure reference" value={sealPressureBasis}
              onChange={v=>ws.setFields({sealPressureBasis:v,
                sealPressure:sealAbsolute===null?sealPressure:display(v==='psig'?sealAbsolute-parsed.ambient.value!:sealAbsolute)})}
              options={[{value:'psia',label:'Absolute (PSIA)'},{value:'psig',label:'Gauge / vacuum (PSIG)'}]}/>
            <NumberField id="pressure-start-pressure" label="Initial gas pressure when sealed"
              value={sealPressure} onChange={v=>ws.setField('sealPressure',v)}
              suffix={sealPressureBasis.toUpperCase()} min={sealPressureBasis==='psia'?0:-1e9}
              error={sealAbsolute===null?'Absolute pressure cannot be negative':parsed.sealPressure.error}
              hint="Vacuum is negative PSIG or a positive PSIA value below ambient."/>
            <NumberField id="pressure-conversion" label={`Assumed ${chem.acid} conversion`} value={conversionPct}
              onChange={v=>ws.setField('conversionPct',v)} suffix="%"
              error={parsed.conversion.error} max={100}
              hint="Fraction converted at the modeled instant, not a measured assay"/>
            <button type="button" className="pressure-reset-assumptions" onClick={()=>ws.setFields({
              sealTemp:display(convertTemp(70,'F',unit)),ambientPsi:display(P_ATM_PSI),
               sealPressure:display(P_ATM_PSI),sealPressureBasis:'psia',conversionPct:'100',
            })}><RotateCcw size={12}/> Restore standard assumptions</button>
          </details>
          <div className="pressure-controls-caution"><AlertTriangle size={15}/>
            <span>Model only; not a vessel rating. Verify actual free gas volume. Additional vapors and phase changes are excluded.</span>
          </div>
          <a className="pressure-reference-jump" href="#tool-reference"
            onClick={()=>{const el=document.getElementById('tool-reference');if(el instanceof HTMLDetailsElement)el.open=true;}}>
            <Info size={13}/> Full derivation &amp; limitations <ArrowUpRight size={14}/>
          </a>
        </div>
      </aside>
    </div>

    <section className="pressure-analysis-strip" aria-label="Model diagnostics">
      <div className="pressure-analysis-title"><span className="pressure-eyebrow">DECOMPOSITION / SENSITIVITY</span>
        <h2>What drives the estimate?</h2></div>
      <div className="pressure-analysis-metrics">
        <div><span>{chem.acid} mass</span><strong>{result?value(result.thcaG,3):'-'} <small>g</small></strong></div>
        <div><span>Theoretical CO2 evolved</span><strong>{result?value(result.co2G,3):'-'} <small>g</small></strong></div>
        <div><span>Thermal rise above seal baseline</span><strong>{result?value(result.pThermalGaugePsi):'-'} <small>PSI</small></strong></div>
        <div><span>At 0% conversion</span><strong>{reducedConversion?value(reducedConversion.pGaugePsi):'-'} <small>PSIG</small></strong></div>
      </div>
      {result&&<div className="pressure-sensitivity">
        <span>Local model comparisons</span>
        <p><ArrowDownRight size={13}/> +10% free gas space ⇒ {value((higherVolume?.pGaugePsi??result.pGaugePsi)-result.pGaugePsi,2)} PSI gauge difference</p>
        <p><ArrowUpRight size={13}/> +10°C at fixed conversion ⇒ {value((tempPlusTen?.pGaugePsi??result.pGaugePsi)-result.pGaugePsi,2)} PSI gauge difference</p>
        <small>Exact model recalculations, not uncertainty intervals or safety margins.</small>
      </div>}
        <div className="pressure-equation">
        <Formula>
          <div>P(abs) = P(seal, abs) × T(process) / T(seal) + [m({chem.acid}) × η / M({chem.acid})] × R × T(process) / V(gas)</div>
          <div>P(gauge) = P(abs) − P(ambient)</div>
          <div>Temperatures in kelvin; volumes in cubic metres; η is the assumed conversion fraction. M({chem.acid}) = {chem.acidMw} g/mol; M(CO2) = {chem.co2Mw.toFixed(2)} g/mol. Ideal gas mixture via Dalton's law; fixed free-gas volume and no other volatile contributions.</div>
        </Formula>
      </div>
      <Notice variant="warning">Not a worst-case estimate: evaporation, changing volume, partial CO2 dissolution, thermal gradients, leakage, and vessel mechanics can shift the actual pressure in either direction. Do not use this calculation to certify or select a sealed vessel.</Notice>
    </section>
  </div>;
}
