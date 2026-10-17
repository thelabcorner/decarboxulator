/**
 * Idealized sealed-headspace screening model (NOT a design pressure or safety bound).
 *
 * Assumptions: rigid fixed gas volume, initially sealed at absolute P0/T0,
 * independently specified initial gas pressure and outside gauge reference, ideal-gas behavior,
 * no exchange of gas, and an explicitly chosen fraction of THCa releasing CO2.
 * Other gas generation, condensable vapors, sample displacement, dissolution,
 * unequal temperatures and changing pressure boundaries are excluded.
 */
import { type ParsedAmount } from './decarb';
import { cannabinoidChemistry, DEFAULT_ACID_CANNABINOID, type AcidCannabinoid } from './cannabinoids';

export const R_SI = 8.31446261815324;            // Pa·m³/(mol·K)
export const PSI_PER_PA = 1 / 6894.757293168;
export const FLOZ_TO_M3 = 29.5735295625e-6;       // US fluid ounce
export const P_ATM_PSI = 14.695948775513449;

export type TempUnit = 'F' | 'C';

export function toKelvin(temp: number, unit: TempUnit): number {
  return unit === 'F' ? (temp - 32) * 5 / 9 + 273.15 : temp + 273.15;
}
export function fromKelvin(tempK: number, unit: TempUnit): number {
  return unit === 'F' ? (tempK - 273.15) * 9 / 5 + 32 : tempK - 273.15;
}
export function convertTemp(value: number, from: TempUnit, to: TempUnit): number {
  return from === to ? value : fromKelvin(toKelvin(value, from), to);
}

/** Signed temperatures are valid, but must represent strictly positive K. */
export function parseTemperature(raw: string, unit: TempUnit): ParsedAmount {
  const trimmed = raw.trim();
  if (!trimmed) return {value:null, error:'Enter a temperature'};
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed))
    return {value:null, error:'Enter a valid temperature'};
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return {value:null, error:'Temperature is out of range'};
  if (!(toKelvin(value, unit) > 0)) return {value:null, error:'Must be above absolute zero'};
  return {value, error:null};
}

export interface PressureInput {
  weightG: number;
  thcaPct: number;
  tempValue: number;
  tempUnit: TempUnit;
  /** Free gas volume at process conditions, NOT nominal container capacity. */
  headspaceFloz: number;
  /** Sealing temperature, degrees Fahrenheit. */
  sealTempF?: number;
  /** Ambient absolute pressure used solely to define gauge PSI. */
  ambientPsi?: number;
  /** Initial sealed-gas absolute pressure; defaults to ambient for legacy callers. */
  sealPsi?: number;
  /** Fraction of THCa converted, range [0,1]. Not a reaction efficiency guarantee. */
  efficiency?: number;
  /** Acidic cannabinoid for stoichiometry. Defaults to THCa. */
  cannabinoid?: AcidCannabinoid;
}
export interface PressureResult {
  thcaG: number;
  co2G: number;
  nCo2Mol: number;
  /** Absolute pressure from the original trapped gas at process temperature. */
  pAirPsi: number;
  pCo2Psi: number;
  pAbsPsi: number;
  /** Difference relative to the reference ambient pressure. May be negative. */
  pGaugePsi: number;
  /** Heating alone (the initial gas at T/T0), excluding starting vacuum. */
  pThermalGaugePsi: number;
  /** Baseline absolute pressure relative to the entered ambient reference. */
  pBaselineGaugePsi: number;
  /** Physical / parametric sensitivity, not a statistically derived uncertainty. */
  dGaugePerFloz: number;
  dGaugePerC: number;
}

