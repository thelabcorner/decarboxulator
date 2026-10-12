import type { ReactNode } from 'react';
import { ArrowUpRight, ChevronDown, ChevronRight, Info, Sigma } from 'lucide-react';
import { UNITS, UNIT_KEYS, type UnitKey } from '../lib/decarb';

/** WebSeal-size status chip: compact, filled, and intentionally not all-caps. */
export function StatusChip({children, neutral=false}: {children:ReactNode; neutral?:boolean}) {
  return <span className="status-chip" data-neutral={neutral}>{children}</span>;
}

export function Panel({
  title, detail, action, children, className = '',
}: { title?: string; detail?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`studio-panel ${className}`}>
      {title ? (
        <div className="panel-heading">
          <div className="panel-heading-copy">
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="panel-content">{children}</div>
    </section>
  );
}

export function FieldGrid({ children }: {children: ReactNode}) {
  return <div className="field-grid">{children}</div>;
}

export function Selector<T extends string>({
  label, value, onChange, options,
}: {label: string; value: T; onChange: (value:T)=>void; options:ReadonlyArray<{value:T;label:string}>}) {
  return (
    <div className="selector-field">
      <label>{label}</label>
      <div className="segmented-control" role="group" aria-label={label}>
        {options.map(option => (
          <button key={option.value} type="button" aria-pressed={value===option.value}
            data-selected={value===option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UnitSelector({ value, onChange }: {value:UnitKey;onChange:(unit:UnitKey)=>void}) {
  return <Selector label="Units" value={value} onChange={onChange} options={UNIT_KEYS.map(key => ({value:key,label:UNITS[key].label}))}/>;
}

export function Metric({
  label, value, suffix, accent=false, note, className='',
}: {label:string;value:string|number;suffix?:string;accent?:boolean;note?:string;className?:string}) {
  return (
    <div className={`metric ${accent ? 'metric-accent' : ''} ${className}`}>
      <dt>{label}</dt>
      <dd><span>{value}</span>{suffix ? <small>{suffix}</small> : null}</dd>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

export function Metrics({children}: {children:ReactNode}) {
  return <dl className="metric-grid">{children}</dl>;
}

export function PrimaryResult({ label, value, unit, note }: {label:string;value:string;unit?:string;note?:string}) {
  return (
    <div className="primary-result" aria-live="polite" aria-atomic="true">
      <div className="primary-label"><span className="result-pin" />{label}</div>
      <output className="primary-number">{value}{unit ? <small>{unit}</small> : null}</output>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

export function Notice({children, variant='info'}: {children:ReactNode;variant?:'info'|'warning'}) {
  return <div className="notice" data-variant={variant}><Info size={14} aria-hidden="true" /><p>{children}</p></div>;
}

export function Unavailable({ children }: {children:string}) {
  return <div className="unavailable"><span>Awaiting valid input</span><p>{children}</p></div>;
}

export function Trail({ section, title }: {section:string;title:string}) {
  return <div className="trail"><span>{section}</span><ChevronRight size={12} /><span>{title}</span></div>;
}

export function ToolHeading({ section, title, description, index, reference = false }: {section:string;title:string;description:string;index?:string;reference?:boolean}) {
  return (
    <header className="tool-heading">
      <div className="tool-heading-row">
        <div className="tool-heading-primary">
          <div className="tool-heading-context">
            <span className="tool-heading-context-dot" aria-hidden="true"/>
            <span>{section.replace('Calculators / ', '')}</span>
            {index ? <span className="tool-heading-ordinal">Tool {index}</span> : null}
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {reference ? <a href="#tool-reference" className="tool-heading-reference" title="Open calculation method" onClick={() => { const details = document.getElementById("tool-reference"); if (details instanceof HTMLDetailsElement) details.open = true; }}> 
          <span>Method</span><ArrowUpRight size={14} strokeWidth={1.8}/>
        </a> : null}
      </div>
    </header>
  );
}

/** The equation is available on demand without pushing live results below the fold. */
export function Formula({children}: {children:ReactNode}) {
  return <details className="formula-disclosure">
    <summary><Sigma size={14} strokeWidth={1.9}/> Equation <ChevronDown size={14} strokeWidth={1.7}/></summary>
    <div className="formula">{children}</div>
  </details>;
}
