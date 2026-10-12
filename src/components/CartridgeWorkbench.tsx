import { useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NumberField } from './NumberField';
import { CompactSelect } from './CompactSelect';
import { WorkspaceActions } from './WorkspaceActions';
import { CalculatorStudio } from './CalculatorStudio';
import { FieldGrid, Metric, Metrics, Notice, Panel, PrimaryResult, Selector, Unavailable } from './ui';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import { formatNumber, parseAmount } from '../lib/decarb';
import { calculateCartridge, calculateCartridgeFromInput, consolidateCompounds,
  COMPOUND_TYPES, type CompoundType, type AcidTreatment, type CompoundRow } from '../lib/cartridge';
import { parseCompoundRows, MAX_COMPOUND_ROWS } from '../lib/workspacePayload';
import './MoreCalculators.css';

const PROFILES: Record<string,CompoundRow[]> = {
  'THC / terpenes':[{type:'THC',parts:90},{type:'Terpenes',parts:10}],
  'THCa isolate':[{type:'THCa',parts:100}],
  'CBD blend':[{type:'CBD',parts:80},{type:'THC',parts:10},{type:'Terpenes',parts:10}],
  'Mixed cannabinoids':[{type:'THCa',parts:50},{type:'THC',parts:30},{type:'CBD',parts:15},{type:'Terpenes',parts:5}],
};
const ORIGINAL_DEFAULT = [{type:'THC',parts:85},{type:'Terpenes',parts:10},{type:'CBN',parts:5}] as CompoundRow[];
const DEFAULTS = {unit:'g' as const,cartCount:'10',cartCapacity:'1',
  rows:JSON.stringify(ORIGINAL_DEFAULT),acidTreatment:'convert' as AcidTreatment,
  batchMode:'target',startingBatch:'10'};
const COLORS: Record<CompoundType,string> = {
  THC:'#74aa42',THCa:'#aaff00',CBD:'#589ac7',CBN:'#a184c2',
  CBG:'#d2a74e',THCV:'#c583a8',Terpenes:'#47aba0',Other:'#9da2a9',
};
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
      {label:'Complete cartridges',value:result?String(result.effectiveCarts):'—'},
      {label:'Final blend mass',value:result?formatNumber(result.totalFinalWeightG,3):'—',unit:'g'},
    ]}
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
        {rows.some(r=>r.type==='THCa'&&r.parts>0)&&
          <Selector label="THCa mass behavior" value={acidTreatment}
            onChange={v=>ws.setField('acidTreatment',v)}
            options={[{value:'convert',label:'Model full decarb'}, {value:'retain',label:'Retain THCa'}]}/>}
        <div className="studio-builder-title"><span className="small-label">Blend recipe / relative input parts</span>
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
                <CompactSelect id={`cart-type-${i}`} label="Compound" value={row.type}
                  onChange={type=>setRows(rows.map((r,j)=>i===j?{...r,type}:r))}
                  options={COMPOUND_TYPES.map(type=>({value:type,label:type}))}/>
              </div>
              <NumberField id={`cart-parts-${i}`} label="Parts" suffix="pts" value={String(row.parts)}
                onChange={v=>setRows(rows.map((r,j)=>i===j?{...r,parts:Number(v)||0}:r))}/>
            </div>
          </div>)}
        </div>
        <button type="button" className="action-button action-button-secondary" disabled={rows.length>=MAX_COMPOUND_ROWS}
          onClick={()=>setRows([...rows,{type:'Other',parts:0}])}><Plus size={14}/> Add compound</button>
        <Notice>Parts specify relative starting blend masses; they need not total 100. Repeated compound types are consolidated in the output.</Notice>
      </div>
    </Panel>}
    output={<Panel title="Production output" detail="Beginning-to-final mass balance">
      {result&&consolidated&&cap.value!==null?<>
        <PrimaryResult label={targetMode?'Required starting blend':'Final available blend'}
          value={formatNumber(targetMode?result.totalInputWeightG:result.totalFinalWeightG,3)} unit=" g"/>
        <Metrics>
          <Metric label="Starting material" value={formatNumber(result.totalInputWeightG,3)} suffix="g"/>
          <Metric label="Finished mass" value={formatNumber(result.totalFinalWeightG,3)} suffix="g" accent/>
          <Metric label="CO2 released" value={formatNumber(co2Loss,3)} suffix="g"/>
          <Metric label="Complete cartridges" value={String(result.effectiveCarts)}/>
          <Metric label="Unfilled remainder" value={formatNumber(remaining,3)} suffix="g"/>
          {result.thcaOnlyMode&&<>
            <Metric label="THCa input" value={formatNumber(result.thcaInputG,3)} suffix="g"/>
            <Metric label="THC from THCa" value={formatNumber(result.thcFromThcaG,3)} suffix="g"/></>}
        </Metrics>
        <div className="studio-builder-title"><span className="small-label">Final composition</span></div>
        <div className="composition-bar" role="img" aria-label="Final formulation distribution">
          {types.map(([type,d])=><div className="comp-segment" key={type} style={{width:`${d.pct}%`,background:COLORS[type]}}
            title={`${type}: ${formatNumber(d.pct,2)}%`}>{d.pct>=9?`${formatNumber(d.pct,0)}%`:null}</div>)}
        </div>
        <div className="studio-legend">{types.map(([type,d])=><span key={type}>
          <i style={{background:COLORS[type]}}/>{type} · {formatNumber(d.pct,1)}%</span>)}</div>
        <div className="formula-box">
          <span className="small-label">Total batch / per cartridge</span>
          {types.map(([type,d])=><div className="per-cart-row" key={type}>
            <span>{type} · {formatNumber(d.weightG,3)} g total</span>
            <span>{formatNumber(d.weightG/result.totalFinalWeightG*(cap.value ?? 0),3)} g / cart</span>
          </div>)}
        </div>
        {result.warnings.crystallization&&<Notice variant="warning">THCa percentage is above the screening threshold. Actual crystallization is dependent on thermodynamics, composition, temperature and time; this calculator cannot predict solubility.</Notice>}
        {result.warnings.cbdCryst&&<Notice variant="warning">CBD percentage is above a qualitative screening threshold, not a measured solubility limit.</Notice>}
        {result.warnings.terpenes&&<Notice variant="warning">High terpene fraction: verify material compatibility and measured formulation properties independently.</Notice>}
        <Notice>Complete decarboxylation is a theoretical mass-balance option, not an instruction or guarantee of conversion. A formulation percentage alone cannot establish cartridge stability, safety or suitability for inhalation.</Notice>
      </>:<Unavailable>Provide a valid positive capacity, batch quantity, and recipe with at least one positive part.</Unavailable>}
    </Panel>}
  />;
}
