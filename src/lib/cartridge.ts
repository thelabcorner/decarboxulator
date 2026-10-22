/**
 * Cartridge / isolate formulation math.
 * Ported from v2/isolate-calculator.html.
 */
import { CONVERSION_RATIO } from './decarb';
import { cannabinoidChemistry, isAcidCannabinoid, ACID_CANNABINOID_KEYS, type AcidCannabinoid } from './cannabinoids';

export const COMPOUND_TYPES = [
  'THC', 'THCa', 'CBD', 'CBDa', 'CBN', 'CBNa', 'CBG', 'CBGa', 'CBC', 'CBCa', 'THCV', 'Terpenes', 'Other',
] as const;
export type CompoundType = (typeof COMPOUND_TYPES)[number];
/** Treat all acidic cannabinoid fractions as completely converted or intentionally retained. */
export type AcidTreatment = 'convert' | 'retain';

export interface CompoundRow {
  type: CompoundType;
  parts: number;
}

export interface CompoundResult {
  type: CompoundType;
  /** Final compound type after any acid conversion (e.g. CBDa → CBD in convert mode). */
  finalType: CompoundType;
  inputWeightG: number;
  finalWeightG: number;
  finalPct: number;
}

export interface AcidBreakdownEntry {
  acidType: string;
  neutralType: string;
  inputG: number;
  outputG: number;
}

export interface CartridgeResult {
  /** Starting blend mass (may exceed requested filled mass due to CO2 release). */
  totalInputWeightG: number;
  totalFinalWeightG: number;
  compounds: CompoundResult[];
  /** True if THCa rows are converted. Preserved for backward-compatible clients/tests. */
  thcaOnlyMode: boolean;
  /** Total THCa input weight before decarb (backward compat). */
  thcaInputG: number;
  /** THC output from THCa decarb (backward compat). */
  thcFromThcaG: number;
  /** Effective carts fillable at given capacity. */
  effectiveCarts: number;
  /** Per-acid input and neutral output masses when acidTreatment='convert'. Empty when retaining. */
  acidBreakdown: AcidBreakdownEntry[];
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
      !Number.isSafeInteger(cartCount) || cartCount <= 0 ||
      !Number.isFinite(cartCapacityG) || !(cartCapacityG > 0) ||
      (acidTreatment !== 'convert' && acidTreatment !== 'retain') ||
      !rows.every(row => COMPOUND_TYPES.includes(row.type) && Number.isFinite(row.parts) && row.parts >= 0)) return null;
  const totalParts = rows.reduce((s, r) => s + r.parts, 0);
  if (!(totalParts > 0) || !Number.isFinite(totalParts)) return null;

  const totalTargetWeightG = cartCount * cartCapacityG;

  // Backsolve starting mass: account for CO2 released from ALL acid types when converting.
  let totalCo2LossFraction = 0;
  if (acidTreatment === 'convert') {
    for (const r of rows) {
      if (r.parts > 0 && isAcidCannabinoid(r.type)) {
        const chem = cannabinoidChemistry(r.type as AcidCannabinoid);
        totalCo2LossFraction += (r.parts / totalParts) * chem.co2Ratio;
      }
    }
  }
  const retainedFraction = 1 - totalCo2LossFraction;
  const totalInputWeightG = totalTargetWeightG / retainedFraction;
  if (!Number.isFinite(totalInputWeightG)) return null;

  const base = rows.map(r => {
    const inputPct = (r.parts / totalParts) * 100;
    return {...r, inputPct, inputWeightG: totalInputWeightG * (inputPct / 100)};
  });

  const outputMasses = base.map(r => {
    const convert = acidTreatment === 'convert' && isAcidCannabinoid(r.type);
    const chem = convert ? cannabinoidChemistry(r.type as AcidCannabinoid) : null;
    return {
      type: r.type,
      finalType: convert ? chem!.neutral as CompoundType : r.type,
      inputWeightG: r.inputWeightG,
      finalWeightG: convert ? r.inputWeightG * chem!.ratio : r.inputWeightG,
    };
  });

  const totalFinalWeightG = outputMasses.reduce((sum, r) => sum + r.finalWeightG, 0);
  const compounds: CompoundResult[] = outputMasses.map(r => ({
    ...r, finalPct: totalFinalWeightG > 0 ? r.finalWeightG / totalFinalWeightG * 100 : 0,
  }));

  // Backward-compat: THCa-specific fields for legacy clients/tests.
  const thcaOnlyMode = acidTreatment === 'convert' && rows.some(r => r.type === 'THCa' && r.parts > 0);
  const thcaInputG = thcaOnlyMode
    ? base.filter(r => r.type === 'THCa').reduce((s, r) => s + r.inputWeightG, 0)
    : 0;
  const thcFromThcaG = thcaInputG * CONVERSION_RATIO;

  // Per-acid breakdown for display in convert mode.
  const acidBreakdown: AcidBreakdownEntry[] = [];
  if (acidTreatment === 'convert') {
    for (const acidKey of ACID_CANNABINOID_KEYS) {
      const acidInputG = base.filter(r => r.type === acidKey).reduce((s, r) => s + r.inputWeightG, 0);
      if (acidInputG > 0) {
        const chem = cannabinoidChemistry(acidKey);
        acidBreakdown.push({
          acidType: acidKey,
          neutralType: chem.neutral,
          inputG: acidInputG,
          outputG: acidInputG * chem.ratio,
        });
      }
    }
  }

  const effectiveCarts = Math.min(cartCount, Math.floor(totalFinalWeightG / cartCapacityG + 1e-10));

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
    acidBreakdown,
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
  const unit = calculateCartridge(rows, 1, 1, acidTreatment);
  if (!unit || !Number.isFinite(unit.totalInputWeightG) || unit.totalInputWeightG <= 0) return null;
  const scale = initialBlendG / unit.totalInputWeightG;
  const compounds = unit.compounds.map(c => ({
    ...c, inputWeightG: c.inputWeightG * scale, finalWeightG: c.finalWeightG * scale,
  }));
  const totalFinalWeightG = compounds.reduce((s, c) => s + c.finalWeightG, 0);
  const acidBreakdown = unit.acidBreakdown.map(b => ({
    ...b, inputG: b.inputG * scale, outputG: b.outputG * scale,
  }));
  const effectiveCarts = Math.floor(totalFinalWeightG / cartCapacityG + 1e-10);
  return {
    ...unit, totalInputWeightG: initialBlendG, totalFinalWeightG, compounds, acidBreakdown,
    thcaInputG: unit.thcaInputG * scale, thcFromThcaG: unit.thcFromThcaG * scale, effectiveCarts,
  };
}

