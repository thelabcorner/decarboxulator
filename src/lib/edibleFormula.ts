import { cannabinoidChemistry, isAcidCannabinoid, type AcidCannabinoid } from './cannabinoids';

export const EDIBLE_COMPOUNDS = [
  'THCa', 'THC', 'CBDa', 'CBD', 'CBGa', 'CBG', 'CBCa', 'CBC', 'CBNa', 'CBN', 'Other',
] as const;
export type EdibleCompound = typeof EDIBLE_COMPOUNDS[number];
export type EdibleMode = 'weight' | 'concentration' | 'desired';
export const EDIBLE_UNITS = {mg: 1, g: 1000, oz: 28349.523125, lb: 453592.37, kg: 1e6} as const;
export type EdibleUnit = keyof typeof EDIBLE_UNITS;
export type EdibleRow = {
  type: EdibleCompound;
  weight: number;
  unit: EdibleUnit;
  percent: number;
  target: number;
};
export const MAX_EDIBLE_ROWS = 24;
export const DEFAULT_EDIBLE_ROWS: Record<EdibleMode, EdibleRow[]> = {
  weight: [{type: 'THCa', weight: 3.5, unit: 'g', percent: 100, target: 10}],
  concentration: [{type: 'THCa', weight: 3.5, unit: 'g', percent: 18, target: 10}],
  desired: [{type: 'THCa', weight: 0, unit: 'g', percent: 100, target: 10}],
};
export interface EdibleRowResult {
  type: EdibleCompound;
  /** The neutral compound this row produces. For acids: e.g. CBDa → CBD. Same as type for neutrals/Other. */
  outputType: string;
  rawMg: number;
  /** Input amount needed. Defined in target mode, otherwise matches the input mass. */
  inputMaterialMg: number;
  /** Stoichiometric neutral output for acid rows; raw mg for neutral/Other rows. */
  outputMg: number;
}
export interface EdibleFormulaResult {
  /** Total modeled active THC mg per batch (backward compat). */
  totalThcMg: number;
  /** Per-serving modeled THC (backward compat). */
  perServingThcMg: number;
  thcaDerivedThcMg: number;
  directThcMg: number;
  rawThcaMg: number;
  /** Raw input mg per compound type (before any conversion). */
  totals: Record<EdibleCompound, number>;
  /** Stoichiometric neutral output mg keyed by neutral compound symbol. */
  outputTotals: Record<string, number>;
  rows: EdibleRowResult[];
  servings: number;
  mode: EdibleMode;
}
export const edibleRow = (type: EdibleCompound = 'THCa'): EdibleRow =>
  ({type, weight: 1, unit: 'g', percent: 100, target: 5});

export function parseEdibleRows(raw: string): EdibleRow[] | null {
  if (raw.length > 8192) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EDIBLE_ROWS) return null;
  if (!value.every(row => row && typeof row === 'object' && !Array.isArray(row) &&
    EDIBLE_COMPOUNDS.includes(row.type) && Object.hasOwn(EDIBLE_UNITS, row.unit) &&
    [row.weight, row.percent, row.target].every((n: unknown) => typeof n === 'number' &&
      Number.isFinite(n) && n >= 0 && n <= 1e9) && row.percent <= 100)) return null;
  return value.map(row => ({
    type: row.type as EdibleCompound, weight: row.weight as number,
    unit: row.unit as EdibleUnit, percent: row.percent as number, target: row.target as number,
  }));
}

function rowMultiplier(type: EdibleCompound, conversion: number, recovery: number): number {
  if (isAcidCannabinoid(type)) {
    // Conversion fraction is a user-supplied *assumption*, not transferable kinetics.
    // Preserve legacy THC-specific downstream recovery; other neutral products
    // are not automatically assigned THC's retention factor.
    return cannabinoidChemistry(type as AcidCannabinoid).ratio * conversion * (type === 'THCa' ? recovery : 1);
  }
  if (type === 'THC') return recovery;
  return 1;
}

function outputTypeForCompound(type: EdibleCompound): string {
  if (isAcidCannabinoid(type)) return cannabinoidChemistry(type as AcidCannabinoid).neutral;
  return type;
}

/** Pure calculations; no rounding until display. Reject rather than hide unachievable targets. */
export function calculateEdibleFormula(
  mode: EdibleMode, rows: EdibleRow[], servings: number,
  conversionPercent = 100, recoveryPercent = 100,
): EdibleFormulaResult | null {
  if (!['weight','concentration','desired'].includes(mode) ||
    !Number.isSafeInteger(servings) || servings <= 0 ||
    !Number.isFinite(conversionPercent) || conversionPercent < 0 || conversionPercent > 100 ||
    !Number.isFinite(recoveryPercent) || recoveryPercent < 0 || recoveryPercent > 100 ||
    !rows.length || rows.length > MAX_EDIBLE_ROWS ||
    !parseEdibleRows(JSON.stringify(rows))) return null;

  const conversion = conversionPercent / 100;
  const recovery = recoveryPercent / 100;
  const totals = Object.fromEntries(EDIBLE_COMPOUNDS.map(c => [c, 0])) as Record<EdibleCompound, number>;
  const outputTotals: Record<string, number> = {};
  let directThcMg = 0, thcaDerivedThcMg = 0;
  const outputs: EdibleRowResult[] = [];

  for (const row of rows) {
    const multiplier = rowMultiplier(row.type, conversion, recovery);
    if (mode === 'desired' && row.target > 0 && multiplier === 0) return null;
    const inputMaterialMg = mode === 'desired'
      ? (multiplier > 0 ? row.target * servings / multiplier : 0)
      : row.weight * EDIBLE_UNITS[row.unit];
    const rawMg = mode === 'concentration' ? inputMaterialMg * row.percent / 100 : inputMaterialMg;
    const outputMg = rawMg * multiplier;
    if (![rawMg, inputMaterialMg, outputMg].every(Number.isFinite)) return null;
    totals[row.type] += rawMg;
    const outType = outputTypeForCompound(row.type);
    outputTotals[outType] = (outputTotals[outType] ?? 0) + outputMg;
    if (row.type === 'THCa') thcaDerivedThcMg += outputMg;
    if (row.type === 'THC') directThcMg += outputMg;
    outputs.push({type: row.type, outputType: outType, rawMg, inputMaterialMg, outputMg});
  }
  const totalThcMg = directThcMg + thcaDerivedThcMg;
  if (!Number.isFinite(totalThcMg)) return null;
  return {
    totalThcMg, perServingThcMg: totalThcMg / servings, directThcMg,
    thcaDerivedThcMg, rawThcaMg: totals.THCa, totals, outputTotals,
    rows: outputs, servings, mode,
  };
}
