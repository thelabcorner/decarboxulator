/**
 * Stoichiometric calculations. All internal masses are in grams.
 * These model a theoretical reaction, not empirical conversion kinetics.
 */
// Mean molar masses in g/mol (NRC Canada CBIS-1 reference material,
// PubChem CID 98523 / 16078; not monoisotopic exact masses).
export const MW_THCA = 358.47;
export const MW_THC = 314.46;
export const MW_CO2 = MW_THCA - MW_THC;
export const CONVERSION_RATIO = MW_THC / MW_THCA;
export const CO2_RATIO = 1 - CONVERSION_RATIO;
export const MAX_INPUT = 1e9;
/** THC-equivalent fraction reported on the same mass basis, without recovery assumptions. */
export function potentialTotalThcPercent(thcPercent: number, thcaPercent: number): number | null {
  if (![thcPercent, thcaPercent].every(Number.isFinite) ||
      thcPercent < 0 || thcaPercent < 0 || thcPercent + thcaPercent > 100) return null;
  return thcPercent + thcaPercent * CONVERSION_RATIO;
}

export type Direction = 'decarb' | 'reverse';
export type UnitKey = 'mg' | 'g' | 'kg';
export const UNITS: Record<UnitKey, { label: string; toGrams: number }> = {
  mg: { label: 'mg', toGrams: 0.001 },
  g: { label: 'g', toGrams: 1 },
  kg: { label: 'kg', toGrams: 1000 },
};
export const UNIT_KEYS: UnitKey[] = ['mg', 'g', 'kg'];

export interface ParsedAmount { value: number | null; error: string | null }

export function parseAmount(raw: string, options: { max?: number; min?: number } = {}): ParsedAmount {
  const text = raw.trim();
  if (!text) return { value: null, error: 'Enter a value' };
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    return { value: null, error: 'Enter a valid number' };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return { value: null, error: 'Value is too large' };
  if (value < (options.min ?? 0)) return { value: null, error: options.min ? `Must be at least ${options.min}` : 'Cannot be negative' };
  if (value > (options.max ?? MAX_INPUT)) return { value: null, error: 'Value is out of range' };
  return { value, error: null };
}

export interface DecarbResult { outputGrams: number; co2Grams: number }
export function convert(grams: number, direction: Direction): DecarbResult {
  if (!Number.isFinite(grams) || grams < 0 || (direction !== 'decarb' && direction !== 'reverse')) {
    throw new RangeError('Conversion requires a nonnegative finite mass and a valid direction');
  }
  const outputGrams = direction === 'decarb' ? grams * CONVERSION_RATIO : grams / CONVERSION_RATIO;
  return { outputGrams, co2Grams: Math.abs(outputGrams - grams) };
}

export function fromGrams(grams: number, unit: UnitKey): number {
  return grams / UNITS[unit].toGrams;
}
export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value !== 0 && Math.abs(value) < 0.0005) return value.toExponential(3);
  return value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) });
}
export function formatAmount(grams: number, unit: UnitKey): string {
  return formatNumber(fromGrams(grams, unit));
}

export interface BatchResult {
  thcaGrams: number; thcGrams: number; co2Grams: number;
  finalWeightGrams: number; finalThcPercent: number;
}
export function calculateBatch(totalGrams: number, thcaPercent: number): BatchResult {
  if (!Number.isFinite(totalGrams) || totalGrams < 0 || !Number.isFinite(thcaPercent) ||
      thcaPercent < 0 || thcaPercent > 100) {
    throw new RangeError('Batch requires nonnegative finite mass and THCa percentage from 0 to 100');
  }
  const thcaGrams = totalGrams * thcaPercent / 100;
  const thcGrams = thcaGrams * CONVERSION_RATIO;
  const co2Grams = thcaGrams - thcGrams;
  const finalWeightGrams = totalGrams - co2Grams;
  return {
    thcaGrams, thcGrams, co2Grams, finalWeightGrams,
    finalThcPercent: finalWeightGrams > 0 ? thcGrams / finalWeightGrams * 100 : 0,
  };
}

export interface MassLossResult {
  lossGrams: number; thcaGrams: number; thcGrams: number;
  thcaPercent: number; thcPercentAfter: number; maxLossGrams: number;
}
export function analyzeMassLoss(initialGrams: number, finalGrams: number): MassLossResult | null {
  if (![initialGrams, finalGrams].every(Number.isFinite) ||
      !(initialGrams > 0) || finalGrams < 0 || finalGrams > initialGrams) return null;
  const lossGrams = initialGrams - finalGrams;
  const maxLossGrams = initialGrams * CO2_RATIO;
  // Larger losses cannot be explained by THCa -> THC + CO2 alone.
  if (lossGrams > maxLossGrams + maxLossGrams * 1e-10 +
      Number.EPSILON * initialGrams * 8) return null;
  const thcaGrams = Math.min(initialGrams, lossGrams / CO2_RATIO);
  const thcGrams = thcaGrams * CONVERSION_RATIO;
  return {
    lossGrams, thcaGrams, thcGrams, maxLossGrams,
    thcaPercent: thcaGrams / initialGrams * 100,
    thcPercentAfter: finalGrams > 0 ? thcGrams / finalGrams * 100 : 0,
  };
}

