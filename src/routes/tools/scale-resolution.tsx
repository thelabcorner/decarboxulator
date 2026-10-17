import { createFileRoute } from '@tanstack/react-router';
import { InstrumentResolutionWorkbench } from '../../components/InstrumentResolutionWorkbench';
import { ToolHeading } from '../../components/ui';
import { ToolFAQ } from '../../components/ToolFAQ';
import { ToolReference } from '../../components/ToolReference';
import { getTool, pageHead } from '../../lib/site';
const tool=getTool('scale-resolution');
export const Route=createFileRoute('/tools/scale-resolution')({
  head:()=>pageHead(tool),
  component:()=> <div className="calculator-route-shell">
    <ToolHeading section="Calculators / Instrumentation" title={tool.heading} description={tool.summary} index="09" reference/>
    <InstrumentResolutionWorkbench kind="scale"/>
    <ToolReference>
      <h2>Readability is not instrument accuracy</h2>
      <p>The maximum theoretical CO2 mass is the starting acidic cannabinoid mass multiplied by its stoichiometric CO2 mass fraction. A two-weight difference, with each reading rounded to the nearest display increment d, can carry up to d of worst-case difference error. Apparent percentage-point error is 100 d / expected CO2 mass.</p>
      <p>Minimum and recommended targets are editable engineering conventions, not universal instrument standards. True uncertainty may be larger due to calibration, repeatability, drift, temperature accuracy, input composition, changing headspace, gas exchange or incomplete chemical specificity.</p>
    </ToolReference>
    <ToolFAQ tool="scale-resolution"/>
  </div>,
});