export function computePressure(input: PressureInput): PressureResult | null {
  const {weightG,thcaPct,tempValue,tempUnit,headspaceFloz} = input;
  const sealTempF = input.sealTempF ?? 70;
  const ambientPsi = input.ambientPsi ?? P_ATM_PSI;
  const sealPsi = input.sealPsi ?? ambientPsi;
  const fraction = input.efficiency ?? 1;
  const tempK = toKelvin(tempValue, tempUnit);
  const sealK = toKelvin(sealTempF, 'F');
  if (tempUnit !== 'C' && tempUnit !== 'F') return null;
  if (![weightG,thcaPct,tempValue,headspaceFloz,sealTempF,ambientPsi,sealPsi,fraction,tempK,sealK].every(Number.isFinite) ||
      weightG <= 0 || thcaPct < 0 || thcaPct > 100 || headspaceFloz <= 0 ||
      sealK <= 0 || tempK <= 0 || ambientPsi <= 0 || sealPsi < 0 || fraction < 0 || fraction > 1) return null;
  const {acidMw, co2Mw} = cannabinoidChemistry(input.cannabinoid ?? DEFAULT_ACID_CANNABINOID);
  const thcaG = weightG * thcaPct / 100;
  const nCo2Mol = thcaG * fraction / acidMw;
  const co2G = nCo2Mol * co2Mw;
  const pAirPsi = sealPsi * tempK / sealK;
  const pCo2Psi = (nCo2Mol * R_SI * tempK / (headspaceFloz * FLOZ_TO_M3)) * PSI_PER_PA;
  const pAbsPsi = pAirPsi + pCo2Psi;
  const pGaugePsi = pAbsPsi - ambientPsi;
  const pThermalGaugePsi = pAirPsi - sealPsi;
  const pBaselineGaugePsi = sealPsi - ambientPsi;
  const dGaugePerFloz = -pCo2Psi / headspaceFloz;
  const dGaugePerC = pAbsPsi / tempK;  // ∂P_gauge/∂T at constant volume and extent
  if (![thcaG,nCo2Mol,co2G,pAirPsi,pCo2Psi,pAbsPsi,pGaugePsi,
    pThermalGaugePsi,pBaselineGaugePsi,dGaugePerFloz,dGaugePerC].every(Number.isFinite)) return null;
  return {thcaG,nCo2Mol,co2G,pAirPsi,pCo2Psi,pAbsPsi,pGaugePsi,
    pThermalGaugePsi,pBaselineGaugePsi,dGaugePerFloz,dGaugePerC};
}

export const PRESSURE_OFFSETS = [-3,-2,-1,0,1,2,3] as const;
export const HEADSPACE_FACTORS = [0.25,0.4,0.63,1,1.6,2.5,4] as const;
export const PRESSURE_CENTER_INDEX = 3;

export interface HeatmapCell {
  tempValue: number;
  tempUnit: TempUnit;
  headspaceFloz: number;
  pGaugePsi: number;
  pAbsPsi: number;
  pCo2Psi: number;
  /** Indicates the exact user's scenario rather than an interpolated cell. */
  isCurrent: boolean;
}
export type PressureSweep = Omit<PressureInput,'tempValue'|'headspaceFloz'> & {
  tempValue: number;
  headspaceFloz: number;
};
/**
 * Center a 7×7 design-space study exactly on the entered operating point.
 * Span = ±30 K and 0.25×–4× free headspace. Unlike two separately rounded F/C
 * grids, changing units does not change the underlying physical scenarios.
 * All cells are calculated directly; no heatmap interpolation.
 */
export function buildPressureHeatmap(input: PressureSweep): HeatmapCell[][] {
  const centerK = toKelvin(input.tempValue, input.tempUnit);
  const stepK = Math.min(10, centerK / 4);
  if (!Number.isFinite(centerK) || centerK <= 0 ||
      !Number.isFinite(input.headspaceFloz) || input.headspaceFloz <= 0 ||
      !Number.isFinite(stepK) || stepK <= 0) return [];
  const temperatureValues = PRESSURE_OFFSETS.map(offset => fromKelvin(centerK + offset * stepK,input.tempUnit));
  const rows: HeatmapCell[][] = [];
  for (let r=0;r<HEADSPACE_FACTORS.length;r++) {
    const headspaceFloz = input.headspaceFloz * HEADSPACE_FACTORS[r];
    const row: HeatmapCell[] = [];
    for (let c=0;c<temperatureValues.length;c++) {
      const tempValue = temperatureValues[c];
      const result = computePressure({...input,tempValue,headspaceFloz});
      if (!result) return [];
      row.push({
        tempValue,tempUnit:input.tempUnit,headspaceFloz,
        pGaugePsi:result.pGaugePsi,pAbsPsi:result.pAbsPsi,
        pCo2Psi:result.pCo2Psi,
        isCurrent:r===PRESSURE_CENTER_INDEX&&c===PRESSURE_CENTER_INDEX,
      });
    }
    rows.push(row);
  }
  return rows;
}

/** Legacy caller maintained for historical test and API compatibility. */
export function buildHeatmap(weightG:number,thcaPct:number,tempUnit:TempUnit):HeatmapCell[][] {
  return buildPressureHeatmap({
    weightG,thcaPct,tempUnit,
    tempValue:tempUnit==='F'?240:convertTemp(240,'F','C'),
    headspaceFloz:16,
  });
}
