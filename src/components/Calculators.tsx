import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Copy } from 'lucide-react';
import { NumberField } from './NumberField';
import { MassBalance } from './MassBalance';
import { CalculatorStudio } from './CalculatorStudio';
import { WorkspaceActions } from './WorkspaceActions';
import { CannabinoidSelector } from './CannabinoidSelector';
import { FieldGrid, Formula, Metric, Metrics, Notice, Panel, PrimaryResult, Selector, Unavailable, UnitSelector } from './ui';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import { cannabinoidChemistry, DEFAULT_ACID_CANNABINOID, type AcidCannabinoid } from '../lib/cannabinoids';
import {
  MAX_INPUT, UNITS, analyzeMassLoss, calculateBatch, convert,
  formatAmount, formatNumber, parseAmount,
  type Direction, type UnitKey,
} from '../lib/decarb';

type MassFields = { unit: UnitKey; amount: string; cannabinoid: AcidCannabinoid };
const CONVERSION_DEFAULTS: MassFields & {direction: Direction} = {
  unit:'g',amount:'10',direction:'decarb',cannabinoid:DEFAULT_ACID_CANNABINOID,
};
const REVERSE_CONVERSION_DEFAULTS: typeof CONVERSION_DEFAULTS = {...CONVERSION_DEFAULTS,direction:'reverse'};
const DIRECTION_ENTRY_FIELDS = ['direction'] as const;
const CONVERSION_PRESETS: Record<UnitKey, Record<Direction, readonly number[]>> = {
  mg: {decarb:[100,1000,5000,10000,50000],reverse:[100,1000,5000,10000,50000]},
  g: {decarb:[1,10,50,100,1000],reverse:[1,10,50,100,1000]},
  kg: {decarb:[0.001,0.01,0.05,0.1,1],reverse:[0.001,0.01,0.05,0.1,1]},
};
const BATCH_DEFAULTS: MassFields & {percent:string} = {
  unit:'g',amount:'100',percent:'85',cannabinoid:DEFAULT_ACID_CANNABINOID,
};
const ANALYZER_DEFAULTS: MassFields & {final:string} = {
  unit:'g',amount:'50',final:'46.25',cannabinoid:DEFAULT_ACID_CANNABINOID,
};

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
  const {unit,amount,direction,cannabinoid} = workspace.values;
  const chemistry = cannabinoidChemistry(cannabinoid);
  const parsed = useMemo(()=>parseAmount(amount),[amount]);
  const grams = parsed.value === null ? null : parsed.value * UNITS[unit].toGrams;
  const result = useMemo(
    () => grams === null ? null : convert(grams,direction,cannabinoid),
    [grams,direction,cannabinoid],
  );
  const isDecarb = direction === 'decarb';
  const from = isDecarb ? chemistry.acid : chemistry.neutral;
  const to = isDecarb ? chemistry.neutral : chemistry.acid;
  function changeDirection(next: Direction) {
    if (next === direction) return;
    if (entryDirection !== undefined) {
      // Both sidebar entries share a stateful workbench and persisted acid choice.
      void navigate({
        to: next === 'decarb' ? '/tools/thca-to-thc' : '/tools/thc-to-thca',
        search: {unit,amount,direction:next,cannabinoid},
      });
    } else workspace.setField('direction',next);
  }
  return (
    <CalculatorStudio name={isDecarb ? `${chemistry.acid} product yield` : `${chemistry.acid} starting mass`} category="Stoichiometry"
      summary="Molecular mass model" label={isDecarb ? `Theoretical ${to} produced` : `Equivalent starting ${to}`}
      value={result ? formatAmount(result.outputGrams,unit) : null} unit={unit}
      note={isDecarb ? 'Assumes complete conversion' : 'Target mass equivalent, not a reverse reaction'}
      metrics={[
        {label:isDecarb ? 'Potential CO2 loss' : 'Associated CO2 fraction',value:result ? formatAmount(result.co2Grams,unit) : '—',unit},
        {label:'Conversion factor',value:formatNumber(chemistry.ratio*100,3),unit:'%'},
      ]}
      input={<Panel title={isDecarb ? 'Yield inputs' : 'Target-based planning'} detail={isDecarb ? 'Calculate potential neutral-cannabinoid yield' : 'Determine required starting acid, not reverse chemistry'}
        action={<WorkspaceActions onReset={workspace.reset} shareUrl={workspace.shareUrl}
          tool={isDecarb ? `${from} theoretical yield` : `Starting ${to} required for target ${from}`} result={result ? `${formatAmount(result.outputGrams,unit)} ${unit}` : null}/>}>
        <div className="input-stack">
          <Selector label="Solve for" value={direction} onChange={changeDirection} options={[
             {value:'decarb',label:'Product yield'},
             {value:'reverse',label:'Starting mass needed'},
           ]}/>
           <CannabinoidSelector context="conversion" value={cannabinoid} onChange={next=>workspace.setField('cannabinoid',next)}/>
           {!isDecarb && <p className="studio-chemical-method-note">Enter a {chemistry.neutral} target. The output is the {chemistry.acid} starting mass equivalent for complete decarboxylation—not {chemistry.neutral} converting into {chemistry.acid}.</p>}
          <FieldGrid>
            <NumberField id="convert-amount" label={isDecarb ? `Starting ${from} mass` : `Target ${from} mass`}
              value={amount} onChange={value=>workspace.setField('amount',value)} error={parsed.error}
              suffix={UNITS[unit].label} max={MAX_INPUT} prominent/>
            <UnitSelector value={unit} onChange={value=>workspace.setMassUnit(value,['amount'])}/>
          </FieldGrid>
          <div className="preset-section">
            <span className="small-label">Quick values</span>
            <div className="preset-row">
              {CONVERSION_PRESETS[unit][direction].map(value => <button type="button" className="preset"
                key={value} onClick={()=>workspace.setField('amount',String(value))}>{value} {unit}</button>)}
            </div>
          </div>
          <div className="formula-box">
            <span className="small-label">{isDecarb ? 'Theoretical decarboxylation' : 'Required-input calculation'}</span>
            <Formula>{isDecarb ? `m(${chemistry.neutral}) = m(${chemistry.acid}) × ` : `m(${chemistry.acid} needed) = m(${chemistry.neutral} target) ÷ `}
               <strong>{chemistry.ratio.toFixed(5)}</strong></Formula>
            <span className="fine-print">{chemistry.acidMw.toFixed(2)} g/mol {chemistry.acid} → {chemistry.neutralMw.toFixed(2)} g/mol {chemistry.neutral} + CO2</span>
          </div>
        </div>
      </Panel>}
      output={<Panel title="Calculated output" detail="Computed from the entered mass"
        action={result ? <CopyResult value={`${formatAmount(result.outputGrams,unit)} ${unit}`}/> : undefined}>
        {result ? <>
          <PrimaryResult label={isDecarb ? `Theoretical ${to} produced` : `Equivalent starting ${to}`}
            value={formatAmount(result.outputGrams,unit)} unit={unit}
            note={isDecarb ? 'Assumes complete stoichiometric conversion' : 'Mass-equivalence calculation, not a reverse chemical reaction'}/>
          <MassBalance retained={isDecarb ? result.outputGrams : grams!} released={result.co2Grams}
            retainedLabel={`${chemistry.neutral}-equivalent mass`} releasedLabel="Associated CO2 mass"/>
          <Metrics>
            <Metric label={isDecarb ? 'Potential CO2 released' : 'Potential CO2 at complete conversion'} value={formatAmount(result.co2Grams,unit)} suffix={unit}/>
            <Metric label={`${chemistry.acid} mass retained as ${chemistry.neutral}`}
              value={formatNumber(chemistry.ratio*100,3)} suffix="%"/>
            <Metric label="CO2 mass fraction" value={formatNumber(chemistry.co2Ratio*100,3)} suffix="%"/>
            <Metric label="Molar mass difference" value={formatNumber(chemistry.co2Mw,4)} suffix="g/mol"/>
          </Metrics>
          <Notice>{isDecarb
            ? 'Theoretical maximum. Actual conversion kinetics, by-products, and losses depend on the cannabinoid and process, and are not modeled.'
            : `This estimates the ${chemistry.acid} mass equivalent of a target ${chemistry.neutral} mass. It does not imply a reverse chemical reaction.`}</Notice>
        </> : <Unavailable>Enter a valid amount to calculate a result.</Unavailable>}
      </Panel>}
    />
  );
}

