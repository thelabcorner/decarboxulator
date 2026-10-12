import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Activity, BarChart3, ChevronRight, FlaskConical, Grid2x2, Info } from 'lucide-react';
import './CalculatorStudio.css';

type Tab = 'calculate' | 'results' | 'comparison';
type Metric = { label: string; value: string; unit?: string };

export interface CalculatorStudioProps {
  name: string;
  category: string;
  summary: string;
  label: string;
  value: string | null;
  unit?: string;
  note?: string;
  metrics?: readonly Metric[];
  input: ReactNode;
  output: ReactNode;
  comparison?: ReactNode;
  comparisonLabel?: string;
}

/**
 * One interaction shell for V4's non-tracker workbenches. Calculator state is
 * owned by each existing workbench (and survives switching tabs). The displayed
 * summary is derived from the exact same result as its breakdown panel.
 */
export function CalculatorStudio({
  name, category, summary, label, value, unit, note, metrics = [],
  input, output, comparison, comparisonLabel = 'Comparison',
}: CalculatorStudioProps) {
  const id = useId().replace(/:/g, '');
  const [tab, setTab] = useState<Tab>('calculate');
  const navigation = useRef<HTMLDivElement>(null);
  const items: Array<{key: Tab; label: string; icon: typeof Activity}> = [
    { key: 'calculate', label: 'Calculator', icon: Activity },
    { key: 'results', label: 'Breakdown', icon: BarChart3 },
    ...(comparison ? [{ key: 'comparison' as const, label: comparisonLabel, icon: Grid2x2 }] : []),
  ];
  function selectKey(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    const nextIndex = event.key === 'ArrowRight' ? (current + 1) % items.length
      : event.key === 'ArrowLeft' ? (current + items.length - 1) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    setTab(items[nextIndex].key);
    const buttons = navigation.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }
  return (
    <section className="calculator-studio" data-calculator={name} data-active-tab={tab}>
      <header className="calculator-app-header">
        <div className="calculator-app-identity">
          <span className="calculator-app-symbol"><FlaskConical size={14} aria-hidden="true" /></span>
          <div className="calculator-app-copy">
            <strong>{name}</strong>
            <span>{category} <i aria-hidden="true" /> {summary}</span>
          </div>
        </div>
        <span className="calculator-app-status" data-valid={value !== null}>
          <span aria-hidden="true" />{value === null ? 'Input required' : 'Live calculation'}
        </span>
      </header>
      <nav className="calculator-app-tabs" role="tablist" aria-label={name + ' workbench sections'} ref={navigation}>
        {items.map(({key, label: tabLabel, icon: Icon}, index) =>
          <button type="button" key={key} id={id + '-tab-' + key} role="tab"
            aria-controls={id + '-panel-' + key} aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)} onKeyDown={event => selectKey(event, index)}>
            <Icon size={14} aria-hidden="true" /><span>{tabLabel}</span>
          </button>)}
      </nav>
      {tab === 'calculate' && <div className="calculator-app-body" role="tabpanel" id={id + '-panel-calculate'}
        aria-labelledby={id + '-tab-calculate'}>
        <aside className="calculator-app-overview" aria-label="Live model output">
          <div className="calculator-app-kpi">
            <span className="calculator-app-kpi-caption"><span className="calculator-app-kpi-dot" /> {label}</span>
            {value === null
              ? <strong className="calculator-app-kpi-empty">Awaiting inputs</strong>
              : <output className="calculator-app-kpi-value" aria-live="polite" aria-atomic="true">
                  {value}<small>{unit}</small>
                </output>}
            {note && <p>{note}</p>}
          </div>
          {metrics.length > 0 && <dl className="calculator-app-stats">
            {metrics.map(item => <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{value === null ? '—' : item.value}
                {value !== null && item.unit && <small>{item.unit}</small>}</dd>
            </div>)}
          </dl>}
          <button type="button" className="calculator-app-breakdown" onClick={() => setTab('results')}>
            <BarChart3 size={13} aria-hidden="true" /> View full calculation breakdown <ChevronRight size={14} aria-hidden="true" />
          </button>
        </aside>
        <div className="calculator-app-input">{input}</div>
      </div>}
      {tab === 'results' && <div className="calculator-app-details" role="tabpanel" id={id + '-panel-results'}
        aria-labelledby={id + '-tab-results'}>
        <div className="calculator-app-details-caption"><Info size={13} aria-hidden="true" />
          Live values update from the current calculator inputs. No changes are made to your saved calculations.
        </div>
        {output}
        <button type="button" className="calculator-app-return" onClick={() => setTab('calculate')}>
          <Activity size={13} aria-hidden="true" /> Return to calculator <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>}
      {tab === 'comparison' && comparison && <div className="calculator-app-details" role="tabpanel"
        id={id + '-panel-comparison'} aria-labelledby={id + '-tab-comparison'}>
        {comparison}
        <button type="button" className="calculator-app-return" onClick={() => setTab('calculate')}>
          <Activity size={13} aria-hidden="true" /> Return to calculator <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>}
    </section>
  );
}
