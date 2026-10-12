import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Copy } from 'lucide-react';
import { NumberField } from './NumberField';
import { MassBalance } from './MassBalance';
import { CalculatorStudio } from './CalculatorStudio';
import { WorkspaceActions } from './WorkspaceActions';
import { FieldGrid, Formula, Metric, Metrics, Notice, Panel, PrimaryResult, Selector, Unavailable, UnitSelector } from './ui';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import {
  MAX_INPUT, MW_THCA, MW_THC, CONVERSION_RATIO, CO2_RATIO, UNITS, analyzeMassLoss,
  calculateBatch, convert, formatAmount, formatNumber, parseAmount,
  type Direction, type UnitKey,
} from '../lib/decarb';

type MassFields = { unit: UnitKey; amount: string };
const CONVERSION_DEFAULTS: MassFields & {direction: Direction} = {unit:'g',amount:'10',direction:'decarb'};
const REVERSE_CONVERSION_DEFAULTS: typeof CONVERSION_DEFAULTS = {...CONVERSION_DEFAULTS,direction:'reverse'};
const DIRECTION_ENTRY_FIELDS = ['direction'] as const;
const CONVERSION_PRESETS: Record<UnitKey, Record<Direction, readonly number[]>> = {
  mg: {decarb:[100,1000,5000,10000,50000],reverse:[100,1000,5000,8772.3,87723]},
  g: {decarb:[1,10,50,100,1000],reverse:[1,10,50,87.723,877.23]},
  kg: {decarb:[0.001,0.01,0.05,0.1,1],reverse:[0.001,0.01,0.05,0.087723,0.87723]},
};
const BATCH_DEFAULTS: MassFields & {percent:string} = {unit:'g',amount:'100',percent:'85'};
const ANALYZER_DEFAULTS: MassFields & {final:string} = {unit:'g',amount:'50',final:'46.25'};

function CopyResult({value}: {value:string}) {
  const [copied, setCopied] = useState(false);
  return <button className="text-button" type="button" title="Copy result" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(()=>setCopied(false),1800); }
    catch { setCopied(false); }
  }}><Copy size={13}/>{copied ? 'Copied' : 'Copy'}</button>;
}

export function ConversionCalculator({entryDirection}: {entryDirection?: Direction}) {
  const navigate = useNavigate();
  const workspace = useCalculatorWorkspace(
    'conversion',
    entryDirection === 'reverse' ? REVERSE_CONVERSION_DEFAULTS : CONVERSION_DEFAULTS,
    {entryFields: DIRECTION_ENTRY_FIELDS},
  );
  const {unit,amount,direction} = workspace.values;
  const parsed = useMemo(()=>parseAmount(amount),[amount]);
  const grams = parsed.value === null ? null : parsed.value * UNITS[unit].toGrams;
  const result = useMemo(() => grams === null ? null : convert(grams, direction), [grams,direction]);
  const isDecarb = direction === 'decarb';
  function changeDirection(next: Direction) {
    if (next === direction) return;
    if (entryDirection !== undefined) {
      // Both sidebar entries lead to the same workbench. Preserve the inputs
      // when changing direction, but let the route identify the active mode.
      void navigate({
        to: next === 'decarb' ? '/tools/thca-to-thc' : '/tools/thc-to-thca',
        search: {unit, amount, direction: next},
      });
    } else workspace.setField('direction', next);
  }
  return (
    <CalculatorStudio name={isDecarb ? 'THCa → THC' : 'THC → THCa'} category="Stoichiometry"
      summary="Molecular mass model" label={isDecarb ? 'Theoretical THC produced' : 'Equivalent starting THCa'}
      value={result ? formatAmount(result.outputGrams,unit) : null} unit={unit}
      note={isDecarb ? 'Assumes complete conversion' : 'Target mass equivalent, not a reverse reaction'}
      metrics={[
        {label:'CO2 difference', value:result ? formatAmount(result.co2Grams,unit) : '—',unit},
        {label:'Conversion factor',value:formatNumber(CONVERSION_RATIO*100,3),unit:'%'},
      ]}
      input={<Panel title="Input parameters" detail="Starting or target mass" action={<WorkspaceActions onReset={workspace.reset} shareUrl={workspace.shareUrl} tool={isDecarb ? 'THCa → THC conversion' : 'THC → THCa planning'} result={result ? `${formatAmount(result.outputGrams,unit)} ${unit}` : null}/>}>
        <div className="input-stack">
          <Selector label="Calculation mode" value={direction} onChange={changeDirection} options={[
            {value:'decarb',label:'THCa → THC'}, {value:'reverse',label:'THC → THCa'},
          ]}/>
          <FieldGrid>
            <NumberField id="convert-amount" label={isDecarb ? 'Starting THCa mass' : 'Target THC mass'}
              value={amount} onChange={value=>workspace.setField('amount',value)} error={parsed.error} suffix={UNITS[unit].label} max={MAX_INPUT} prominent/>
            <UnitSelector value={unit} onChange={value=>workspace.setMassUnit(value,['amount'])}/>
          </FieldGrid>
          <div className="preset-section">
            <span className="small-label">Quick values</span>
            <div className="preset-row">
              {CONVERSION_PRESETS[unit][direction].map(value => <button type="button" className="preset" key={value} onClick={()=>workspace.setField('amount',String(value))}>{value} {unit}</button>)}
            </div>
          </div>
          <div className="formula-box">
            <span className="small-label">Molecular ratio</span>
            <Formula>{isDecarb ? 'm(THC) = m(THCa) × ' : 'm(THCa) = m(THC) ÷ '}<strong>{CONVERSION_RATIO.toFixed(5)}</strong></Formula>
             <span className="fine-print">358.47 g/mol THCa · 314.46 g/mol THC</span>
          </div>
        </div>
      </Panel>}
      output={<Panel title="Calculated output" detail="Computed from the entered mass"
        action={result ? <CopyResult value={`${formatAmount(result.outputGrams,unit)} ${unit}`}/> : undefined}>
        {result ? <>
          <PrimaryResult label={isDecarb ? 'Theoretical THC produced' : 'Equivalent starting THCa'} value={formatAmount(result.outputGrams,unit)} unit={unit}
            note={isDecarb ? 'Assumes complete stoichiometric conversion' : 'Mass-equivalence calculation, not a reverse chemical reaction'}/>
          <MassBalance retained={isDecarb ? result.outputGrams : grams!} released={result.co2Grams}
            retainedLabel="THC-equivalent mass" releasedLabel="CO2 mass fraction"/>
          <Metrics>
            <Metric label="CO2 released" value={formatAmount(result.co2Grams,unit)} suffix={unit}/>
            <Metric label="THCa mass retained as THC" value={formatNumber(CONVERSION_RATIO*100,3)} suffix="%"/>
            <Metric label="CO2 mass fraction" value={formatNumber(CO2_RATIO*100,3)} suffix="%"/>
            <Metric label="Molar mass difference" value={formatNumber(MW_THCA-MW_THC,4)} suffix="g/mol"/>
          </Metrics>
          <Notice>{isDecarb ? 'Theoretical maximum. Conversion kinetics, side reactions, and process losses are not modeled.' : 'This estimates the THCa mass needed to yield a target THC mass at complete conversion; THC cannot be chemically reverted to THCa by this calculation.'}</Notice>
        </> : <Unavailable>Enter a valid amount to calculate a result.</Unavailable>}
      </Panel>}
    />
  );
}

