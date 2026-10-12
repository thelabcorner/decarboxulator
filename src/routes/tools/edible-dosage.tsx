import { createFileRoute } from '@tanstack/react-router';
import { EdiblesCalculator } from '../../components/Calculators';
import { ToolFAQ } from '../../components/ToolFAQ';
import { ToolReference } from '../../components/ToolReference';
import { ToolHeading } from '../../components/ui';
import { getTool, pageHead } from '../../lib/site';

const tool=getTool('edibles');
export const Route = createFileRoute('/tools/edible-dosage')({
  head:()=>pageHead(tool),
   component:()=><div className="calculator-route-shell"><ToolHeading section="Calculators / Formulation" title={tool.heading} description={tool.summary} index="05" reference/><EdiblesCalculator/><ToolReference><h2>How per-serving THC is estimated</h2><p>THCa concentration is converted to THC-equivalent mass using the molecular-weight factor, adjusted by the separately selected THCa conversion completion. Existing neutral THC is added to that output. A distinct downstream THC recovery percentage is then applied to both THC contributions before the total is divided by the integer number of servings.</p><p>This multi-ingredient formulation workbench supports measured isolate/distillate mass, labeled cannabinoid concentration by ingredient, and backsolved per-serving target amounts. Distinct cannabinoid contributions are reported independently; only THCa-derived and already-neutral THC enter the active-THC total. Inputs assume evenly distributed servings; no composition or physiological effect is measured.</p></ToolReference><ToolFAQ tool="edibles"/></div>,
});
