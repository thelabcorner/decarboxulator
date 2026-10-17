import { createFileRoute } from '@tanstack/react-router';
import { DcxTrackerCalculator } from '../../components/MoreCalculators';
import { ToolHeading } from '../../components/ui';
import { ToolReference } from '../../components/ToolReference';
import { ToolFAQ } from '../../components/ToolFAQ';
import { getTool, pageHead } from '../../lib/site';

const tool = getTool('tracker');
export const Route = createFileRoute('/tools/decarb-tracker')({
  head: () => pageHead(tool),
  component: () => (
    <div className="tracker-route-shell">
      <div className="tracker-route-heading"><ToolHeading section="Calculators / Real-time" title={tool.heading} description={tool.summary} index="07" reference/></div>
      <DcxTrackerCalculator/>
      <div className="tracker-reference-bank">
      <ToolReference>
        <h2>How progress is inferred from weight</h2>
        <p>Each THCa molecule that decarboxylates forms one CO2 molecule. When that gas leaves a vented system, the measured mass can decrease by a known fraction of the starting THCa mass (the CO2 mass ratio, approximately 12.277% of THCa mass). Dividing observed weight loss by expected maximum CO2 loss gives completion percentage.</p>
        <p>The tare weight (empty vessel) must be stable across readings. Other volatile losses, including water, terpenes and residual solvent, are not accounted for and will inflate the apparent completion percentage if present.</p>
       </ToolReference>
       <ToolFAQ tool="tracker"/>
      </div>

    </div>
  ),
});
