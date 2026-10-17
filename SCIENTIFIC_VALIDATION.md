# Decarboxulator V4; scientific validation ledger

Status: verified against PubChem/NRC/NIST source values and independently exercised by `tests/scientific-audit.test.ts`. Last source review: 2026-10-11.

This document defines **what the numerical results mean**. The core calculators are theoretical mass-balance and idealized gas models, not potency assays, mixture phase-equilibrium simulations, or pressure-vessel certification. The tracker additionally performs empirical modeling of **apparent gravimetric conversion**, never direct assay-derived reaction kinetics. See TRACKER_KINETICS.md for the model and validation contract.

## 1. Sources and physical constants

| Species | Mean molar mass used | Formula | Provenance |
| --- | ---: | --- | --- |
| Δ9-THCa-A | 358.47 g/mol | C22H30O4 | [PubChem CID 98523](https://pubchem.ncbi.nlm.nih.gov/compound/98523); [NRC Canada CBIS-1 certificate](https://nrc-digital-repository.canada.ca/eng/view/crt/?dsl=en&id=335aa529-82d3-4744-9c85-525dfe7e3ac0) |
| Δ9-THC | 314.46 g/mol | C21H30O2 | [PubChem CID 16078](https://pubchem.ncbi.nlm.nih.gov/compound/16078); NRC Canada CBIS-1 |
| CO₂ | ≈44.01 g/mol | CO2 | [PubChem CID 280](https://pubchem.ncbi.nlm.nih.gov/compound/280) |
| Molar gas constant | 8.31446261815324 J mol⁻¹ K⁻¹ | R | [NIST CODATA](https://physics.nist.gov/cgi-bin/cuu/Value?r%7Csearch_for=R) |
| Standard atmosphere | 101325 Pa | 1 atm | [NIST pressure conversions](https://www.nist.gov/pml/owm/metric-si/unit-conversion/pressure-and-gas-flow-unit-conversions) |

**Do not interchange exact monoisotopic masses and mean molar masses.** For macroscopic samples of natural isotopic composition, bulk molar masses are appropriate. The chosen reference masses have finite precision; writing 314.46065 or 358.47005 as if they were measured to 0.00001 g/mol would overstate that precision.

Mass ratio: `r = M(THC)/M(THCa) = 314.46/358.47 ≈ 0.87723`.

Released gas mass fraction: `q = 1-r ≈ 0.12277`. Ideal one-mole mass balance: `M(THCa) = M(THC) + M(CO₂)`, to the displayed reference precision.

## 2. Calculator equation audit

### A; THCa / THC converter

For `m_acid` grams THCa and complete stoichiometric conversion:
`m_THC = m_acid * r`;
`m_CO2 = m_acid * q`.

Reverse mode: `m_acid_equivalent = m_THC_target / r`. This is a **mass equivalence**, not a chemically reversible step and not an actual recovery rate.

### B; Batch theoretical yield

For starting total mass `B` and acidic THCa mass fraction `x`:
`m_acid = B*x`, `m_THC = B*x*r`, `m_CO2 = B*x*q`,
`m_final = B - m_CO2`, `final_THC_fraction = m_THC/m_final`.

A pure-THCa batch is **100% THC by mass in this idealization after losing CO₂**, not 87.72% THC of the *new* final mass. The 87.72% applies to starting acid mass. Starting THC, other acids, any evaporating material, and degradation are not included.

### C; Gravimetric THCa analysis

Measured mass decrease `Δm = initial - final`, assuming **all of it** is THCa-derived CO₂:
`inferred_acid = Δm/q`; `original_acid_fraction = Δm/(q*initial)`.
The only mathematically admissible mass range is `initial*(1-q) <= final <= initial`. The implementation rejects values outside it rather than inventing concentrations over 100%. Inside that range, the answer is still not a validated potency assay.

The session progress tracker uses the same mass conservation basis, but applies it across measured timepoints. For a constant vessel/lid tare `T`, initial THCa mass `A`, and any assumed nonvolatile material `B`, theoretical initial vessel mass is `T+A+B`, maximum THCa-derived CO₂ loss is `A*q`, and **apparent conversion** at measured vessel mass `m(t)` is `100*((T+A+B)-m(t))/(A*q)`. This is only interpretable as true chemical conversion under the strong assumption that *all* observed mass loss is evolved THCa-derived CO₂ and no other mass enters or leaves. Temperatures entered per observation are **measured metadata**, not fitted kinetic model parameters. The linear remaining-time extrapolation is descriptive, with no validated endpoint probability, Arrhenius model, or thermal-history correction. A user-marked completed session describes record workflow status, not chemical completion, nor confirmation by HPLC/GC.

The separately fitted first-order/stretched-exponential/induction curves and 80% conditional residual-resampling sensitivity envelopes are described in TRACKER_KINETICS.md. Unlike the legacy two-point linear ETA, those curves are empirically optimized against time-series measurements with small-sample AICc selection and quality gates. Neither approach can establish true cannabinoid conversion without independent chemical measurements.

Balance readability (entered in grams) is presented as apparent-percentage sensitivity per one mass increment, *not* a statistical confidence interval or measurement uncertainty budget. The kinetic model additionally uses a simple independent quantization-noise floor when estimating its **conditional model sensitivity**; this does not cover calibration or other systematic uncertainty. For a research record, independently validate calibration, repeatability, changes in tare, ambient draft/temperature conditions, sample removal, and volatilization; where practical use independent validated chemical assays.

### D; Edible formulation

Let starting ingredient mass be `B_g` g, original THCa mass fraction `a`, original neutral THC mass fraction `n`, fraction of THCa converted `η_c` (0–1), downstream recovery fraction `η_r` (0–1), and number of **whole** servings `N`:

`total_THC_mg = 1000*B_g*(a*r*η_c + n)*η_r`;
`THC_per_serving_mg = total_THC_mg/N`.

**η_c applies only to THCa**, whereas **η_r applies to the combined neutral THC pool**, including the pre-existing THC. These are distinct physical effects, so one recovery slider must not silently stand in for both. Both defaults are 100% (theoretical maximum). Homogeneity and experimental assay are not modeled. This is a mass estimate, not an effects or dosing prediction.

### E; Idealized sealed-vessel gas pressure

Within a **fixed headspace volume** `V`, initial trapped dry air absolute pressure `P_s`, sealing temperature `T_s`, final process temperature `T`, and THCa conversion fraction `η`:

`n_CO2 = (B_g*a/M_THCA)*η`;
`P_air_abs(T) = P_s*T/T_s`;
`P_CO2 = n_CO2*R*T/V`;
`P_total_abs = P_air_abs + P_CO2`;
`P_gauge = P_total_abs - P_ambient`.

Temperatures must be **kelvin**, volume **m³**, and pressure initially **pascal** before display in psi. The interface defaults to sealing at 70°F, 1 atm, and 100% conversion. All three assumptions are explicitly editable, including initial sealing/reference absolute pressure, and process temperature can be entered in °F or °C. The model uses US fluid ounces for the **actual free gas volume**, never the nominal vessel capacity. It has no vessel-specific temperature-dependent mechanical rating.

The shared free-gas headspace editor makes one additional **input estimate**, not a new thermodynamic law: `V_gas = V_internal - V_displaced material - V_displaced apparatus`, with volumes in consistent units. A user can supply measured displacement, or divide entered sample mass by an explicitly entered true displacement density; no material density is automatically assigned. For porous or packed material, the *packing envelope* is not interchangeable with gas-excluded displacement because connected voids can contain communicating gas. Nonpositive calculated headspace, excess displacement, and invalid inputs produce no pressure or tracking estimate. Both pressure tools use exactly the resulting US-fl-oz free-gas volume in their existing fixed-volume gas calculations. Selecting a heatmap scenario switches to its explicitly modeled free-gas volume rather than silently retaining vessel-capacity estimates.

The model omits gas dissolution, condensable vapors, water/solvent vapor, wall compliance, *unmeasured or changing* displacement/headspace, leaks/vents, unequal gas and material temperatures, pressure-dependent equilibrium, and kinetic gas release. These omitted contributions can change pressure in **either direction**. The predicted value is **not a provable upper bound**, and no predicted pressure can be called safe without vessel characteristics. In particular, 100% assumed THCa conversion is not an upper bound on total vessel pressure.

**Operating-point heatmap:** The 7 × 7 numerical study is centered exactly on the entered temperature and free-gas volume. Seven temperatures are 10 K apart on each side (with smaller spacing near absolute zero to maintain valid temperatures); seven gas volumes span factors 0.25, 0.4, 0.63, 1, 1.6, 2.5, and 4 relative to the entered headspace. The 25 central scenarios are shown on narrow mobile screens; the complete study remains available on wider screens. Changing °F to °C does **not** change these underlying physical scenarios. Each cell is an independent exact ideal-model calculation, not a bilinear approximation, interpolation or measured data point. The heatmap's seven-tone palette uses an `asinh(P_gauge/20 PSI)` compression to provide relative visual contrast across very different operating points. It is a **visualization-only normalization**, with **no physical or safety thresholds**. The current scenario is separately marked with a green crosshair; selecting any other cell previews the result without mutating inputs until the technician deliberately applies it.

**Analytic sensitivities, fixed extent:** For `P_CO2 = n_CO2 R T / V`, `∂P_gauge/∂V = -P_CO2/V` (with `V` in consistent units) and `∂P_gauge/∂T = P_abs/T` (pressure/K), holding conversion extent and other inputs constant. Changes of +10% free volume and +10°C are displayed as **exact finite recalculations**, not derivative predictions or confidence intervals. The interface can also show the explicit zero-conversion counterfactual. It does not infer pressure distributions or validated uncertainty bounds without measured input uncertainties.

**Verification:** `tests/pressure-study.test.ts` compares independent dimensional pressure expressions, numerical and analytical sensitivities, 1,200 deterministically sampled valid scenarios, °F/°C equivalence, near-absolute-zero guardrails, center-point exactness and 49-cell consistency. `scripts/test-pressure-ui.mjs` checks the interactive field at six responsive widths and in both themes, including mobile 5×5 visibility, keyboard movement, scenario application and temperature-unit invariance. These are mathematical/software consistency tests, **not** calibration against physical pressure data or laboratory vessel certification.

### F; CO₂-based progress tracker

For stable vessel tare `t`, starting acid mass `A`, inert/nonvolatile material `I`, and current measured gross mass `m`:
`m_start = t+A+I`, `max_CO2_loss = A*q`,
`loss = m_start-m`, and `apparent_completion = loss/max_CO2_loss`.

Reject mathematical conversion inference when observed loss falls outside the zero-to-maximum CO₂-only interval; **retain and flag the original mass** in IndexedDB, the lab log and CSV instead of silently clamping it into a fictional 0–100% conversion. The underlying snapshot calculation returns null for an out-of-model mass. Assumes no non-CO₂ mass change and a constant vessel tare. Other volatile losses make *apparent* completion inaccurate even when the measured mass lies within the physically admissible range.

At completion fraction `f`, `remaining_acid = A*(1-f)`, `converted_THC = A*f*r`, `remaining_content = remaining_acid + converted_THC + I`. The three content fractions must sum to 100% within floating-point tolerance.

### G; Cartridge formulation

Cartridge count `N` and fill capacity `c_g` define **desired final** mass `F=N*c_g`, rather than treating F as starting blend mass. Parts `p_i` describe **starting** blend mass proportions; `x_acid = sum(p_THCa)/sum(p_i)`. With conversion selected:

`retained_mass_fraction = 1 - x_acid*q`;
`required_starting_mass = F/retained_mass_fraction`;
`starting_mass_i = required_starting_mass * p_i/sum(p_i)`;
`final_mass_i = starting_mass_i*r` for each acid row, unchanged otherwise.

With *retain THCa* selected, use the original masses unchanged. THCa treatment is independent of pre-existing neutral THC: a mixture of acid and neutral cannabinoids can still decarboxylate its acidic fraction.

Each compound row is converted **independently**. Never multiply the aggregate converted acid mass into every duplicate THCa row; doing so violates mass conservation and can make component percentages sum beyond 100%. The final percentages are recomputed **from resulting final masses**, not copied from original parts.

The THCa, CBD, and terpene flags are **heuristic screening bands**, not chemically universal precipitation, miscibility, stability, or seal-material compatibility limits. No kinetics, crystallization thermodynamics, fill loss, or density/mL conversion is performed.

## 3. Empirical limitations

The transformation `THCa → THC + CO₂` is a stoichiometric identity at completion, but experimental yields depend on kinetics and competing losses. These are distinct claims:

- [Dussy et al. (2005), *Forensic Science International*, doi:10.1016/j.forsciint.2004.05.015](https://pubmed.ncbi.nlm.nih.gov/15734104/) examined THC recovery under analytical and smoking-simulation conditions and did not observe quantitative product recovery.
- [Wang et al. (2016/2017), *Cannabis and Cannabinoid Research*, decarboxylation study](https://pubmed.ncbi.nlm.nih.gov/28861498/) reported temperature-dependent changes consistent with first-order or pseudo-first-order kinetics over their tested conditions.
- [Cannabinoid Decarboxylation: A Comparative Kinetic Study (2020), *Industrial & Engineering Chemistry Research*, doi:10.1021/acs.iecr.0c03791](https://pubs.acs.org/doi/10.1021/acs.iecr.0c03791) documented neutral cannabinoid losses at elevated temperatures/reaction times and an oxygen effect.

No fixed process-recovery factor is valid universally. Accordingly, the default stoichiometric calculators return explicitly theoretical maxima, while edible formulation permits an *assumed* net conversion/recovery factor for the acidic fraction.

## 4. Regression contract

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:ui` after changes.

The independent tests in `tests/scientific-audit.test.ts` guard:
- reference masses, gas law dimensionality, and temperature unit invariance;
- mass conservation over multiple mass scales;
- realistic and invalid extreme concentrations;
- pure-THCa 100%-of-final-mass result and batch numerator/denominator distinction;
- analyzer's forward/inverse consistency and physically invalid losses;
- whole servings and neutral-vs-acid THC attribution;
- duplicate THCa rows, exact final cartridge targets, and conservation;
- pressure's inverse gas-volume scaling and absolute-zero rejection;
- tracker conservation and rejection of implausible excess mass loss.

**Non-goal:** tests prove implementation consistency with the stated models; they do **not** validate these models against real experimental yields, phase behavior, crystallization boundaries, or pressure-vessel safety.
