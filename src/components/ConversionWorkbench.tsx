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
      <span>{reverse ? 'Solve for the acid needed · not a reverse reaction' : 'Solve for the potential neutral-cannabinoid product'}</span>
      <Link to={counterpart.path} aria-label={`Open ${counterpart.name} calculator`}>{counterpart.name}</Link>
    </div>
    <ConversionCalculator entryDirection={direction}/>
    <ToolReference>
      {reverse ? <>
        <h2>THCa starting-mass reference (default selection)</h2>
        <p>Planning starts from the desired theoretical THC mass. Because each mole of THCa loses one molecule of CO2 during decarboxylation, divide the target THC mass by the ratio 314.46 ÷ 358.47 (approximately 0.87723) to obtain its THCa mass equivalent. For example, 10 g of target THC corresponds to approximately 11.399 g of pure starting THCa.</p>
        <p>The result assumes complete conversion without additional losses. This is not a chemical conversion of THC into THCa, and practical starting masses depend on assay purity, reaction completion, degradation, and material recovery.</p>
      </> : <>
        <h2>THCa to THC conversion formula and 0.877 factor</h2>
        <p>When one mole of THCa loses CO2 during decarboxylation, it yields one mole of THC. With reference molar masses of 358.47 g/mol for THCa and 314.46 g/mol for THC (PubChem CID 16078 and 98523; NRC Canada), the theoretical mass relationship is <strong>THC mass (g) = THCa mass (g) × (314.46 ÷ 358.47) ≈ THCa mass × 0.87723</strong>.</p>
        <p>For example, 10 g of pure THCa can theoretically produce approximately 8.772 g of THC and release approximately 1.228 g of CO2. The 0.87723 factor is the <em>retained-mass ratio at complete conversion</em>, not a reaction rate per minute, a measured conversion efficiency, or a prediction of when decarboxylation finishes.</p>
        <p>For a target amount of THC, reverse mode divides by the same factor to calculate the corresponding pure starting THCa mass. Neither direction incorporates chemical degradation, incomplete conversion, or material transfer losses.</p>
      </>}
      <p>These THCa examples document the default route. When you select CBDa, CBGa, CBCa, or CBNa, the live calculator uses that compound's own molecular masses; reaction rates and degradation behaviour are not assumed equivalent.</p>
    </ToolReference>
    <ToolFAQ tool={reverse ? 'reverse-conversion' : 'conversion'}/>
  </div>;
}