export function BatchCalculator() {
  const workspace = useCalculatorWorkspace('batch',BATCH_DEFAULTS);
  const {unit,amount,percent,cannabinoid} = workspace.values;
  const chemistry = cannabinoidChemistry(cannabinoid);
  const parsed = useMemo(()=>parseAmount(amount),[amount]);
  const grams = parsed.value === null ? null : parsed.value * UNITS[unit].toGrams;
  const parsedPercent = useMemo(()=>parseAmount(percent,{max:100}),[percent]);
  const result = useMemo(()=>grams===null || parsedPercent.value===null
    ? null : calculateBatch(grams,parsedPercent.value,cannabinoid),
  [grams,parsedPercent.value,cannabinoid]);
  return (
    <CalculatorStudio name="Batch yield" category="Production" summary="Complete conversion model"
      label={`Potential ${chemistry.neutral} produced`} value={result ? formatAmount(result.thcGrams,unit) : null}
      unit={unit} note={`Starting batch, ${chemistry.acid} composition and theoretical CO2 loss`}
      metrics={[
        {label:'Final batch mass',value:result?formatAmount(result.finalWeightGrams,unit):'—',unit},
        {label:`Final ${chemistry.neutral} fraction`,value:result?formatNumber(result.finalThcPercent,2):'—',unit:'%'},
      ]}
      input={<Panel title="Batch parameters" detail={`Starting mass and measured ${chemistry.acid} content`}
        action={<WorkspaceActions onReset={workspace.reset} shareUrl={workspace.shareUrl} tool="Batch yield"
          result={result ? `${formatAmount(result.thcGrams,unit)} ${unit} ${chemistry.neutral}` : null}/>}>
        <div className="input-stack">
          <CannabinoidSelector context="batch" value={cannabinoid} onChange={next=>workspace.setField('cannabinoid',next)}/>
          <FieldGrid>
            <NumberField id="batch-mass" label="Starting batch mass" value={amount}
              onChange={value=>workspace.setField('amount',value)} error={parsed.error} suffix={unit} prominent/>
            <UnitSelector value={unit} onChange={value=>workspace.setMassUnit(value,['amount'])}/>
          </FieldGrid>
          <NumberField id="batch-percent" label={`${chemistry.acid} content`} value={percent}
            onChange={value=>workspace.setField('percent',value)} suffix="%" max={100} error={parsedPercent.error}
            hint="Initial mass percentage measured before heating"/>
          <div className="formula-box">
            <span className="small-label">Calculation method</span>
            <Formula>{`m(${chemistry.neutral}) = m(batch) × ${chemistry.acid}% × ${chemistry.ratio.toFixed(5)}`}</Formula>
            <span className="fine-print">{`Only the CO2 released from ${chemistry.acid} conversion is subtracted.`}</span>
          </div>
        </div>
      </Panel>}
      output={<Panel title="Theoretical batch yield" detail="Mass balance after complete conversion">
        {result ? <>
          <PrimaryResult label={`Potential ${chemistry.neutral} produced`}
            value={formatAmount(result.thcGrams,unit)} unit={unit}/>
          <MassBalance retained={result.finalWeightGrams} released={result.co2Grams}
            retainedLabel="Final batch" releasedLabel="CO2 released"/>
          <Metrics>
            <Metric label={`${chemistry.acid} before heating`} value={formatAmount(result.thcaGrams,unit)} suffix={unit}/>
            <Metric label="CO2 released" value={formatAmount(result.co2Grams,unit)} suffix={unit}/>
            <Metric label="Final batch mass" value={formatAmount(result.finalWeightGrams,unit)} suffix={unit}/>
            <Metric label={`Final ${chemistry.neutral} concentration`}
              value={formatNumber(result.finalThcPercent,2)} suffix="%" accent/>
          </Metrics>
          <Notice>{`Assumes other mass remains unchanged, no pre-existing ${chemistry.neutral}, complete conversion, and no additional volatile or degradation losses. This is not a kinetics prediction.`}</Notice>
        </> : <Unavailable>{`Enter a valid batch mass and ${chemistry.acid} percentage.`}</Unavailable>}
      </Panel>}
    />
  );
}

