# V4 — acidic cannabinoid support

Status: implemented as **theoretical molecular-mass stoichiometry**; independent empirical kinetics remain observation-only.

## Supported source → product mappings

| Acid | Neutral product | Acid MW (g/mol) | Neutral MW (g/mol) | Mass-ratio model |
| --- | --- | ---: | ---: | --- |
| THCa | THC | 358.47 | 314.46 | 314.46 / 358.47 |
| CBDa | CBD | 358.47 | 314.46 | 314.46 / 358.47 |
| CBGa | CBG | 360.49 | 316.48 | 316.48 / 360.49 |
| CBCa | CBC | 358.47 | 314.46 | 314.46 / 358.47 |
| CBNa | CBN | 354.43 | 310.43 | 310.43 / 354.43 |

Data are centralised in `src/lib/cannabinoids.ts`. Each theoretical acid → neutral + CO₂ mass conversion is one-to-one on a *molar*, not a mass, basis. Two-decimal molar masses can round the apparent CO₂ difference to 44.00 or 44.01 g/mol.

Default is **THCa** for every new calculator and tracker session. Legacy numeric API calls and saved workspaces without a `cannabinoid` field also mean THCa. Explicitly selected acids are saved and restored from local workspaces and share links; tracker run selection belongs to the run and must not change after collecting measurements. Formula labels, target labels and breakdowns must always track the selected acid/neutral pair.

## User experience

- Use the V4 `CompactSelect` portal menu through the shared `CannabinoidSelector`, inside each calculator's **existing input panel**, not a global override or detached settings modal.
- Trigger: dense, theme-aware shadcn-zinc / New York styling, flat surfaces, Inter, lime accent; no gradient, glow or glass. Five choices display acid → neutral and the compound name as a compact subtitle. Reuse the existing menu's flipping/clamping, mouse/touch, arrow/Home/End/typeahead, Escape focus restoration and scroll dismiss.
- Each calculator has its own selected acid. A new calculator defaults to THCa. Switching one calculator does not mutate another or rewrite existing tracker history.
- Edible and cartridge formulations have **per-row compound selection**, already part of the V4 design. Extend those lists rather than adding a global override that would silently change multi-compound recipes.
- Inverses are *mass-equivalence planning*, not reverse chemistry. Pressures are idealized scenario screens, **not** safety bounds. Tracker percent completion is **apparent CO₂-only inferred** progress, not analytical proof of conversion.
- Retain canonical THCa SEO routes and their THCa-focused reference material; in-app mass calculations dynamically use the selected compound.

## Scientific applicability and limitations

- Reference: National Research Council Canada, **CBIS-1 certificate of analysis** (THCa, CBDa, CBGa, CBNa and their neutral counterparts): https://nrc-digital-repository.canada.ca/eng/view/crt/?dsl=en&id=335aa529-82d3-4744-9c85-525dfe7e3ac0
- Reference: *Cannabinoids—Characteristics and Potential for Use in Food Production* (Molecules 2021): https://pmc.ncbi.nlm.nih.gov/articles/PMC8588477/
- Reference for CBCa: FDA GSRS registry (358.47 g/mol): https://precision.fda.gov/ginas/app/ui/substances/NNW8UMP980
- Kinetics reference: Wang et al., *Decarboxylation Study of Acidic Cannabinoids* (Cannabis and Cannabinoid Research, 2016): https://pubmed.ncbi.nlm.nih.gov/28861498/ ; full text https://pmc.ncbi.nlm.nih.gov/articles/PMC5549281/

**Do not transplant THCa kinetics to other acids.** Wang et al.'s measurements in extracts at 80/95/110°C had differing apparent first-order constants (×10⁻³ s⁻¹): THCa-A 0.18/0.66/1.83, CBDa 0.05/0.27/0.83, CBGa 0.06/0.25/1.00. They also reported losses of measured CBDa/CBGa + neutral product that a one-step stoichiometric model alone cannot explain. Source matrices and degradation behaviour materially affect outcomes. No rate constants for CBCa or CBNa are inferred from those results.

Mass-loss analysis is conditional on measured weight change consisting solely of CO₂ from the *selected* acid. Presence of water, solvent, terpenes, mixed acidic cannabinoids, incomplete reactions, oxidation or neutral-product degradation invalidates that interpretation as a potency assay.

## Regression matrix

| Contract | Key checks |
| --- | --- |
| Molecular mass | For each acid, neutral + modeled CO₂ = initial mass (within FP error); forward/inverse round-trip |
| Batch | Acid fraction, remaining batch, neutral mass concentration and CO₂ conservation |
| Analyzer | Selected ratio, impossible observed losses rejected (no silently clamped apparent conversion) |
| Tracker | Per-run acid persisted, THCa migration, no mid-run chemical-identity mutations, measurement history/backup round-trips |
| Pressure | Selected molecular mass used for CO₂ moles, per-acid field labels, no misleading safety guarantee |
| Edible/cartridge | Mixed acids independently modeled, neutral products resolved by acid key, per-row selectors and old saved rows survive |
| UI | Default THCa, active acid reflected in equation/KPI/result, compact menu mobile positioning and keyboard operation |
| State | All workspaces isolate selected acids, reset to THCa, explicit share links faithfully restore selection, unknown acids rejected |
| Science | No derived temperature/time kinetics or assumed completion rates for non-THCa forms |

Run `npm run typecheck`, `npm test`, `npm run test:calculators`, `npm run build` and focused responsive UI QA before deployment.
