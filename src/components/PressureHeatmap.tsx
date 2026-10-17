import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowDownRight, ArrowUpRight, Crosshair, Grid3x3, SlidersHorizontal } from 'lucide-react';
import { formatNumber } from '../lib/decarb';
import { PRESSURE_CENTER_INDEX, type HeatmapCell } from '../lib/pressure';

interface Props {
  cells: HeatmapCell[][];
  unit: 'F' | 'C';
  currentPsi: number;
  onUseScenario: (temperature: number, volume: number) => void;
}
const AXIS_LABEL = (value:number) => {
  const abs=Math.abs(value);
  if(abs>0&&abs<0.0001)return value.toExponential(2);
  const digits=abs<0.01?5:abs<1?3:abs<10?2:1;
  return Number(value.toFixed(digits)).toLocaleString('en-US', {maximumFractionDigits:digits});
};
const reading = (value:number) => {
  const abs=Math.abs(value);
  if(abs>0&&abs<0.0001)return value.toExponential(2);
  return formatNumber(value,abs<1?3:abs<10?2:1);
};
/**
 * A pressure *field*, not an HTML table. Each square is a measured model
 * evaluation and an operable keyboard/touch target. No color indicates safety.
 */
export function PressureHeatmap({cells,unit,currentPsi,onUseScenario}:Props) {
  const id=useId().replace(/:/g,'');
  const [selection,setSelection]=useState<[number,number]>([PRESSURE_CENTER_INDEX,PRESSURE_CENTER_INDEX]);
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 680px)');
    const onChange=()=>{
      if(media.matches)setSelection(([r,c])=>
        r===0||r===6||c===0||c===6?[PRESSURE_CENTER_INDEX,PRESSURE_CENTER_INDEX]:[r,c]);
    };
    media.addEventListener('change',onChange);
    return ()=>media.removeEventListener('change',onChange);
  },[]);
  const values=useMemo(()=>cells.flat().map(c=>Math.asinh(c.pGaugePsi/20)),[cells]);
  const low=Math.min(...values),high=Math.max(...values);
  const range=high-low;
  const [row,col]=selection;
  const selected=cells[row]?.[col] ?? cells[PRESSURE_CENTER_INDEX]?.[PRESSURE_CENTER_INDEX];
  if(!selected) return null;
  const active=selected.isCurrent;
  const delta=selected.pGaugePsi-currentPsi;
  function keyMove(event:KeyboardEvent<HTMLButtonElement>,r:number,c:number){
    const mobile=window.matchMedia('(max-width: 680px)').matches;
    const lower=mobile?1:0,upper=mobile?5:6;
    const next:[number,number]=
      event.key==='ArrowUp'?[Math.max(lower,r-1),c]:
      event.key==='ArrowDown'?[Math.min(upper,r+1),c]:
      event.key==='ArrowLeft'?[r,Math.max(lower,c-1)]:
      event.key==='ArrowRight'?[r,Math.min(upper,c+1)]:
      event.key==='Home'?[r,lower]:
      event.key==='End'?[r,upper]:[r,c];
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    if(next[0]===r&&next[1]===c)return;
    setSelection(next);
    document.getElementById(`${id}-${next[0]}-${next[1]}`)?.focus();
  }
  return <section className="pressure-field" id="pressure-landscape" aria-label="Pressure scenario map">
    <header className="pressure-field-top">
      <div className="pressure-field-heading">
        <span className="pressure-eyebrow"><Grid3x3 size={13} aria-hidden="true"/> LIVE MODEL FIELD</span>
        <h2>Pressure landscape</h2>
        <p>Temperature × free headspace · every cell calculated independently</p>
      </div>
      <div className="pressure-field-context"><Crosshair size={14} aria-hidden="true"/>
        Centered on your setup</div>
      <button className="pressure-mobile-edit" type="button"
        aria-label="Edit pressure model inputs"
        onClick={()=>document.getElementById('pressure-parameters')?.scrollIntoView({behavior:'smooth',block:'start'})}>
        <SlidersHorizontal size={14}/><span>Inputs</span>
      </button>
    </header>
    <div className="pressure-field-axis-label">PROCESS TEMPERATURE <span>°{unit} →</span></div>
    <div className="pressure-map-frame" role="group" aria-label="Computed gauge pressure by headspace and temperature. Use arrow keys to explore.">
      <div className="pressure-map-grid">
        <div className="pressure-grid-corner"><span>GAS SPACE</span><small>fl oz ↓</small></div>
        {cells[0].map((cell,c)=><div key={'h'+c}
          className={'pressure-grid-col-head'+(c===0||c===6?' pressure-map-outer':'')} aria-hidden="true">
          {AXIS_LABEL(cell.tempValue)}<span>°{unit}</span></div>)}
        {cells.map((rCells,r)=>[
          <div className={'pressure-grid-row-head'+(r===0||r===6?' pressure-map-outer':'')} key={'r'+r}>
            <strong>{AXIS_LABEL(rCells[0].headspaceFloz)}</strong><small>fl oz</small>
          </div>,
          ...rCells.map((cell,c)=>{
            const transformed=Math.asinh(cell.pGaugePsi/20);
            const fraction=range<=1e-12?0.5:(transformed-low)/range;
            const tone=Math.min(6,Math.max(0,Math.round(fraction*6)));
            return <button id={`${id}-${r}-${c}`} key={'c'+r+'-'+c} type="button"
              className={'pressure-map-cell'+((r===0||r===6||c===0||c===6)?' pressure-map-outer':'')}
              data-tone={tone} data-current={cell.isCurrent} data-selected={r===row&&c===col}
              aria-pressed={r===row&&c===col}
              aria-label={`${AXIS_LABEL(cell.headspaceFloz)} fluid ounce headspace, ${AXIS_LABEL(cell.tempValue)} degrees ${unit==='F'?'Fahrenheit':'Celsius'}: ${reading(cell.pGaugePsi)} psi gauge${cell.isCurrent?', current setup':''}`}
              title={`${AXIS_LABEL(cell.tempValue)}°${unit} · ${AXIS_LABEL(cell.headspaceFloz)} fl oz · ${reading(cell.pGaugePsi)} PSIG`}
              tabIndex={r===row&&c===col?0:-1}
              onClick={()=>setSelection([r,c])}
              onKeyDown={event=>keyMove(event,r,c)}>
              {cell.isCurrent&&<Crosshair className="pressure-cell-crosshair" size={12} aria-hidden="true"/>}
              <span>{reading(cell.pGaugePsi)}</span>
              <small>psi</small>
            </button>;
          }),
        ])}
      </div>
    </div>
    <div className="pressure-scale">
      <span>Lower within this study</span>
      <div className="pressure-scale-swatches" aria-hidden="true">
        {[0,1,2,3,4,5,6].map(t=><i key={t} data-tone={t}/>)}
      </div>
      <span>Higher within this study</span>
    </div>
    <div className="pressure-inspector" aria-live="polite">
      <div className="pressure-inspector-reading">
        <span className="pressure-inspector-kicker">{active?'CURRENT SETUP':'SELECTED SCENARIO'}</span>
        <div className="pressure-inspector-value"><strong>{reading(selected.pGaugePsi)}</strong><span>PSI gauge</span></div>
        <div className="pressure-inspector-context">{AXIS_LABEL(selected.tempValue)}°{unit} <span>·</span> {AXIS_LABEL(selected.headspaceFloz)} fl oz free gas</div>
      </div>
      <div className="pressure-inspector-delta">
        {active?<><Crosshair size={15}/> Exact input intersection</>:
          <>{delta>=0?<ArrowUpRight size={17}/>:<ArrowDownRight size={17}/>}
          <strong>{delta>0?'+':''}{reading(delta)} PSI</strong><span>relative to current setup</span></>}
      </div>
      <button type="button" className="pressure-apply-button" disabled={active}
        onClick={()=>{
          onUseScenario(selected.tempValue,selected.headspaceFloz);
          setSelection([PRESSURE_CENTER_INDEX,PRESSURE_CENTER_INDEX]);
        }}>
        {active?'Current configuration':'Use this scenario'}
      </button>
    </div>
    <div className="pressure-field-foot">
      <strong>Reading the field</strong>
      <span>Color is relative pressure magnitude, not a safety threshold. The lime outline marks your exact inputs; select any cell to inspect its modeled pressure.</span>
    </div>
  </section>;
}
