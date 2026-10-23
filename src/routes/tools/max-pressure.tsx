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
        <p>Two contributions are summed. First, the initial gas inventory sealed at the specified starting temperature and absolute pressure is heated to process temperature. The ideal gas law gives its new absolute pressure. Second, CO2 produced by the THCa → THC + CO2 reaction occupies the headspace volume at process temperature, contributing an additional partial pressure.</p>
          <p>Gauge pressure is total absolute pressure minus the reference ambient pressure. The starting sealed-gas pressure is always editable in the main controls: choose PSIA (absolute) or PSIG (relative to entered ambient), start at ambient, or inspect an illustrative half-ambient vacuum. Enter any measured nonnegative absolute pressure, including values below ambient for vacuum conditions. Changing between PSIA and PSIG retains the same physical pressure. The starting vacuum describes <strong>initial trapped gas after sealing</strong>; a connected pump maintaining vacuum or a vessel open to atmosphere is a different, dynamically controlled system and is not modeled by this sealed-headspace equation.</p>
          <p>Other editable assumptions include sealing temperature (70°F default), outside atmospheric absolute pressure (1 atm default), and the fraction of THCa converted (100% default). The entered volume is the <strong>free gas headspace at the modeled conditions</strong>, not the nominal vessel size. The integrated estimator subtracts measured material and equipment displacement from internal vessel capacity. Density-based displacement requires a defensible material density. The pressure landscape evaluates a centered ±30 K temperature sweep at seven headspace-volume multipliers with exact per-cell recalculation.</p>
          <p>The model assumes constant, rigid free gas volume. The opt-in Henry equilibrium correction partitions CO2 between headspace and liquid using a user-supplied solubility coefficient appropriate to the modeled liquid and temperature. With the correction off, all modeled CO2 stays gaseous. Vapor pressure, changing headspace, dynamic gas-liquid transfer, vents or leaks, wall compliance, other released volatiles and non-ideal phases remain excluded. The calculation is neither a guaranteed upper bound nor evidence that a sealed vessel is safe at any predicted pressure; relative heat-map coloration never represents a safety threshold.</p>
         <p>Mean molar masses: THCa = 358.47 g/mol; CO2 ≈ 44.01 g/mol. Molar gas constant R = 8.314462618 J/(mol·K). Reference values: PubChem CID 98523 and 280, NIST CODATA. Gas pressure follows nRT/V.</p>
       </ToolReference>
       <ToolFAQ tool="pressure"/>

    </div>
  ),
});
