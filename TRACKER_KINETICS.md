# Progress tracker; empirical kinetic modeling contract

The tracker fits **CO2-equivalent apparent mass loss**, not measured THCa/THC concentrations. No kinetics model transforms a gravimetric estimate into an analytical potency assay. All results presume fixed vessel tare, complete release of generated CO2, known starting THCa mass, and no unrelated volatile losses or sample transfers.

## Candidate models and selection

For elapsed hours t since the recorded start, y is apparent conversion (0–100%).

- First order: y = 100 * (1 - exp(-k*t)).
- Stretched exponential: y = 100 * (1 - exp(-(k*t)^beta)).
- Induction first-order: replace t with max(0,t - lag).
- Induction stretched: apply both shape and lag terms.

Parameters are bounded, numerically fitted by optimized one-dimensional rate searches and local coordinate refinements. Two iterations of Huber residual reweighting suppress the influence of isolated balance outliers without deleting them. Gaussian residual-based AICc selects models with a small-sample parameter penalty. Since fitting may use robust weights, Gaussian AICc is approximate, not an exact maximum-likelihood comparison. Extra shape/lag parameters unlock at 8/12 observations; 5 observations are the minimum for a simple fit, and fitting also requires ≥5 minutes of time coverage, ≥8 percentage points of distinct change, and adequate balance signal-to-noise.

The fitted k is an **empirical time coefficient for the observed heating and mass-loss profile**, not a temperature-independent reaction constant or evidence for an elementary reaction pathway. Shapes and delays can describe heating lag, physical transport, and changing volatilization as easily as intrinsic chemistry.

## Forecasts, uncertainty, and physical limits

- Modeled 90% and 95% times refer to elapsed hours since the run start.
- A main-screen label reports *remaining* time only if the modeled crossing occurs in the future.
- Forecasts are withheld when R-squared is below 0.82, residual RMSE exceeds 12 percentage points, there are fewer than seven readings, or the target exceeds three times the observed history. With twelve or more points, the last approximately 20% is held out; a model is fit on the earlier points only, and out-of-time RMSE above 15 percentage points suppresses forecasting. This check is within a single run, not out-of-batch external validation.
- An 80% wild-residual-resampling *model sensitivity band* is drawn conditionally on the chosen curve family and existing observations. This is not a confidence or prediction interval for chemical potency, an HPLC assay, or future batches.
- Optional balance readability imposes a quantization floor: noise_pp = 100 * resolution_g / (sqrt(6) * theoretical_CO2_loss_g). This assumes independent uniform rounding of two masses; systematic calibration, convection, repeatability, assay, and volatile errors are not covered.
- Recorded temperatures can flag nonisothermal behavior; they are not used to infer an Arrhenius activation energy from a single changing run.
- Apparent conversion beyond the 0–100% CO2-only range is never silently clamped into kinetics. Both historical and newly observed out-of-model balance values remain in the original-order raw measurement history and CSV export, are visibly flagged, and are excluded from mass-balance conversions and fitted kinetics. A slight overshoot may be comparable to balance readability and is not by itself proof of another chemical process.
- The user's act of marking a run complete refers to a laboratory record state, never proof of 100% chemical conversion.

## Runtime and UX

The nonlinear optimizer and resampling run in a dedicated Web Worker. Results from outdated session revisions are discarded. The SVG display retains measured dots separate from blue model trajectories and sensitivity regions, with an animation-frame-driven inspection cursor. The UI honors reduced-motion, touch scroll, keyboard point inspection, and 320 px viewports. All session state and raw readings remain in IndexedDB; fitted summaries are recomputed from them.

## Validation fixtures

The following legacy logs were supplied for implementation regression only; their historical calculated "decarbRate" values are not accepted as kinetic measurements:

- 2024-08-29: 11 readings over nearly 119 minutes, long initial apparent induction then strong mass loss.
- 2025-11-01: 13 readings over 39.4 minutes, late apparent completion around 97.5%.
- 2025-12-13: 8 uneven observations, last mass-loss reading slightly exceeds the CO2-only theoretical maximum and is explicitly flagged.

The numeric regression suite also executes 64 seeded noisy first-order realizations, 30 seeded sigmoidal runs, plateau/unidentifiable cases, variable-temperature warnings, physically bounded monotone predictions, and a 500-reading load. Browser QA checks 50 properties on five screen widths, including persisted historical data, accessible model graphics, and reduced-motion behavior. These are **software verification experiments**, not validation of the model against independent chemical assays or prospective laboratory outcomes.

## Literature context

- Wang et al., Decarboxylation Study of Acidic Cannabinoids (2016), PMID 28861498: https://pmc.ncbi.nlm.nih.gov/articles/PMC5549281/
- Cannabinoid Decarboxylation: A Comparative Kinetic Study (2020), DOI 10.1021/acs.iecr.0c03791: https://pubs.acs.org/doi/10.1021/acs.iecr.0c03791
- The fitting/uncertainty limitations are implementation methodology, not claims taken from either cannabinoid paper.
