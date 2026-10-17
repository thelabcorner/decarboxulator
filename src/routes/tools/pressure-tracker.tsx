import { createFileRoute } from '@tanstack/react-router';
import { PressureTrackerWorkbench } from '../../components/PressureTrackerWorkbench';
import { ToolHeading } from '../../components/ui';
import { ToolReference } from '../../components/ToolReference';
import { ToolFAQ } from '../../components/ToolFAQ';
import { getTool, pageHead } from '../../lib/site';

const tool=getTool('pressure-tracker');
export const Route=createFileRoute('/tools/pressure-tracker')({
  head:()=>pageHead(tool),
  component:()=>(
    <div className="tracker-route-shell">
      <ToolHeading section="Calculators / Measurement" title={tool.heading}
        description={tool.summary} index="08" reference/>
      <PressureTrackerWorkbench/>
      <ToolReference>
        <h2>Why pressure can estimate evolved CO2</h2>
        <p>The ideal gas law gives gas inventory n=PV/(RT), where P is measured absolute
          pressure, V is free gas headspace and T is gas temperature in kelvin.
          Seal mode subtracts the initial inventory from the current inventory.
          Heating trapped air alone changes pressure, so comparing PSI readings
          without the temperature and initial inventory correction is incorrect.</p>
        <p>Vent mode additionally sums the temperature-corrected gas inventory lost
          during each isolated release event. The counted-cycle option approximates
          that sum by multiplying a calibrated pressure drop by the number of equivalent
          cycles; logged events use individual measured before/after states. The
          algorithm computes net evolved-gas equivalents, attributed to CO2 only
          when no other gas sources, leaks, inlet flow or significant absorption exist.</p>
        <p>Progress uses the same selected cannabinoid molar-mass ratio as the
          gravimetric tracker. A pressure target is conditional on the observed
          temperature, gas-space volume, starting pressure and accumulated vent
          history; it must never be mistaken for a safe operating limit.
          An unprotected heated sealed vessel can fail violently. The calculator
          does not design pressure equipment or rate its integrity.</p>
      </ToolReference>
      <ToolFAQ tool="pressure-tracker"/>
    </div>
  ),
});