export function AnalyzerCalculator() {
  const workspace = useCalculatorWorkspace('analysis',ANALYZER_DEFAULTS);
  const {unit,amount,final,cannabinoid} = workspace.values;
  const chemistry = cannabinoidChemistry(cannabinoid);
  const parsed = useMemo(()=>parseAmount(amount),[amount]);
  const grams = parsed.value === null ? null : parsed.value * UNITS[unit].toGrams;
  const finalParsed = useMemo(()=>parseAmount(final),[final]);
  const finalGrams = finalParsed.value===null ? null : finalParsed.value*UNITS[unit].toGrams;
  const result = useMemo(()=>grams===null || finalGrams===null
    ? null : analyzeMassLoss(grams,finalGrams,cannabinoid),[grams,finalGrams,cannabinoid]);
  const impossible = grams!==null && finalGrams!==null && !result;
  return (
    <CalculatorStudio name={`${chemistry.acid} analyzer`} category="Analytical estimate"
      summary="CO2-only loss assumption" label={`Estimated initial ${chemistry.acid}`}
      value={result?formatNumber(result.thcaPercent,2):null} unit="%"
      note="Mass-loss estimate only; not a measured potency assay"
      metrics={[
        {label:'Observed loss',value:result?formatAmount(result.lossGrams,unit):'—',unit},
        {label:`${chemistry.neutral} produced`,value:result?formatAmount(result.thcGrams,unit):'—',unit},
      ]}
      input={<Panel title="Conditional mass-loss estimate" detail="Compare initial and final weights under a single-acid model"
        action={<WorkspaceActions onReset={workspace.reset} shareUrl={workspace.shareUrl}
          tool={`${chemistry.acid} mass-loss analysis`}
          result={result ? `${formatNumber(result.thcaPercent,2)}% ${chemistry.acid}` : null}/>}>
        <div className="input-stack">
          <CannabinoidSelector context="analysis" value={cannabinoid} onChange={next=>workspace.setField('cannabinoid',next)}/>
          <FieldGrid>
            <NumberField id="analyzer-start" label="Initial sample mass" value={amount}
              onChange={value=>workspace.setField('amount',value)} error={parsed.error} suffix={unit} prominent/>
            <UnitSelector value={unit} onChange={value=>workspace.setMassUnit(value,['amount','final'])}/>
          </FieldGrid>
          <NumberField id="analyzer-final" label="Final sample mass" value={final}
            onChange={value=>workspace.setField('final',value)} error={finalParsed.error} suffix={unit}/>
          <div className="formula-box">
            <span className="small-label">Mass balance</span>
            <Formula>{`${chemistry.acid} = (initial mass − final mass) ÷ ${chemistry.co2Ratio.toFixed(5)}`}</Formula>
            <span className="fine-print">{`Valid only when measured loss is CO2 exclusively from ${chemistry.acid}.`}</span>
          </div>
        </div>
      </Panel>}
      output={<Panel title="Composition estimate" detail="Assumes all lost mass was CO2">
        {result ? <>
          <PrimaryResult label={`Estimated original ${chemistry.acid}`}
            value={formatNumber(result.thcaPercent,2)} unit="%"/>
          <Metrics>
            <Metric label={`${chemistry.acid} in original sample`} value={formatAmount(result.thcaGrams,unit)} suffix={unit}/>
            <Metric label={`${chemistry.neutral} after conversion`} value={formatAmount(result.thcGrams,unit)} suffix={unit}/>
            <Metric label="Observed mass loss" value={formatAmount(result.lossGrams,unit)} suffix={unit}/>
            <Metric label={`Estimated final ${chemistry.neutral} %`}
              value={formatNumber(result.thcPercentAfter,2)} suffix="%"/>
          </Metrics>
          <Notice variant="warning">This is not a validated potency assay. Water, terpenes, solvents, other acidic cannabinoids, and incomplete reactions confound a mass-loss estimate. Never assume all lost mass is CO2.</Notice>
        </> : <Unavailable>{impossible
          ? `The mass change cannot be explained by the ${chemistry.acid} → ${chemistry.neutral} reaction alone. Check sample values and other volatile losses.`
          : 'Enter initial and final sample weights to estimate composition.'}</Unavailable>}
      </Panel>}
    />
  );
}

export { EdibleWorkbench as EdiblesCalculator } from './EdibleWorkbench';
