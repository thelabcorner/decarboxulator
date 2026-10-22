import { useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NumberField } from './NumberField';
import { CompoundIdentitySelect } from './CompoundIdentitySelect';
import { WorkspaceActions } from './WorkspaceActions';
import { CalculatorStudio } from './CalculatorStudio';
import { FieldGrid, Metric, Metrics, Notice, Panel, PrimaryResult, Selector, Unavailable } from './ui';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import { formatNumber, parseAmount } from '../lib/decarb';
import { isAcidCannabinoid } from '../lib/cannabinoids';
import { calculateCartridge, calculateCartridgeFromInput, consolidateCompounds,
  consolidateStartingCompounds, summarizeCartridgeStages, type CartridgeStageMasses,
  COMPOUND_TYPES, type CompoundType, type AcidTreatment, type CompoundRow } from '../lib/cartridge';
import { parseCompoundRows, MAX_COMPOUND_ROWS } from '../lib/workspacePayload';
import './MoreCalculators.css';

const PROFILES: Record<string,CompoundRow[]> = {
  'THC / terpenes':[{type:'THC',parts:90},{type:'Terpenes',parts:10}],
  'THCa isolate':[{type:'THCa',parts:100}],
  'CBD blend':[{type:'CBD',parts:80},{type:'THC',parts:10},{type:'Terpenes',parts:10}],
  'Mixed cannabinoids':[{type:'THCa',parts:50},{type:'THC',parts:30},{type:'CBD',parts:15},{type:'Terpenes',parts:5}],
};
const ORIGINAL_DEFAULT = [{type:'THCa',parts:85},{type:'Terpenes',parts:10},{type:'CBN',parts:5}] as CompoundRow[];
const DEFAULTS = {unit:'g' as const,cartCount:'10',cartCapacity:'1',
  rows:JSON.stringify(ORIGINAL_DEFAULT),acidTreatment:'convert' as AcidTreatment,
  batchMode:'target',startingBatch:'10'};
