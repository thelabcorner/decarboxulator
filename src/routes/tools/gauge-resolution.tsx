import { createFileRoute } from '@tanstack/react-router';
import { InstrumentResolutionWorkbench } from '../../components/InstrumentResolutionWorkbench';
import { ToolHeading } from '../../components/ui';
import { ToolFAQ } from '../../components/ToolFAQ';
import { ToolReference } from '../../components/ToolReference';
import { getTool, pageHead } from '../../lib/site';
const tool=getTool('gauge-resolution');
export const Route=createFileRoute('/tools/gauge-resolution')({
  head:()=>pageHead(tool),
  component:()=> <div className="calculator-route-shell">
    <ToolHeading section="Calculators / Instrumentation" title={tool.heading} description={tool.summary} index="10" reference/>
    <InstrumentResolutionWorkbench kind="gauge"/>
    <ToolReference>
      <h2>Readability is not instrument accuracy</h2>
      <p>The sensitivity is derived from n = PV/(RT) at each measured pressure endpoint. A digital gauge rounds each endpoint by up to half one readout increment. The calculation sums the magnitude of these contributions to obtain a conservative apparent-percentage rounding bound, including each measured vent before/after endpoint.</p>
      <p>Minimum and recommended targets are editable engineering conventions, not universal instrument standards. True uncertainty may be larger due to calibration, repeatability, drift, temperature accuracy, input composition, changing headspace, gas exchange or incomplete chemical specificity.</p>
    </ToolReference>
    <ToolFAQ tool="gauge-resolution"/>
  </div>,
});