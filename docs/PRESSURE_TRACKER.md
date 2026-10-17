# Pressure tracker: scientific and implementation contract

**Status:** manual, browser-local, research-oriented inverse gas-inventory calculator. Not an assay, process controller, pressure-vessel specification, or validated sensor implementation.

**Routes**
- `/tools/pressure-tracker`: measured pressure → apparent evolved CO2-equivalent progress.
- `/tools/max-pressure`: assumed conversion fraction → modeled pressure landscape. Supports an independently specified starting sealed pressure and atmospheric pressure for gauge reference.
- `/tools/decarb-tracker`: gravimetric progress from mass loss, a distinct physical observable.

## Mathematics

Inputs are initial acid-containing mass `m`, acid fraction `f`, acid molecular mass `M_A`, assumed stoichiometric CO2 coefficient `nu=1`, fixed free gas-space volume `V`, local outside ambient absolute pressure `P_amb`, initial sealed absolute pressure `P_0` and absolute temperature `T_0`, current `P_t,T_t`, and zero or more isolated vent events.

```text
n_theory       = (m * f / M_A) * nu
n_initial      = P_0 * V / (R * T_0)
n_current      = P_t * V / (R * T_t)
n_vent_event   = V / R * (P_before / T_before - P_after / T_after)
n_vent_cum     = sum(event_count * n_vent_event)
n_net_evolved  = n_current - n_initial + n_vent_cum
X_apparent_pct = 100 * n_net_evolved / n_theory
P_target       = (n_initial + (target_pct / 100) * n_theory - n_vent_cum)
                 * R * T_t / V
P_target_gauge = P_target_absolute - P_amb
```

The code uses SI `R=8.31446261815324 J/(mol K)`, `PSI_PER_PA` (psi/Pa) and `FLOZ_TO_M3`. All pressures inside the gas balance are **PSIA**, never gauge, and all temperatures are kelvin. Free headspace is the gas volume, not the nominal container capacity. If initial pressure is supplied as PSIG, first compute `P_0=PSIG+P_amb`. Negative PSIG is legitimate; negative PSIA is not.

The result is total evolved-gas equivalents inferred from an inventory balance, **not CO2 partial moles**, unless all other gas sources and sinks can be excluded. A gas-composition measurement can distinguish evolving CO2 from initial air, water vapor, purge gas and solvents. Evolving gas may remain dissolved, adsorbed or condensed. Changing free headspace due to material expansion, phase change, thermal dilation, condensation or flexing violates fixed-V. An unexpectedly high value (>100%) or negative apparent conversion remains visible and flagged, never clipped.

## Seal mode

`vent_cum=0`; the estimate is current gas inventory minus baseline gas inventory. This eliminates the intentional vent-inventory approximation but **does not improve chemical specificity**. Trapped gas warming is corrected through `P/T`. A vacuum at the starting condition is not zero moles unless the physical absolute pressure approaches zero. Heated sealed vessels can fail violently. The mode models a mathematical boundary condition and is not an instruction or endorsement to construct, seal or heat an unprotected apparatus.

## Vent mode

A valid individually measured vent event has absolute pre/post pressure, gas temperature pre/post, and a **positive** net reduction in ideal-gas mole inventory. Gas evolution or inflow during the event, pressure transient, valve chatter, leaks or changing volume must be treated with a dynamic balance or independent flow measurement. Negative inferred release is rejected, not silently zeroed.

- **Recorded:** sum each independently measured event. The browser stores each event's actual endpoints.
- **Counted:** multiply one representative event by an integer count, assuming all cycles truly share the same pressure and temperature endpoints and are isolated from inflow and reaction. This is an explicitly labeled calibration shortcut, never automatic evidence of equivalence.

An independent overpressure protection path is separate from the metering path. Emergency relief devices do not serve as calibrated routine flow meters. Prefer a characterized, independent, appropriately rated metering volume separated from a vented reaction enclosure.

## Target pressure

The target pressure is conditional on **current entered gas temperature** and accumulated vent history, not a process-invariant PSI threshold. If `n_initial + n_target - n_vent_cum < 0`, no nonnegative physical target pressure exists in the simplified model and the UI shows it as unavailable. A crossing of the displayed PSI target cannot establish actual chemical completion or vessel safety.

Illustrative vacuum check: 10 g feed at 80% THCa, 16 US fl oz free gas volume, initial 3 PSIA and 20 °C, no vents; at 90 °C, a modeled 50% CO2-equivalent progression corresponds to approximately 14.04 PSIA / −0.65 PSIG when surrounding ambient is 14.69595 PSIA.

## Storage, user experience, tests

Local workspace state and saved pressure snapshots use the existing `useCalculatorWorkspace` persistence and share-snapshot workflow. Snapshots retain original absolute pressure, temperature, apparent progress, cumulative vented moles and timestamp. Export emits these records as CSV. The baseline and selection of Seal/Vent mode lock after measurements are recorded. Users must clear snapshots before changing baseline definitions; recorded vent events remain independently editable because vent bookkeeping can evolve during a run. Shared state and stored JSON logs are parsed with explicit limits and structured validation.

Use `npm test` (pressure balance, heat-only correction, vacuum, temperature-changing vent events, counted vs recorded, nonphysical bounds, heatmap regression), `npm run typecheck`, `npm run build`, and Chromium calculator QA. Browser QA should cover negative-gauge input, restoring state, modal/menu accessibility, mobile layout, and CSV export.

## Validation roadmap

1. Verify pressure-sensor absolute/gauge calibration and pressure/temperature synchronization; calibrate each measurement channel, instrument dead volume and sample headspace.
2. Measure baseline thermal-only gas pressure with nonreactive feed and verify invariant `PV/T`.
3. Verify zero vent-loss accounting in closed-to-inflow reference volumes and counted vs individually recorded repeatability at different pre/post temperatures.
4. Challenge the inference with water/solvent vapor, deliberately changed gas-space volume, gas uptake, and representative in-process leakage; these should reveal model residuals, not be reinterpreted as chemistry.
5. Compare pressure-derived apparent conversion against independent chemical assays across time and batches, with uncertainty propagation. Until then this tool is an illustrative model rather than a validated reaction-progress measurement.
