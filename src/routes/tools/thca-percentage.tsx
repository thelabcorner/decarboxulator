import { createFileRoute } from '@tanstack/react-router';
import { AnalyzerCalculator } from '../../components/Calculators';
import { ToolFAQ } from '../../components/ToolFAQ';
import { ToolReference } from '../../components/ToolReference';
import { ToolHeading } from '../../components/ui';
import { getTool, pageHead } from '../../lib/site';

const tool=getTool('analysis');
export const Route = createFileRoute('/tools/thca-percentage')({
  head:()=>pageHead(tool),
  component:()=><div className="calculator-route-shell"><ToolHeading section="Calculators / Analytical" title={tool.heading} description={tool.summary} index="04" reference/><AnalyzerCalculator/><ToolReference><h2>Interpreting a mass-loss estimate</h2><p>For pure THCa fully converted to THC, approximately 12.277% of starting acid mass leaves as CO₂. This tool divides observed mass loss by that fraction to infer the mass of starting THCa, then divides by initial sample mass for an estimated percentage.</p><p>Because gravimetry alone does not identify the source of evaporated compounds or validate reaction completeness, this calculation is an inference under restrictive assumptions, not a laboratory potency determination.</p></ToolReference><ToolFAQ tool="analysis"/></div>,
});