export function BatchCalculator() {
  const workspace = useCalculatorWorkspace('batch',BATCH_DEFAULTS);
  const {unit,amount,percent} = workspace.values;
  const parsed = useMemo(()=>parseAmount(amount),[amount]);
  const grams = parsed.value === null ? null : parsed.value * UNITS[unit].toGrams;
  const parsedPercent = useMemo(()=>parseAmount(percent,{max:100}),[percent]);
  const result = useMemo(()=>grams===null || parsedPercent.value===null ? null : calculateBatch(grams,parsedPercent.value),[grams,parsedPercent.value]);
  return (
    <CalculatorStudio name="Batch yield" category="Production" summary="Complete conversion model"
      label="Potential THC produced" value={result ? formatAmount(result.thcGrams,unit) : null}
      unit={unit} note="Starting batch, THCa composition and theoretical CO2 loss"
      metrics={[
        {label:'Final batch mass',value:result?formatAmount(result.finalWeightGrams,unit):'—',unit},
        {label:'Final THC fraction',value:result?formatNumber(result.finalThcPercent,2):'—',unit:'%'},
      ]}
      input={<Panel title="Batch parameters" detail="Starting mass and THCa fraction" action={<WorkspaceActions onReset={workspace.reset} shareUrl={workspace.shareUrl} tool="Batch yield" result={result ? `${formatAmount(result.thcGrams,unit)} ${unit} THC` : null}/>}>
        <div className="input-stack">
          <FieldGrid>
            <NumberField id="batch-mass" label="Starting batch mass" value={amount} onChange={value=>workspace.setField('amount',value)} error={parsed.error} suffix={unit} prominent/>
            <UnitSelector value={unit} onChange={value=>workspace.setMassUnit(value,['amount'])}/>
          </FieldGrid>
          <NumberField id="batch-percent" label="THCa content" value={percent} onChange={value=>workspace.setField('percent',value)} suffix="%" max={100} error={parsedPercent.error}
            hint="Initial mass percentage measured before heating"/>
          <div className="formula-box">
            <span className="small-label">Calculation method</span>
            <Formula>m(THC) = m(batch) × THCa% × {CONVERSION_RATIO.toFixed(5)}</Formula>
            <span className="fine-print">Only the CO2 released from THCa conversion is subtracted.</span>
          </div>
        </div>
      </Panel>}
      output={<Panel title="Theoretical batch yield" detail="Mass balance after complete conversion">
        {result ? <>
          <PrimaryResult label="Potential THC produced" value={formatAmount(result.thcGrams,unit)} unit={unit}/>
          <MassBalance retained={result.finalWeightGrams} released={result.co2Grams}
            retainedLabel="Final batch" releasedLabel="CO2 released"/>
          <Metrics>
            <Metric label="THCa before heating" value={formatAmount(result.thcaGrams,unit)} suffix={unit}/>
            <Metric label="CO2 released" value={formatAmount(result.co2Grams,unit)} suffix={unit}/>
            <Metric label="Final batch mass" value={formatAmount(result.finalWeightGrams,unit)} suffix={unit}/>
            <Metric label="Final THC concentration" value={formatNumber(result.finalThcPercent,2)} suffix="%" accent/>
          </Metrics>
          <Notice>Assumes non-THCa mass remains unchanged, no pre-existing THC, complete conversion, and no other volatile losses.</Notice>
        </> : <Unavailable>Enter a valid batch mass and THCa percentage.</Unavailable>}
      </Panel>}
    />
  );
}

