import { CONVERSION_RATIO } from './decarb';

/** Original V3 v2.3 modes, with explicit recovery and independent cannabinoids. */
export const EDIBLE_COMPOUNDS = ['THCa', 'THC', 'CBD', 'CBN', 'CBG', 'Other'] as const;
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
  desired: [{type: 'THC', weight: 0, unit: 'g', percent: 100, target: 10}],
};
export interface EdibleRowResult {
  type: EdibleCompound;
  rawMg: number;
  /** Input amount needed. Defined in target mode, otherwise matches the input mass. */
  inputMaterialMg: number;
  /** THCa-derived THC after conversion and downstream recovery; raw mg for other compounds. */
  outputMg: number;
}
export interface EdibleFormulaResult {
  totalThcMg: number;
  perServingThcMg: number;
  thcaDerivedThcMg: number;
  directThcMg: number;
  rawThcaMg: number;
  totals: Record<EdibleCompound, number>;
  rows: EdibleRowResult[];
  servings: number;
  /** A target is an amount of active cannabinoid per serving, not a raw THCa mass. */
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
  const totals: Record<EdibleCompound, number> = {THCa: 0, THC: 0, CBD: 0, CBN: 0, CBG: 0, Other: 0};
  let directThcMg = 0, thcaDerivedThcMg = 0;
  const outputs: EdibleRowResult[] = [];
  for (const row of rows) {
    // In desired mode targets are recovered active mg/serving. THCa must be
    // back-solved through both conversion and recovery; the legacy page did not.
    const multiplier = row.type === 'THCa' ? CONVERSION_RATIO * conversion * recovery :
      row.type === 'THC' ? recovery : 1;
    if (mode === 'desired' && row.target > 0 && multiplier === 0) return null;
    const inputMaterialMg = mode === 'desired'
      ? (multiplier > 0 ? row.target * servings / multiplier : 0)
      : row.weight * EDIBLE_UNITS[row.unit];
    const rawMg = mode === 'concentration' ? inputMaterialMg * row.percent / 100 : inputMaterialMg;
    const outputMg = rawMg * multiplier;
    if (![rawMg, inputMaterialMg, outputMg].every(Number.isFinite)) return null;
    totals[row.type] += rawMg;
    if (row.type === 'THCa') thcaDerivedThcMg += outputMg;
    if (row.type === 'THC') directThcMg += outputMg;
    outputs.push({type:row.type, rawMg, inputMaterialMg, outputMg});
  }
  const totalThcMg = directThcMg + thcaDerivedThcMg;
  if (!Number.isFinite(totalThcMg)) return null;
  return {totalThcMg, perServingThcMg: totalThcMg / servings, directThcMg,
    thcaDerivedThcMg, rawThcaMg: totals.THCa, totals, rows: outputs, servings, mode};
}
