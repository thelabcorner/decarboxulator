import { useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NumberField } from './NumberField';
import { CompoundIdentitySelect } from './CompoundIdentitySelect';
import { CompactSelect } from './CompactSelect';
import { WorkspaceActions } from './WorkspaceActions';
import { CalculatorStudio } from './CalculatorStudio';
import { FieldGrid, Formula, Metric, Metrics, Notice, Panel, PrimaryResult, Selector, Unavailable } from './ui';
import { useCalculatorWorkspace } from '../lib/useCalculatorWorkspace';
import { formatNumber, parseAmount } from '../lib/decarb';
import { isAcidCannabinoid, cannabinoidChemistry } from '../lib/cannabinoids';
import { calculateEdibleFormula, DEFAULT_EDIBLE_ROWS, EDIBLE_COMPOUNDS, EDIBLE_UNITS,
  edibleRow, MAX_EDIBLE_ROWS, parseEdibleRows, type EdibleMode, type EdibleRow, type EdibleCompound, type EdibleUnit,
} from '../lib/edibleFormula';
import './MoreCalculators.css';

const DEFAULTS = {
  // Retain legacy fields so existing snapshots and local workspaces can migrate.
  unit: 'g' as const, mass: '3.5', thca: '18', thc: '0',
  servings: '12', recovery: '100', postRecovery: '100',
  edibleMode: 'concentration' as EdibleMode,
  edibleRows: JSON.stringify(DEFAULT_EDIBLE_ROWS.concentration),
};
const COLORS: Record<EdibleCompound,string> = {
  THCa:'#aaff00', THC:'#76a443', CBDa:'#79b7dd', CBD:'#579bcc',
  CBGa:'#edc675', CBG:'#dbaf52', CBCa:'#92b69c', CBC:'#629f78',
  CBNa:'#baa1d5', CBN:'#a684cb', Other:'#99999e',
};
const numberText = (n: number) => Number.isFinite(n) ? String(n) : '0';