export interface EdibleResult {
  totalThcMg: number; servingThcMg: number;
  acidThcMg: number; startingThcMg: number;
}
export function calculateEdibles(
  materialGrams: number, thcaPercent: number, thcPercent: number,
  servings: number, acidConversionPercent: number, postProcessRecoveryPercent = 100,
): EdibleResult | null {
  if (![materialGrams, thcaPercent, thcPercent, servings, acidConversionPercent,
      postProcessRecoveryPercent].every(Number.isFinite) ||
      materialGrams < 0 || !Number.isSafeInteger(servings) || servings <= 0 ||
      thcaPercent < 0 || thcaPercent > 100 || thcPercent < 0 || thcPercent > 100 ||
      thcaPercent + thcPercent > 100 || acidConversionPercent < 0 || acidConversionPercent > 100 ||
      postProcessRecoveryPercent < 0 || postProcessRecoveryPercent > 100) return null;
  // Separate acid decarboxylation completion from downstream THC recovery.
  // Pre-existing neutral THC never participates in acid decarboxylation, but
  // can still be lost during subsequent processing.
  const recovered = postProcessRecoveryPercent / 100;
  const acidThcMg = materialGrams * 1000 * thcaPercent / 100 * CONVERSION_RATIO * acidConversionPercent / 100 * recovered;
  const startingThcMg = materialGrams * 1000 * thcPercent / 100 * recovered;
  const totalThcMg = acidThcMg + startingThcMg;
  return { totalThcMg, servingThcMg: totalThcMg / servings, acidThcMg, startingThcMg };
}

export interface TrackerConfig {
  /** Container (tare) weight in grams */
  tareG: number;
  /** Initial THCa mass in grams */
  thcaG: number;
  /** Other cannabinoids / non-volatile mass in grams */
  otherG: number;
}

export interface TrackerSnapshot {
  completion: number;
  weightLossG: number;
  remainingThcaG: number;
  convertedThcG: number;
  thcaPct: number;
  thcPct: number;
  otherPct: number;
  contentWeightG: number;
}

export interface TrackerSetup {
  initialTotalG: number;
  expectedFinalThcG: number;
  expectedCo2LossG: number;
  expectedFinalContentG: number;
}

export function trackerSetup(cfg: TrackerConfig): TrackerSetup {
  return {
    initialTotalG: cfg.tareG + cfg.thcaG + cfg.otherG,
    expectedFinalThcG: cfg.thcaG * CONVERSION_RATIO,
    expectedCo2LossG: cfg.thcaG * CO2_RATIO,
    expectedFinalContentG: cfg.thcaG * CONVERSION_RATIO + cfg.otherG,
  };
}

/** Compute a snapshot from current vessel weight reading. Returns null for invalid input. */
export function trackerSnapshot(
  currentWeightG: number,
  cfg: TrackerConfig,
  setup: TrackerSetup,
): TrackerSnapshot | null {
  if (![currentWeightG, cfg.tareG, cfg.thcaG, cfg.otherG,
        setup.initialTotalG, setup.expectedCo2LossG].every(Number.isFinite) ||
      cfg.tareG < 0 || !(cfg.thcaG > 0) || cfg.otherG < 0 ||
      !(setup.expectedCo2LossG > 0) || !(currentWeightG > 0) ||
      currentWeightG > setup.initialTotalG) return null;

  const weightLossG = setup.initialTotalG - currentWeightG;
  // A loss greater than all possible THCa-derived CO2 cannot be modeled as
  // additional decarboxylation. Never silently clamp impossible readings.
  if (weightLossG > setup.expectedCo2LossG + setup.expectedCo2LossG * 1e-10 +
      Number.EPSILON * setup.initialTotalG * 8) return null;
  const completion = Math.min(100, Math.max(0, (weightLossG / setup.expectedCo2LossG) * 100));

  const contentWeightG = currentWeightG - cfg.tareG;
  const remainingThcaG = cfg.thcaG * (1 - completion / 100);
  const convertedThcG = cfg.thcaG * CONVERSION_RATIO * (completion / 100);

  return {
    completion,
    weightLossG,
    remainingThcaG,
    convertedThcG,
    contentWeightG,
    thcaPct: contentWeightG > 0 ? (remainingThcaG / contentWeightG) * 100 : 0,
    thcPct: contentWeightG > 0 ? (convertedThcG / contentWeightG) * 100 : 0,
    otherPct: contentWeightG > 0 ? (cfg.otherG / contentWeightG) * 100 : 0,
  };
}
