import { Link } from '@tanstack/react-router';
import { ArrowLeftRight } from 'lucide-react';
import { CartridgeWorkbench } from './CartridgeWorkbench';
import { ToolFAQ } from './ToolFAQ';
import { ToolReference } from './ToolReference';
import { ToolHeading } from './ui';
import { getTool } from '../lib/site';

/** Two independently discoverable routes with a single mathematical workbench. */
export function FormulationWorkbench({mode}: {mode:'cartridge'|'extract'}) {
  const extract=mode==='extract';
  const tool=getTool(mode);
  const counterpart=getTool(extract?'cartridge':'extract');
  return <div className="calculator-route-shell">
    <ToolHeading section="Calculators / Formulation" title={tool.heading} description={tool.summary}
      index={extract?'12':'11'} reference/>
    <div className="conversion-companion">
      <ArrowLeftRight size={14} strokeWidth={1.8} aria-hidden="true"/>
      <span>{extract?'Extract blending · same mass balance, portion language':'Cartridge filling · same mass balance, fill language'}</span>
      <Link to={counterpart.path} aria-label={`Open ${counterpart.name} calculator`}>{counterpart.name}</Link>
    </div>
    <CartridgeWorkbench formulationMode={mode}/>
    <ToolReference>
      <h2>{extract?'Extract formulation and recoverable blend yield':'Cartridge formulation and recoverable fill yield'}</h2>
      <p>In required-input mode, the number of {extract?'extract portions':'cartridges'} multiplied by mass per {extract?'portion':'cartridge'} determines the desired <strong>recoverable</strong> output. In available-batch mode, starting material is held fixed and the output estimates gross finished mass, material lost in transfer, recoverable mass and fully fillable {extract?'portions':'cartridges'}. Ingredient parts are proportional starting masses; no requirement to sum to 100.</p>
      <p>Acidic cannabinoids use their respective theoretical neutral-product mass ratios when conversion is selected. The staged bill of materials reports starting cannabinoid mass, any Other ingredients, pre-terpene charge, post-decarboxylation subtotal, subsequent terpene addition, gross finished blend and net recovered blend. Terpenes are added after the modeled conversion, and the Other category does not imply suitability for heating.</p>
      <p>An optional transfer loss percentage represents an assumed uniform fraction of the finished blend lost during handling <strong>after</strong> decarboxylation and terpene addition. Target mode compensates for it when solving the starting charge. Available-batch mode subtracts it from gross output. This is separate from stoichiometric CO2 release; chemical conversion completion, thermal volatilization, degradation, nonuniform separation and actual process losses are not predicted.</p>
      <p>Cartridge and Extract are two entry points to the same formulation calculator. The mathematical method, saved recipe and controls are identical; only labels describing fill units or extract portions change. For an undivided extract batch, set the number of portions to one.</p>
    </ToolReference>
    <ToolFAQ tool={mode}/>
  </div>;
}
