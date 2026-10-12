import { Link } from '@tanstack/react-router';
import { ArrowLeftRight } from 'lucide-react';
import { ConversionCalculator } from './Calculators';
import { ToolFAQ } from './ToolFAQ';
import { ToolReference } from './ToolReference';
import { ToolHeading } from './ui';
import { getTool } from '../lib/site';
import type { Direction } from '../lib/decarb';

/**
 * Two explicit discovery routes, one mathematical workbench.
 * Reverse mode means a target-yield mass equivalent, never THC carboxylation.
 */
export function ConversionWorkbench({direction}: {direction: Direction}) {
  const reverse = direction === 'reverse';
  const tool = getTool(reverse ? 'reverse-conversion' : 'conversion');
  const counterpart = getTool(reverse ? 'conversion' : 'reverse-conversion');
  return <div className="calculator-route-shell">
    <ToolHeading section="Calculators / Stoichiometry" title={tool.heading} description={tool.summary}
      index={reverse ? '02' : '01'} reference/>
    <div className="conversion-companion">
      <ArrowLeftRight size={14} strokeWidth={1.8} aria-hidden="true"/>
      <span>Shared mass equation · inverse input</span>
      <Link to={counterpart.path} aria-label={`Open ${counterpart.name} calculator`}>{counterpart.name}</Link>
    </div>
    <ConversionCalculator entryDirection={direction}/>
    <ToolReference>
      {reverse ? <>
        <h2>Calculating required starting THCa</h2>
        <p>Planning starts from the desired theoretical THC mass. Because each mole of THCa loses one molecule of CO₂ during decarboxylation, divide the target THC mass by the ratio 314.46 ÷ 358.47 (approximately 0.87723) to obtain its THCa mass equivalent. For example, 10 g of target THC corresponds to approximately 11.399 g of pure starting THCa.</p>
        <p>The result assumes complete conversion without additional losses. This is not a chemical conversion of THC into THCa, and practical starting masses depend on assay purity, reaction completion, degradation, and material recovery.</p>
      </> : <>
        <h2>About the THCa conversion factor</h2>
        <p>At complete decarboxylation, every mole of THCa produces one mole of THC and one mole of CO₂. The bulk-mass factor is 314.46 ÷ 358.47 ≈ 0.87723, using reference molar masses (PubChem CID 16078 and 98523; NRC Canada). A 10 g pure THCa sample therefore has a theoretical THC yield of approximately 8.772 g.</p>
        <p>The reverse mode calculates the starting acid mass corresponding to a target THC mass. It does not describe a physically reversible reaction or an experimental recovery prediction.</p>
      </>}
    </ToolReference>
    <ToolFAQ tool={reverse ? 'reverse-conversion' : 'conversion'}/>
  </div>;
}