export function AnalyzerCalculator() {
  const workspace = useCalculatorWorkspace('analysis',ANALYZER_DEFAULTS);
  const {unit,amount,final} = workspace.values;
  const parsed = useMemo(()=>parseAmount(amount),[amount]);
  const grams = parsed.value === null ? null : parsed.value * UNITS[unit].toGrams;
  const finalParsed = useMemo(()=>parseAmount(final),[final]);
  const finalGrams = finalParsed.value===null ? null : finalParsed.value*UNITS[unit].toGrams;
  const result = useMemo(()=>grams===null || finalGrams===null ? null : analyzeMassLoss(grams,finalGrams),[grams,finalGrams]);
  const impossible = grams!==null && finalGrams!==null && !result;
  return (
    <CalculatorStudio name="THCa analyzer" category="Analytical estimate"
      summary="CO2-only loss assumption" label="Estimated initial THCa"
      value={result?formatNumber(result.thcaPercent,2):null} unit="%"
      note="Mass-loss estimate only; not a measured potency assay"
      metrics={[
        {label:'Observed loss',value:result?formatAmount(result.lossGrams,unit):'—',unit},
        {label:'THC produced',value:result?formatAmount(result.thcGrams,unit):'—',unit},
      ]}
      input={<Panel title="Gravimetric inputs" detail="Starting mass and remaining mass" action={<WorkspaceActions onReset={workspace.reset} shareUrl={workspace.shareUrl} tool="THCa mass-loss analysis" result={result ? `${formatNumber(result.thcaPercent,2)}% THCa` : null}/>}>
        <div className="input-stack">
          <FieldGrid>
            <NumberField id="analyzer-start" label="Initial sample mass" value={amount} onChange={value=>workspace.setField('amount',value)} error={parsed.error} suffix={unit} prominent/>
            <UnitSelector value={unit} onChange={value=>workspace.setMassUnit(value,['amount','final'])}/>
          </FieldGrid>
          <NumberField id="analyzer-final" label="Final sample mass" value={final} onChange={value=>workspace.setField('final',value)} error={finalParsed.error} suffix={unit}/>
          <div className="formula-box">
            <span className="small-label">Mass balance</span>
            <Formula>THCa = (initial mass − final mass) ÷ {CO2_RATIO.toFixed(5)}</Formula>
            <span className="fine-print">Valid only when the measured loss is attributable to CO2 from THCa.</span>
          </div>
        </div>
      </Panel>}
      output={<Panel title="Composition estimate" detail="Assumes all lost mass was CO2">
        {result ? <>
          <PrimaryResult label="Estimated original THCa" value={formatNumber(result.thcaPercent,2)} unit="%"/>
          <Metrics>
            <Metric label="THCa in original sample" value={formatAmount(result.thcaGrams,unit)} suffix={unit}/>
            <Metric label="THC after conversion" value={formatAmount(result.thcGrams,unit)} suffix={unit}/>
            <Metric label="Observed mass loss" value={formatAmount(result.lossGrams,unit)} suffix={unit}/>
            <Metric label="Estimated final THC %" value={formatNumber(result.thcPercentAfter,2)} suffix="%"/>
          </Metrics>
          <Notice variant="warning">This is not a validated potency assay. Water, terpenes, solvents, other acidic cannabinoids, and incomplete reaction all confound a mass-loss estimate. Never assume all lost mass is CO2.</Notice>
        </> : <Unavailable>{impossible ? 'The mass change cannot be explained by the THCa → THC reaction alone. Check sample values and other volatile losses.' : 'Enter initial and final sample weights to estimate composition.'}</Unavailable>}
      </Panel>}
    />
  );
}

export { EdibleWorkbench as EdiblesCalculator } from './EdibleWorkbench';