export function EdibleWorkbench() {
  const ws = useCalculatorWorkspace('edibles', DEFAULTS);
  const { edibleMode: mode, edibleRows, servings, recovery, postRecovery } = ws.values;
  const rows = useMemo(() => parseEdibleRows(edibleRows) ?? DEFAULT_EDIBLE_ROWS.concentration, [edibleRows]);
  const setRows = useCallback((next: EdibleRow[]) => {
    if (next.length > MAX_EDIBLE_ROWS) return;
    ws.setField('edibleRows', JSON.stringify(next));
  }, [ws]);
  const changeRow = (index: number, patch: Partial<EdibleRow>) =>
    setRows(rows.map((row,i) => i === index ? {...row, ...patch} : row));
  const count = parseAmount(servings, {min:1});
  const conversion = parseAmount(recovery, {max:100});
  const downstream = parseAmount(postRecovery, {max:100});
  const result = useMemo(() =>
    count.value !== null && conversion.value !== null && downstream.value !== null
      ? calculateEdibleFormula(mode, rows, count.value, conversion.value, downstream.value) : null,
    [mode,rows,count.value,conversion.value,downstream.value]);
  const valid = result !== null;
  const byCompound = result ? EDIBLE_COMPOUNDS.filter(type => result.totals[type] > 0) : [];
  const singleType = rows.length === 1 ? rows[0].type : null;
  const primaryNeutral = singleType && isAcidCannabinoid(singleType)
    ? cannabinoidChemistry(singleType).neutral
    : singleType && singleType !== 'Other' ? singleType
    : result && result.totalThcMg === 0 ? 'total cannabinoids' : 'THC';
  const combinedNeutralMg = result ? (['THC','CBD','CBG','CBC','CBN'] as const)
    .reduce((sum,key)=>sum+(result.outputTotals[key] ?? 0),0) : 0;
  const primaryMg = result ? (primaryNeutral === 'THC' ? result.perServingThcMg
    : primaryNeutral === 'total cannabinoids' ? combinedNeutralMg/result.servings
    : (result.outputTotals[primaryNeutral] ?? 0) / result.servings) : null;

  return <CalculatorStudio name="Edible formulation" category="Recipe planning"
    summary="Compound yield per serving" label={mode==='desired'?`Target ${primaryNeutral} per serving`:`Potential ${primaryNeutral} per serving`}
    value={primaryMg!==null?formatNumber(primaryMg,2):null} unit="mg"
    note="Calculated from ingredient assay, conversion and downstream recovery"
    metrics={[
      {label:'Total THC / batch',value:result?formatNumber(result.totalThcMg,2):'-',unit:'mg'},
      {label:'Portions',value:result?String(result.servings):'-'},
    ]}
    input={<Panel title="Formulation builder" detail="Set cannabinoid content, conversion, and servings"
      action={<WorkspaceActions onReset={ws.reset} shareUrl={ws.shareUrl} tool="Edible formulation"
        result={primaryMg!==null ? `${formatNumber(primaryMg,2)} mg ${primaryNeutral} / serving` : null}/>}>
      <div className="input-stack">
        <Selector label="Input method" value={mode} onChange={next => ws.setFields({
          edibleMode:next, edibleRows:JSON.stringify(DEFAULT_EDIBLE_ROWS[next]),
        })} options={[
          {value:'weight',label:'Measured mass'}, {value:'concentration',label:'Label potency'},
          {value:'desired',label:'Target dose'},
        ]}/>
        <FieldGrid>
          <NumberField id="edible-servings" label="Servings" value={servings}
            onChange={v => ws.setField('servings',v)} min={1}
            error={count.error || (count.value !== null && !Number.isSafeInteger(count.value) ? 'Whole servings only' : null)}
            prominent/>
          <NumberField id="edible-conversion" label="Assumed acid conversion" value={recovery}
            onChange={v => ws.setField('recovery',v)} suffix="%" max={100} error={conversion.error}/>
        </FieldGrid>
        <NumberField id="edible-retention" label="THC-specific downstream retention" value={postRecovery}
          onChange={v => ws.setField('postRecovery',v)} suffix="%" max={100}
          error={downstream.error} hint="Historical THC-specific transfer recovery. Other neutral cannabinoid recoveries are not inferred."/>
        <div className="studio-builder-title">
          <span className="small-label">Starting ingredients · per-row identity</span>
          <span className="small-label">{rows.length} of {MAX_EDIBLE_ROWS}</span>
        </div>
        <div className="studio-builder-list">
          {rows.map((row,i) => <div className="studio-builder-row" key={i}>
            <div className="studio-builder-row-heading">
              <span className="small-label">Entry {String(i+1).padStart(2,'0')}</span>
              <button type="button" className="text-button" disabled={rows.length === 1}
                aria-label={`Remove ingredient ${i+1}`} onClick={() => setRows(rows.filter((_,j)=>i!==j))}>
                <Trash2 size={14}/> Remove
              </button>
            </div>
<CompoundIdentitySelect id={`edible-type-${i}`} label="Input compound" value={row.type}
               onChange={type=>changeRow(i,{type})} types={EDIBLE_COMPOUNDS}/>
            {mode === 'desired' ?
              <NumberField id={`edible-target-${i}`}
                label={isAcidCannabinoid(row.type) ? `Target ${cannabinoidChemistry(row.type).neutral} per serving (from ${row.type})` : `Target ${row.type} per serving`}
                suffix="mg" value={numberText(row.target)}
                onChange={v=>changeRow(i,{target:Number(v)})}/> :
              <div className="studio-builder-fields">
                <NumberField id={`edible-mass-${i}`} label="Material mass" value={numberText(row.weight)}
                  onChange={v=>changeRow(i,{weight:Number(v)})}
                  suffix={mode==='concentration' ? 'g' : row.unit}/>
                {mode === 'weight' ?
                  <div className="studio-builder-select-field">
                    <CompactSelect id={`edible-unit-${i}`} label="Mass unit" value={row.unit}
                      onChange={unit=>changeRow(i,{unit})}
                      options={(Object.keys(EDIBLE_UNITS) as EdibleUnit[]).map(unit=>({value:unit,label:unit}))}/>
                  </div>
                : <NumberField id={`edible-pct-${i}`} label="Concentration" value={numberText(row.percent)}
                    onChange={v=>changeRow(i,{percent:Number(v)})} suffix="%" max={100}
                    error={row.percent>100 ? 'Cannot exceed 100%' : null}/>}
              </div>}
          </div>)}
        </div>
        <button type="button" className="action-button action-button-secondary" disabled={rows.length>=MAX_EDIBLE_ROWS}
          onClick={()=>setRows([...rows,edibleRow()])}><Plus size={15}/> Add ingredient</button>
        <Formula
          tex={String.raw`\mathsf{m}_{\mathsf{neutral}}=\mathsf{m}_{\mathsf{acid}}\,\frac{M_{\mathsf{neutral}}}{M_{\mathsf{acid}}}\,\eta_{\mathsf{conversion}}`}
          caption="For THC-producing or already-neutral THC ingredients, downstream recovery is applied separately. Other cannabinoids remain separate."/>
      </div>
    </Panel>}
    output={<Panel title="Recipe output" detail={mode === 'desired' ? 'Required starting material to meet the target' : 'Modeled batch totals and per-serving profile'}>
      {valid && result ? <>
        <PrimaryResult label={mode === 'desired' ? `Target ${primaryNeutral} per serving` : `Potential ${primaryNeutral} per serving`}
          value={formatNumber(primaryMg ?? 0,2)} unit=" mg"/>
        <Metrics>
          <Metric label="Combined neutral cannabinoids / batch" value={formatNumber(combinedNeutralMg,2)} suffix="mg" accent/>
          <Metric label="THC per batch" value={formatNumber(result.totalThcMg,2)} suffix="mg"/>
          <Metric label="THC from THCa" value={formatNumber(result.thcaDerivedThcMg,2)} suffix="mg"/>
          <Metric label="THC already neutral" value={formatNumber(result.directThcMg,2)} suffix="mg"/>
          <Metric label="Servings" value={result.servings}/>
          {(['CBD','CBG','CBC','CBN'] as const).filter(t=>(result.outputTotals[t] ?? 0)>0).map(t=>
            <Metric key={t} label={`${t} per serving`} value={formatNumber(result.outputTotals[t]/result.servings,2)} suffix="mg"/>)}
        </Metrics>
        <div className="studio-builder-title"><span className="small-label">Compound mass distribution · before conversion</span></div>
        <div className="composition-bar" role="img" aria-label="Starting cannabinoid mass distribution">
          {byCompound.map(type => {
            const total = Object.values(result.totals).reduce((a,b)=>a+b,0);
            return <div key={type} className="comp-segment"
              style={{width:`${total ? result.totals[type]/total*100 : 0}%`,background:COLORS[type]}}
              title={`${type}: ${formatNumber(result.totals[type],2)} mg`}/>;
          })}
        </div>
        <div className="studio-legend">
          {byCompound.map(type=><span key={type}><i style={{background:COLORS[type]}}/>{type} · {formatNumber(result.totals[type]/result.servings,2)} mg/serving</span>)}
        </div>
        <div className="formula-box">
          <span className="small-label">{mode==='desired' ? 'Starting material required per entry' : 'Ingredient contributions · batch'}</span>
          {result.rows.map((entry,i)=><div className="per-cart-row" key={i}>
            <span>{rows[i].type} · {String(i+1).padStart(2,'0')}</span>
            <span>{formatNumber(mode==='desired' ? entry.inputMaterialMg : entry.rawMg,2)} mg
              {mode==='desired' ? ' input' : ' compound'}</span>
          </div>)}
        </div>
        {mode==='desired' && <Notice>Targets are back-solved through the selected acid's molecular ratio and the assumed conversion fraction. THC-specific recovery applies only to THC-producing or direct THC rows.</Notice>}
        <Notice variant="warning">An analytical planning estimate, not a measured serving dose. Assumes uniform mixing and the stated composition. Actual concentrations and individual servings can differ. CBN is not CBD and is never counted toward CBD totals.</Notice>
      </> : <Unavailable>Enter valid material amounts, whole-number servings, and attainable conversion/recovery targets.</Unavailable>}
    </Panel>}
  />;
}
