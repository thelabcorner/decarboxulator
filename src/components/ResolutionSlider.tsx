import { useId, type CSSProperties } from 'react';
import './ResolutionSlider.css';

type Props={
  id?:string; label:string; value:string; onChange:(value:string)=>void;
  unit:string; min:number; max:number; sliderMin:number; sliderMax:number;
  mode?:'linear'|'log'; digits?:number; presets?:readonly number[]; hint?:string;
};

/** Slider-first control with a precise, editable readout and keyboard support. */
export function ResolutionSlider({
  id,label,value,onChange,unit,min,max,sliderMin,sliderMax,
  mode='linear',digits=3,presets,hint,
}:Props){
  const generatedId=useId(), inputId=id??generatedId;
  const number=Number(value),valid=value.trim()!==''&&Number.isFinite(number)&&number>=min&&number<=max;
  const bounded=Math.max(sliderMin,Math.min(sliderMax,valid?number:sliderMin));
  const percent=presets
    ?Math.max(0,presets.reduce((best,current,index)=>Math.abs(current-bounded)<Math.abs(presets[best]-bounded)?index:best,0))
    :mode==='log'
      ?(Math.log10(bounded)-Math.log10(sliderMin))/(Math.log10(sliderMax)-Math.log10(sliderMin))*1000
      :(bounded-sliderMin)/(sliderMax-sliderMin)*1000;
  const end=presets?presets.length-1:1000;
  function slide(raw:string){
    const n=Number(raw);
    if(presets){onChange(String(presets[Math.round(n)]??presets[0]));return;}
    const next=mode==='log'
      ?10**(Math.log10(sliderMin)+n/end*(Math.log10(sliderMax)-Math.log10(sliderMin)))
      :sliderMin+n/end*(sliderMax-sliderMin);
    onChange(String(Number(next.toPrecision(digits+2))));
  }
  return <div className="resolution-slider">
    <div className="resolution-slider-heading">
      <label htmlFor={inputId+'-slider'}>{label}</label>
      <div className="resolution-slider-number" data-invalid={!valid}>
        <input id={inputId} type="number" inputMode="decimal" step="any" min={min} max={max}
          value={value} onChange={e=>onChange(e.target.value)} aria-label={label+' numeric value'}
          aria-invalid={!valid}/>
        <span>{unit}</span>
      </div>
    </div>
    <input id={inputId+'-slider'} type="range" className="resolution-slider-track"
      min={0} max={end} step={1} value={Math.max(0,Math.min(end,percent))}
      onChange={event=>slide(event.target.value)} aria-label={label+' slider'}
      aria-valuetext={valid?number+' '+unit:'Invalid value'}
      style={{'--resolution-fill':Math.round(Math.max(0,Math.min(1,percent/end))*100)+'%'} as CSSProperties}/>
    <div className="resolution-slider-endpoints">
      <span>{presets?presets[0]:sliderMin} {unit}</span>
      <span>{presets?presets[end]:sliderMax} {unit}</span>
    </div>
    {hint&&<p className="resolution-slider-hint">{hint}</p>}
  </div>;
}
