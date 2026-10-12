import { createFileRoute } from '@tanstack/react-router';
import { CartridgeCalculator } from '../../components/MoreCalculators';
import { ToolHeading } from '../../components/ui';
import { ToolReference } from '../../components/ToolReference';
import { ToolFAQ } from '../../components/ToolFAQ';
import { getTool, pageHead } from '../../lib/site';

const tool = getTool('cartridge');
export const Route = createFileRoute('/tools/cartridge-formulation')({
  head: () => pageHead(tool),
  component: () => (
    <div className="calculator-route-shell">
       <ToolHeading section="Calculators / Formulation" title={tool.heading} description={tool.summary} index="08" reference/>
      <CartridgeCalculator/>
      <ToolReference>
         <h2>Starting blend mass and finished cartridge targets</h2>
         <p>In required-input mode, cartridge count multiplied by fill capacity defines the requested <strong>final</strong> fill mass. In available-batch mode, a specified starting mass is converted forward to determine total finished mass and the number of completely fillable cartridges. Compound parts define proportions of the starting blend. If THCa conversion is selected, the calculator solves backwards for enough starting material to reach that final fill after stoichiometric CO2 release. Each THCa row loses approximately 12.28% of its own mass; other components are held constant. Multiple THCa entries each contribute only their own corresponding mass.</p>
         <p>THCa handling is explicit. Conversion can be modeled whether or not the starting blend already contains THC, or THCa can be retained unchanged. Actual reaction completion, composition stability, fill loss, density, viscosity, and crystallization are not predicted. The THCa, CBD, and terpene screening flags are qualitative heuristics, not established universal solubility thresholds.</p>
       </ToolReference>
       <ToolFAQ tool="cartridge"/>

    </div>
  ),
});
