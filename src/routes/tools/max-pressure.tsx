import { createFileRoute } from '@tanstack/react-router';
import { PressureCalculator } from '../../components/MoreCalculators';
import { ToolHeading } from '../../components/ui';
import { ToolReference } from '../../components/ToolReference';
import { ToolFAQ } from '../../components/ToolFAQ';
import { getTool, pageHead } from '../../lib/site';

const tool = getTool('pressure');
export const Route = createFileRoute('/tools/max-pressure')({
  head: () => pageHead(tool),
  component: () => (
    <div className="calculator-route-shell">
       <ToolHeading section="Calculators / Gas model" title={tool.heading} description={tool.summary} index="06" reference/>
      <PressureCalculator/>
      <ToolReference>
        <h2>How vessel pressure is modeled</h2>
        <p>Two contributions are summed. First, the trapped air sealed inside the vessel at room temperature is heated to process temperature — ideal-gas law gives its new absolute pressure. Second, CO2 produced by the THCa → THC + CO2 reaction occupies the headspace volume at process temperature, contributing an additional partial pressure.</p>
          <p>Gauge pressure is total absolute pressure minus the reference ambient pressure. Model assumptions are now editable: sealing temperature (70°F default), initial sealing/ambient absolute pressure (1 atm default), and the fraction of THCa converted (100% default). The entered volume is the <strong>free gas headspace at the modeled conditions</strong>, not the nominal vessel size. The pressure landscape evaluates a centered ±30 K temperature sweep at seven headspace-volume multipliers, with exact values recalculated for each cell.</p>
          <p>The model assumes a constant, rigid free-gas volume and a dry ideal gas mixture. Vapor pressure, material displacement, changing headspace, gas dissolution, vents or leaks, wall compliance, other released volatiles, non-ideal phases, and unequal gas and sample temperatures are omitted. The calculation is neither a guaranteed upper bound nor evidence that a sealed vessel is safe at any predicted pressure; relative heat-map coloration never represents a safety threshold.</p>
         <p>Mean molar masses: THCa = 358.47 g/mol; CO2 ≈ 44.01 g/mol. Molar gas constant R = 8.314462618 J/(mol·K). Reference values: PubChem CID 98523 and 280, NIST CODATA. Gas pressure follows nRT/V.</p>
       </ToolReference>
       <ToolFAQ tool="pressure"/>

    </div>
  ),
});