/** Consolidate compounds by finalType, summing weight and pct. */
export function consolidateCompounds(
  compounds: CompoundResult[],
): Map<CompoundType, { weightG: number; pct: number }> {
  const map = new Map<CompoundType, { weightG: number; pct: number }>();
  for (const c of compounds) {
    const existing = map.get(c.finalType) ?? {weightG: 0, pct: 0};
    map.set(c.finalType, {weightG: existing.weightG + c.finalWeightG, pct: existing.pct + c.finalPct});
  }
  return map;
}

/** Group starting ingredient masses, preserving THCa separately from final THC. */
export function consolidateStartingCompounds(compounds: CompoundResult[]): Map<CompoundType, number> {
  const map = new Map<CompoundType, number>();
  for (const compound of compounds) {
    if (!(compound.inputWeightG > 0)) continue;
    map.set(compound.type, (map.get(compound.type) ?? 0) + compound.inputWeightG);
  }
  return map;
}

/** Stage-aware mass accounting, reserving terpenes for addition after modeled decarb.
 * 'Other' is tracked separately; no process loss or heat compatibility is assumed.
 */
export interface CartridgeStageMasses {
  startingCannabinoidsG: number;
  startingOtherG: number;
  preTerpeneStartingG: number;
  terpeneAdditionG: number;
  grossStartingG: number;
  co2ReleasedG: number;
  finishedCannabinoidsG: number;
  preTerpeneFinishedG: number;
  finalBlendG: number;
}
export function summarizeCartridgeStages(compounds: readonly CompoundResult[]): CartridgeStageMasses {
  let startingCannabinoidsG = 0;
  let startingOtherG = 0;
  let terpeneAdditionG = 0;
  let co2ReleasedG = 0;
  let finishedCannabinoidsG = 0;
  for (const compound of compounds) {
    if (compound.type === 'Terpenes') {
      terpeneAdditionG += compound.inputWeightG;
    } else if (compound.type === 'Other') {
      startingOtherG += compound.inputWeightG;
    } else {
      startingCannabinoidsG += compound.inputWeightG;
      finishedCannabinoidsG += compound.finalWeightG;
      co2ReleasedG += compound.inputWeightG - compound.finalWeightG;
    }
  }
  const preTerpeneStartingG = startingCannabinoidsG + startingOtherG;
  const preTerpeneFinishedG = finishedCannabinoidsG + startingOtherG;
  return {
    startingCannabinoidsG, startingOtherG, preTerpeneStartingG,
    terpeneAdditionG, grossStartingG: preTerpeneStartingG + terpeneAdditionG,
    co2ReleasedG, finishedCannabinoidsG, preTerpeneFinishedG,
    finalBlendG: preTerpeneFinishedG + terpeneAdditionG,
  };
}