const COLORS: Record<CompoundType,string> = {
  THC:'#74aa42',THCa:'#aaff00',CBD:'#589ac7',CBDa:'#79b7dd',
  CBN:'#a184c2',CBNa:'#baa1d5',CBG:'#d2a74e',CBGa:'#edc675',
  CBC:'#629f78',CBCa:'#92b69c',THCV:'#c583a8',Terpenes:'#47aba0',Other:'#9da2a9',
};
/** Actual starting weigh-out amounts. Not the finished composition percentages. */
function StartingBatchBreakdown({items,stages,acidTreatment,compact=false}: {
  items: ReadonlyArray<readonly [CompoundType,number]>;
  stages: CartridgeStageMasses;
  acidTreatment: AcidTreatment;
  compact?: boolean;
}) {
  return <section className="cartridge-bom" data-compact={compact} aria-label="Starting batch ingredient weights">
    <div className="cartridge-bom-heading">
      <strong>Starting batch · weigh out</strong>
      <span>Before decarboxylation</span>
    </div>
    <dl className="cartridge-bom-list">
      {items.map(([type,weightG])=><div className="cartridge-bom-row" key={type}>
        <dt><i style={{background:COLORS[type]}} aria-hidden="true"/>
          <span>{isAcidCannabinoid(type)?type.toUpperCase():type}
            {acidTreatment==='convert'&&isAcidCannabinoid(type)&&
              <small>Starting acid · modeled conversion</small>}
          </span>
        </dt>
        <dd>{formatNumber(weightG,3)} <small>g</small></dd>
      </div>)}
    </dl>
    <div className="cartridge-bom-subtotals" aria-label="Batch mass subtotals">
      <div className="cartridge-bom-subtotal" data-stage="cannabinoids">
        <span>Cannabinoids · starting</span><strong>{formatNumber(stages.startingCannabinoidsG,3)} <small>g</small></strong>
      </div>
      {stages.startingOtherG>0&&<div className="cartridge-bom-subtotal" data-stage="other">
        <span>Other materials</span><strong>{formatNumber(stages.startingOtherG,3)} <small>g</small></strong>
      </div>}
      <div className="cartridge-bom-subtotal" data-stage="pre-terpene-start">
        <span>Starting mass without terpenes</span>
        <strong>{formatNumber(stages.preTerpeneStartingG,3)} <small>g</small></strong>
      </div>
      <div className="cartridge-bom-subtotal" data-stage="terpenes">
        <span>Terpenes · add afterward</span>
        <strong>{formatNumber(stages.terpeneAdditionG,3)} <small>g</small></strong>
      </div>
    </div>
    <div className="cartridge-bom-total" data-stage="gross-start">
      <span>Gross starting ingredients</span><strong>{formatNumber(stages.grossStartingG,3)} <small>g</small></strong>
    </div>
    {!compact&&<div className="cartridge-bom-process" aria-label="Theoretical process mass balance">
      <div className="cartridge-bom-process-title">Modeled mass balance · terpenes added afterward</div>
      <dl className="cartridge-bom-process-list">
        <div data-stage="co2"><dt>CO₂ released by acidic cannabinoids</dt><dd>− {formatNumber(stages.co2ReleasedG,3)} g</dd></div>
        <div data-stage="cannabinoids-finished"><dt>Cannabinoids after modeled decarb</dt><dd>{formatNumber(stages.finishedCannabinoidsG,3)} g</dd></div>
        <div data-stage="pre-terpene-finished"><dt>Finished blend before terpenes</dt><dd>{formatNumber(stages.preTerpeneFinishedG,3)} g</dd></div>
        <div data-stage="terpenes-added"><dt>Terpenes added</dt><dd>+ {formatNumber(stages.terpeneAdditionG,3)} g</dd></div>
        <div className="cartridge-bom-process-final" data-stage="final"><dt>Final gross blend</dt>
          <dd>{formatNumber(stages.finalBlendG,3)} g</dd></div>
      </dl>
    </div>}
  </section>;
}
export function CartridgeWorkbench() {
  const ws=useCalculatorWorkspace('cartridge',DEFAULTS);
  const {cartCount,cartCapacity,rows:rowJson,acidTreatment,batchMode,startingBatch}=ws.values;
  const rows=useMemo(()=>parseCompoundRows(rowJson)??ORIGINAL_DEFAULT,[rowJson]);
  const setRows=useCallback((next:CompoundRow[])=>{
    if(next.length>MAX_COMPOUND_ROWS)return;
    ws.setField('rows',JSON.stringify(next));
  },[ws]);
  const count=parseAmount(cartCount,{min:1});
  const cap=parseAmount(cartCapacity,{min:0.000001});
  const batch=parseAmount(startingBatch,{min:0.000001});
  const targetMode=batchMode!=='available';
  const result=useMemo(()=>{
    if(cap.value===null)return null;
    if(targetMode) return count.value!==null ? calculateCartridge(rows,count.value,cap.value,acidTreatment) : null;
    return batch.value!==null ? calculateCartridgeFromInput(rows,batch.value,cap.value,acidTreatment):null;
  },[cap.value,count.value,batch.value,rows,acidTreatment,targetMode]);
  const consolidated=useMemo(()=>result?consolidateCompounds(result.compounds):null,[result]);
  const startingIngredients=useMemo(()=>result?
    [...consolidateStartingCompounds(result.compounds)]:[],[result]);
  const stages=useMemo(()=>result?summarizeCartridgeStages(result.compounds):null,[result]);
  const types=consolidated?[...consolidated].filter(([,d])=>d.pct>0):[];
  const partsTotal=rows.reduce((s,r)=>s+r.parts,0);
  const co2Loss=result?result.totalInputWeightG-result.totalFinalWeightG:0;
  const remaining=result&&cap.value!==null?
    Math.max(0,result.totalFinalWeightG-result.effectiveCarts*cap.value):0;

  return <CalculatorStudio name="Cartridge formulation" category="Production"
    summary={targetMode?'Target cartridge quantity':'Available material model'}
    label={targetMode?'Required starting blend':'Finished available blend'}
    value={result?formatNumber(targetMode?result.totalInputWeightG:result.totalFinalWeightG,3):null} unit="g"
    note="Modeled blend mass, cartridge count and compound composition"
    metrics={[
      {label:'Complete cartridges',value:result?String(result.effectiveCarts):'-'},
      {label:'Starting without terpenes',value:stages?formatNumber(stages.preTerpeneStartingG,3):'-',unit:'g'},
      {label:'Terpenes to add',value:stages?formatNumber(stages.terpeneAdditionG,3):'-',unit:'g'},
      {label:'Final blend mass',value:result?formatNumber(result.totalFinalWeightG,3):'-',unit:'g'},
    ]}
    overviewExtra={stages&&<StartingBatchBreakdown items={startingIngredients}
      stages={stages} acidTreatment={acidTreatment} compact/>}
    input={<Panel title="Batch configuration" detail="Choose a finished fill target or an available starting mass"
      action={<WorkspaceActions onReset={ws.reset} shareUrl={ws.shareUrl} tool="Cartridge formulation"
        result={result?`${formatNumber(result.totalFinalWeightG,3)} g finished`:null}/>}>
      <div className="input-stack">
        <Selector label="Production calculation" value={targetMode?'target':'available'}
          onChange={v=>ws.setField('batchMode',v)}
          options={[{value:'target',label:'Required input'}, {value:'available',label:'Available batch'}]}/>
        {targetMode?<>
          <FieldGrid>
            <NumberField id="cart-count" label="Number of cartridges" value={cartCount}
              onChange={v=>ws.setField('cartCount',v)}
              error={count.error||(count.value!==null&&!Number.isSafeInteger(count.value)?'Whole cartridges only':null)} min={1} prominent/>
            <NumberField id="cart-cap" label="Capacity per cartridge" value={cartCapacity}
              onChange={v=>ws.setField('cartCapacity',v)} suffix="g" error={cap.error}/>
          </FieldGrid>
          <div className="preset-section"><span className="small-label">Batch presets</span>
            <div className="preset-row">{[10,50,100,1000].map(n=><button type="button"
              className="preset" key={n} onClick={()=>ws.setField('cartCount',String(n))}>{n} carts</button>)}</div>
          </div>
        </>:<>
          <FieldGrid>
            <NumberField id="cart-starting" label="Available starting blend" value={startingBatch}
              onChange={v=>ws.setField('startingBatch',v)} suffix="g" error={batch.error} prominent/>
            <NumberField id="cart-cap-avail" label="Capacity per cartridge" value={cartCapacity}
              onChange={v=>ws.setField('cartCapacity',v)} suffix="g" error={cap.error}/>
          </FieldGrid>
        </>}
        <div className="preset-section"><span className="small-label">Cartridge sizes</span>
          <div className="preset-row">{[0.5,1,2].map(n=><button type="button"
            className="preset" key={n} onClick={()=>ws.setField('cartCapacity',String(n))}>{n} g</button>)}</div>
        </div>
        {rows.some(r=>isAcidCannabinoid(r.type)&&r.parts>0)&&
          <Selector label="Treat acidic ingredients as" value={acidTreatment}
            onChange={v=>ws.setField('acidTreatment',v)}
            options={[{value:'convert',label:'Assume full decarb'}, {value:'retain',label:'Keep acidic forms'}]}/>}
        <div className="studio-builder-title"><span className="small-label">Starting blend · per-compound parts</span>
          <span className="small-label">{formatNumber(partsTotal,2)} parts</span></div>
        <div className="preset-section"><span className="small-label">Start with a recipe</span>
          <div className="preset-row">{Object.entries(PROFILES).map(([name,recipe])=>
            <button type="button" className="preset" key={name} onClick={()=>setRows(recipe)}>{name}</button>)}</div>
        </div>
        <div className="studio-builder-list">
          {rows.map((row,i)=><div className="studio-builder-row" key={i}>
            <div className="studio-builder-row-heading">
              <span className="small-label">Compound {String(i+1).padStart(2,'0')}</span>
              <button type="button" className="text-button" disabled={rows.length<=1}
                aria-label={`Remove compound ${i+1}`} onClick={()=>setRows(rows.filter((_,j)=>i!==j))}>
                <Trash2 size={14}/> Remove</button>
            </div>
            <div className="studio-builder-fields">
              <div className="studio-builder-select-field">
<CompoundIdentitySelect id={`cart-type-${i}`} label="Starting compound" value={row.type}
                   onChange={type=>setRows(rows.map((r,j)=>i===j?{...r,type}:r))} types={COMPOUND_TYPES}/>
              </div>
              <NumberField id={`cart-parts-${i}`} label="Parts" suffix="pts" value={String(row.parts)}
                onChange={v=>setRows(rows.map((r,j)=>i===j?{...r,parts:Number(v)||0}:r))}/>
            </div>
          </div>)}
        </div>
        <button type="button" className="action-button action-button-secondary" disabled={rows.length>=MAX_COMPOUND_ROWS}
          onClick={()=>setRows([...rows,{type:'THCa',parts:0}])}><Plus size={14}/> Add compound</button>
        <Notice>Parts specify relative starting blend masses; they need not total 100. Repeated compound types are consolidated in the output.</Notice>
      </div>
    </Panel>}
    output={<Panel title="Production output" detail="Beginning-to-final mass balance">
      {result&&stages&&consolidated&&cap.value!==null?<>
        <PrimaryResult label={targetMode?'Required starting blend':'Final available blend'}
          value={formatNumber(targetMode?result.totalInputWeightG:result.totalFinalWeightG,3)} unit=" g"/>
        <StartingBatchBreakdown items={startingIngredients}
          stages={stages} acidTreatment={acidTreatment}/>
        <Metrics>
          <Metric label="Starting material" value={formatNumber(result.totalInputWeightG,3)} suffix="g"/>
          <Metric label="Finished mass" value={formatNumber(result.totalFinalWeightG,3)} suffix="g" accent/>
          <Metric label="CO2 released" value={formatNumber(co2Loss,3)} suffix="g"/>
          <Metric label="Complete cartridges" value={String(result.effectiveCarts)}/>
          <Metric label="Unfilled remainder" value={formatNumber(remaining,3)} suffix="g"/>
          {result.acidBreakdown.map(entry=><Metric key={entry.acidType}
            label={`${entry.neutralType} from ${entry.acidType}`}
            value={formatNumber(entry.outputG,3)} suffix="g"/>)}
        </Metrics>
        <div className="studio-builder-title"><span className="small-label">Finished composition · after modeled conversion</span></div>
        <div className="composition-bar" role="img" aria-label="Final formulation distribution">
          {types.map(([type,d])=><div className="comp-segment" key={type} style={{width:`${d.pct}%`,background:COLORS[type]}}
            title={`${type}: ${formatNumber(d.pct,2)}%`}>{d.pct>=9?`${formatNumber(d.pct,0)}%`:null}</div>)}
        </div>
        <div className="studio-legend">{types.map(([type,d])=><span key={type}>
          <i style={{background:COLORS[type]}}/>{type} · {formatNumber(d.pct,1)}%</span>)}</div>
        <div className="formula-box">
          <span className="small-label">Finished batch total / per cartridge</span>
          {types.map(([type,d])=><div className="per-cart-row" key={type}>
            <span>{type} · {formatNumber(d.weightG,3)} g total</span>
            <span>{formatNumber(d.weightG/result.totalFinalWeightG*(cap.value ?? 0),3)} g / cart</span>
          </div>)}
        </div>
        {result.warnings.crystallization&&<Notice variant="warning">THCa percentage is above the screening threshold. Actual crystallization is dependent on thermodynamics, composition, temperature and time; this calculator cannot predict solubility.</Notice>}
        {result.warnings.cbdCryst&&<Notice variant="warning">CBD percentage is above a qualitative screening threshold, not a measured solubility limit.</Notice>}
        {result.warnings.terpenes&&<Notice variant="warning">High terpene fraction: verify material compatibility and measured formulation properties independently.</Notice>}
        <Notice>Terpenes are modeled as an addition after decarboxylation. Starting mass without terpenes includes any Other materials, which remain separately identified and are not assumed suitable for heating. Only theoretical acid-to-neutral CO₂ loss is counted; processing losses, volatilization, transfer losses and actual conversion yield are not predicted.</Notice>
      </>:<Unavailable>Provide a valid positive capacity, batch quantity, and recipe with at least one positive part.</Unavailable>}
    </Panel>}
  />;
}
