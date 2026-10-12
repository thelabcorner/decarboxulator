import { createFileRoute } from '@tanstack/react-router';
import { BatchCalculator } from '../../components/Calculators';
import { ToolFAQ } from '../../components/ToolFAQ';
import { ToolReference } from '../../components/ToolReference';
import { ToolHeading } from '../../components/ui';
import { getTool, pageHead } from '../../lib/site';

const tool=getTool('batch');
export const Route = createFileRoute('/tools/batch-yield')({
  head:()=>pageHead(tool),
  component:()=><div className="calculator-route-shell"><ToolHeading section="Calculators / Production" title={tool.heading} description={tool.summary} index="03" reference/><BatchCalculator/><ToolReference><h2>Batch-yield calculation method</h2><p>The initial sample mass is multiplied by its THCa mass fraction to determine the THCa available. Applying the 0.87723 conversion factor gives the theoretical THC mass. The difference is CO2 released, which is subtracted from the original batch weight.</p><p>Other components are modeled as mass-stable. Real samples can lose water, solvent, terpenes, and other volatiles, and existing THC must be accounted for separately.</p></ToolReference><ToolFAQ tool="batch"/></div>,
});
