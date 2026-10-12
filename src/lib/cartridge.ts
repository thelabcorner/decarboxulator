/**
 * Cartridge / isolate formulation math.
 * Ported from v2/isolate-calculator.html.
 */
import { CONVERSION_RATIO } from './decarb';

export const COMPOUND_TYPES = ['THC', 'THCa', 'CBD', 'CBN', 'CBG', 'THCV', 'Terpenes', 'Other'] as const;
export type CompoundType = (typeof COMPOUND_TYPES)[number];
/** Treat the THCa fraction as completely converted or intentionally retain it. */
export type AcidTreatment = 'convert' | 'retain';

export interface CompoundRow {
  type: CompoundType;
  parts: number;
}

export interface CompoundResult {
  type: CompoundType;
  /** Final compound type (THCa → THC in decarb-only mode) */
  finalType: CompoundType;
  inputWeightG: number;
  finalWeightG: number;
  finalPct: number;
}

export interface CartridgeResult {
  /** Starting blend mass (may exceed requested filled mass due to CO2 release). */
  totalInputWeightG: number;
  totalFinalWeightG: number;
  compounds: CompoundResult[];
  /** True if the selected model converts the THCa fraction to THC. */
  thcaOnlyMode: boolean;
  /** Total THCa input weight before decarb */
  thcaInputG: number;
  /** THC output from THCa decarb */
  thcFromThcaG: number;
  /** Effective carts fillable at given capacity */
  effectiveCarts: number;
  warnings: {
    crystallization: boolean;
    cbdCryst: boolean;
    terpenes: boolean;
  };
}

export function calculateCartridge(
  rows: CompoundRow[],
  cartCount: number,
  cartCapacityG: number,
  acidTreatment: AcidTreatment = 'convert',
): CartridgeResult | null {
  if (!Array.isArray(rows) || rows.length === 0 ||
      !Number.isSafeInteger(cartCount) || cartCount <= 0 || !Number.isFinite(cartCapacityG) || !(cartCapacityG > 0) ||
      (acidTreatment !== 'convert' && acidTreatment !== 'retain') ||
      !rows.every(row => COMPOUND_TYPES.includes(row.type) && Number.isFinite(row.parts) && row.parts >= 0)) return null;
  const totalParts = rows.reduce((s, r) => s + r.parts, 0);
  if (!(totalParts > 0) || !Number.isFinite(totalParts)) return null;

  const totalTargetWeightG = cartCount * cartCapacityG;
  const hasThca = rows.some(r => r.type === 'THCa' && r.parts > 0);
  // Pre-existing THC does not inhibit the stoichiometric THCa → THC reaction.
  // Whether to model conversion must be independent of other blend constituents.
  const thcaOnlyMode = hasThca && acidTreatment === 'convert';

  // Parts are relative INPUT blend masses. The number of cartridges is a FINAL
  // fill target. Backsolve the necessary starting mass when acid is converted.
  const thcaPartFraction = thcaOnlyMode
    ? rows.filter(r => r.type === 'THCa').reduce((sum, r) => sum + r.parts, 0) / totalParts
    : 0;
  const retainedFraction = 1 - thcaPartFraction * (1 - CONVERSION_RATIO);
  const totalInputWeightG = totalTargetWeightG / retainedFraction;
  if (!Number.isFinite(totalInputWeightG)) return null;

  // Compute pre-decarboxylation input mass per compound.
  const base: Array<CompoundRow & { inputWeightG: number; inputPct: number }> = rows.map(r => {
    const inputPct = (r.parts / totalParts) * 100;
    return { ...r, inputPct, inputWeightG: totalInputWeightG * (inputPct / 100) };
  });

  // In thcaOnlyMode: THCa → THC conversion reduces total weight
  let thcaInputG = 0;
  let thcFromThcaG = 0;

  thcaInputG = thcaOnlyMode
    ? base.filter(r => r.type === 'THCa').reduce((sum, r) => sum + r.inputWeightG, 0)
    : 0;
  thcFromThcaG = thcaInputG * CONVERSION_RATIO;
  const outputMasses = base.map(r => ({
        type: r.type,
        finalType: thcaOnlyMode && r.type === 'THCa' ? 'THC' as CompoundType : r.type,
        inputWeightG: r.inputWeightG,
        finalWeightG: thcaOnlyMode && r.type === 'THCa'
          ? r.inputWeightG * CONVERSION_RATIO : r.inputWeightG,
      }));
  const totalFinalWeightG = outputMasses.reduce((sum, r) => sum + r.finalWeightG, 0);
  const compounds: CompoundResult[] = outputMasses.map(r => ({
    ...r, finalPct: totalFinalWeightG > 0 ? r.finalWeightG / totalFinalWeightG * 100 : 0,
  }));
  // Floating point backsolving may produce e.g. 9.999999999999998 carts.
  const effectiveCarts = Math.min(cartCount, Math.floor(totalFinalWeightG / cartCapacityG + 1e-10));

  // Consolidated percentages for warnings
  const consolidated = new Map<CompoundType, number>();
  for (const c of compounds) {
    consolidated.set(c.finalType, (consolidated.get(c.finalType) ?? 0) + c.finalPct);
  }

  return {
    totalInputWeightG,
    totalFinalWeightG,
    compounds,
    thcaOnlyMode,
    thcaInputG,
    thcFromThcaG,
    effectiveCarts,
    warnings: {
      crystallization: (consolidated.get('THCa') ?? 0) >= 15,
      cbdCryst: (consolidated.get('CBD') ?? 0) >= 20,
      terpenes: (consolidated.get('Terpenes') ?? 0) >= 10,
    },
  };
}

/** Alternate V3 workflow: determine finished fill yield from an available input batch. */
export function calculateCartridgeFromInput(
  rows: CompoundRow[], initialBlendG: number, cartCapacityG: number,
  acidTreatment: AcidTreatment = 'convert',
): CartridgeResult | null {
  if (!Number.isFinite(initialBlendG) || initialBlendG <= 0 ||
      !Number.isFinite(cartCapacityG) || cartCapacityG <= 0) return null;
  // The forward model backsolves initial mass from a specified final fill.
  // Its linear mass balance can be reused with a single initial trial gram
  // to obtain the retained output fraction without duplicating chemistry.
  const unit = calculateCartridge(rows, 1, 1, acidTreatment);
  if (!unit || !Number.isFinite(unit.totalInputWeightG) || unit.totalInputWeightG <= 0) return null;
  const scale = initialBlendG / unit.totalInputWeightG;
  const compounds = unit.compounds.map(c=>({...c,inputWeightG:c.inputWeightG*scale,
    finalWeightG:c.finalWeightG*scale}));
  const totalFinalWeightG = compounds.reduce((s,c)=>s+c.finalWeightG,0);
  const effectiveCarts = Math.floor(totalFinalWeightG / cartCapacityG + 1e-10);
  return {...unit,totalInputWeightG:initialBlendG,totalFinalWeightG,compounds,
    thcaInputG:unit.thcaInputG*scale,thcFromThcaG:unit.thcFromThcaG*scale,effectiveCarts};
}

/** Consolidate compounds by finalType, summing weight and pct */
export function consolidateCompounds(
  compounds: CompoundResult[],
): Map<CompoundType, { weightG: number; pct: number }> {
  const map = new Map<CompoundType, { weightG: number; pct: number }>();
  for (const c of compounds) {
    const existing = map.get(c.finalType) ?? { weightG: 0, pct: 0 };
    map.set(c.finalType, { weightG: existing.weightG + c.finalWeightG, pct: existing.pct + c.finalPct });
  }
  return map;
}
