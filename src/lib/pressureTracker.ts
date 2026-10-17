/**
 * Pressure-derived apparent decarboxylation progress, deliberately separate
 * from containment engineering. Ideal-gas, fixed gas-space volume, with
 * optional user-supplied Henry equilibrium and inferred gas composition.
 *
 * For a closed-to-inflow control volume:
 *   n_generated = [P(t)V/RT(t) - P(0)V/RT(0)] + Σ n_vented
 * where each isolated vent has n_vented = (V/R)(P_before/T_before -
 * P_after/T_after). This measures NET additional gas equivalents, which can
 * only be attributed to CO2 if other sources, leaks, inflows, sorption,
 * condensation, and changing headspace are independently negligible.
 *
 * Counted events are a calibration approximation; recorded events use their
 * own pressure/temperature endpoints. We NEVER silently clamp a nonphysical
 * observed progress estimate into [0,100].
 */
import { cannabinoidChemistry, DEFAULT_ACID_CANNABINOID, type AcidCannabinoid } from './cannabinoids';
import { FLOZ_TO_M3, PSI_PER_PA, R_SI } from './pressure';
import {dissolvedCo2Moles,dissolvedCo2CapacityMolPerPa,type Co2Dissolution} from './co2Dissolution';

export type PressureTrackerMode = 'seal' | 'vent';
export interface VentEvent {
  /** Measured absolute pressures in PSI, NOT pressure drops or PSIG. */
  beforePsi: number;
  afterPsi: number;
  beforeTempC: number;
  afterTempC: number;
  /** Count > 1 represents explicitly assumed identical cycles. */
  count: number;
}
export interface PressureTrackerInput {
  mode: PressureTrackerMode;
  sampleG: number;
  acidPercent: number;
  cannabinoid?: AcidCannabinoid;
  headspaceFloz: number;
  initialPsi: number;
  initialTempC: number;
  currentPsi: number;
  currentTempC: number;
  targetPercent: number;
  /** Recorded event endpoints or a single representative counted event. */
  vents?: readonly VentEvent[];
  /** Optional equilibrium correction, inferred from total pressure and vent accounting. */
  dissolution?: Co2Dissolution;
}
export interface PressureTrackerResult {
  theoreticalCo2G: number;
  theoreticalCo2Mol: number;
  initialGasMol: number;
  currentGasMol: number;
  retainedChangeMol: number;
  ventedMol: number;
  generatedMol: number;
  co2EquivalentG: number;
  apparentPercent: number;
  targetPressureAbsPsi: number | null;
  targetPressureGaugePsi: number | null;
  targetCo2G: number;
  /** Percent points per current-pressure PSI (instrument step, NOT accuracy). */
  percentagePointsPerPsi: number;
  dissolvedCo2Mol: number;
  co2PartialPressurePsi: number;
  /** Trapped inert-gas pressure after recorded, ideally mixed vent losses. */
  retainedAirPartialPressurePsi: number;
  eventCount: number;
  isCountedApproximation: boolean;
  status: 'in-range' | 'below-baseline' | 'above-theoretical';
}
const isFiniteNonnegative = (n: number) => Number.isFinite(n) && n >= 0;
const volume = (floz: number) => floz * FLOZ_TO_M3;
const kelvin = (c: number) => c + 273.15;
const mol = (psi: number, tempC: number, v: number) =>
  psi / PSI_PER_PA * v / (R_SI * kelvin(tempC));
const psi = (moles: number, tempC: number, v: number) =>
  moles * R_SI * kelvin(tempC) / v * PSI_PER_PA;

/** Signed gauge readings are relative to measured ambient PSIA. */
export function asAbsolutePsi(reading: number, basis: 'psia' | 'psig', ambientPsi: number): number | null {
  if (!Number.isFinite(reading) || !Number.isFinite(ambientPsi) || ambientPsi <= 0) return null;
  const absolute = basis === 'psia' ? reading : basis === 'psig' ? reading + ambientPsi : NaN;
  return Number.isFinite(absolute) && absolute >= 0 ? absolute : null;
}

/** A negative gauge reading is possible; negative ABSOLUTE pressure is not. */
export function parsePressureReading(raw: string): {value:number|null;error:string|null} {
  if (!raw.trim()) return {value:null,error:'Enter a pressure'};
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))
    return {value:null,error:'Enter a valid PSI reading'};
  const n=Number(raw);
  return Number.isFinite(n) && Math.abs(n)<=1e9
    ? {value:n,error:null} : {value:null,error:'Pressure is out of range'};
}

export function pressureTracker(input: PressureTrackerInput, ambientPsi: number): PressureTrackerResult | null {
  const {mode,sampleG,acidPercent,headspaceFloz,initialPsi,initialTempC,
    currentPsi,currentTempC,targetPercent} = input;
  if (mode !== 'seal' && mode !== 'vent') return null;
  if (![sampleG,acidPercent,headspaceFloz,initialPsi,initialTempC,currentPsi,
    currentTempC,targetPercent,ambientPsi].every(Number.isFinite) ||
    sampleG <= 0 || acidPercent <= 0 || acidPercent > 100 ||
    headspaceFloz <= 0 || initialPsi < 0 || currentPsi < 0 || ambientPsi <= 0 ||
    kelvin(initialTempC) <= 0 || kelvin(currentTempC) <= 0 ||
    targetPercent < 0 || targetPercent > 100) return null;
  const vents = mode === 'vent' ? input.vents ?? [] : [];
  if (mode === 'seal' && input.vents?.length) return null;
  if (vents.length > 500) return null;
  const v=volume(headspaceFloz);
  const {acidMw,co2Mw}=cannabinoidChemistry(input.cannabinoid ?? DEFAULT_ACID_CANNABINOID);
  const theoreticalCo2Mol = sampleG * acidPercent / 100 / acidMw;
  const theoreticalCo2G = theoreticalCo2Mol * co2Mw;
  if (!(theoreticalCo2Mol>0) || !Number.isFinite(theoreticalCo2Mol)) return null;
  let ventedMol=0,eventCount=0,isCountedApproximation=false;
  let inertRemainingFraction=1;
  for (const vent of vents) {
    if (![vent.beforePsi,vent.afterPsi,vent.beforeTempC,vent.afterTempC,vent.count].every(Number.isFinite) ||
      !isFiniteNonnegative(vent.beforePsi) || !isFiniteNonnegative(vent.afterPsi) ||
      kelvin(vent.beforeTempC)<=0 || kelvin(vent.afterTempC)<=0 ||
      !Number.isSafeInteger(vent.count) || vent.count<1 || vent.count>500 ||
      eventCount+vent.count>500) return null;
    const removed = mol(vent.beforePsi,vent.beforeTempC,v)-
      mol(vent.afterPsi,vent.afterTempC,v);
    // A temperature-corrected non-drop is not a vented-mole estimate.
    if (!(removed > 0) || !Number.isFinite(removed)) return null;
    ventedMol+=removed*vent.count;
    // Each brief, well-mixed discharge removes the same fraction of every
    // gas present. Subsequent CO2 generation does not restore lost inert gas.
    const before=vent.beforePsi/kelvin(vent.beforeTempC);
    const after=vent.afterPsi/kelvin(vent.afterTempC);
    const retainedFraction=after/before;
    if(!Number.isFinite(retainedFraction)||retainedFraction<0||retainedFraction>=1)return null;
    inertRemainingFraction*=Math.pow(retainedFraction,vent.count);
    eventCount+=vent.count;
    if (vent.count>1) isCountedApproximation=true;
  }
  const initialGasMol=mol(initialPsi,initialTempC,v);
  const currentGasMol=mol(currentPsi,currentTempC,v);
  const retainedChangeMol=currentGasMol-initialGasMol;
  // The initial trapped gas is assumed CO2-free. Short well-mixed vents
  // reduce the inert inventory by (P_after/T_after)/(P_before/T_before).
  // No separate CO2 sensor is needed; infer its partial pressure by difference.
  const inertGasMol=mol(initialPsi,initialTempC,v)*inertRemainingFraction;
  const airAtCurrent=psi(inertGasMol,currentTempC,v);
  const inferredCo2Psi=currentPsi-airAtCurrent;
  // Do not quietly clamp an inconsistent observation into a positive value.
  const roundingTolerance=Math.max(1e-9,Math.abs(currentPsi)*1e-10);
  if(input.dissolution && inferredCo2Psi < -roundingTolerance)return null;
  const co2PartialPsi=Math.max(0,inferredCo2Psi);
  const dissolvedCo2Mol=input.dissolution
    ?dissolvedCo2Moles(co2PartialPsi,input.dissolution):0;
  if(dissolvedCo2Mol===null)return null;
  const generatedMol=retainedChangeMol+ventedMol+dissolvedCo2Mol;
  const apparentPercent=100*generatedMol/theoreticalCo2Mol;
  const targetCo2G=theoreticalCo2G*targetPercent/100;
  const targetRetainedMol=initialGasMol+theoreticalCo2Mol*targetPercent/100-ventedMol;
  const liquidCapacity=input.dissolution?dissolvedCo2CapacityMolPerPa(input.dissolution):0;
  if(liquidCapacity===null)return null;
  const gasCapacity=v/(R_SI*kelvin(currentTempC));
  // Already-released CO2 equals total removed gas minus discharged inert gas.
  // Assuming no additional future vents, the target is the pressure required
  // for the remaining CO2 (gas plus dissolved equilibrium inventory).
  const ventedCo2Mol=ventedMol-(initialGasMol-inertGasMol);
  const targetRemainingCo2Mol=theoreticalCo2Mol*targetPercent/100-ventedCo2Mol;
  const rawTargetPressure=input.dissolution
    ?airAtCurrent+(targetRemainingCo2Mol/(gasCapacity+liquidCapacity))*PSI_PER_PA
    :psi(targetRetainedMol,currentTempC,v);
  const targetPressureAbsPsi=Number.isFinite(rawTargetPressure) && rawTargetPressure>=0 &&
    (!input.dissolution || targetRemainingCo2Mol>=-Math.max(1e-12,theoreticalCo2Mol*1e-10))
    ? rawTargetPressure : null;
  const percentagePointsPerPsi=100*(gasCapacity+(input.dissolution?liquidCapacity:0)) /
    PSI_PER_PA/theoreticalCo2Mol;
  if (![initialGasMol,currentGasMol,retainedChangeMol,ventedMol,generatedMol,
    apparentPercent,percentagePointsPerPsi,dissolvedCo2Mol].every(Number.isFinite)) return null;
  const tolerance=1e-8;
  const status=apparentPercent < -tolerance ? 'below-baseline' :
    apparentPercent>100+tolerance ? 'above-theoretical' : 'in-range';
  return {
    theoreticalCo2G,theoreticalCo2Mol,initialGasMol,currentGasMol,
    retainedChangeMol,ventedMol,generatedMol,co2EquivalentG:generatedMol*co2Mw,
    apparentPercent,targetPressureAbsPsi,
    targetPressureGaugePsi:targetPressureAbsPsi===null?null:targetPressureAbsPsi-ambientPsi,
    targetCo2G,percentagePointsPerPsi,dissolvedCo2Mol,
    co2PartialPressurePsi:co2PartialPsi,retainedAirPartialPressurePsi:airAtCurrent,
    eventCount,isCountedApproximation,status,
  };
}

/** Strictly validate browser-stored event logs and incoming shared URL state. */
export function parseVentLog(raw: string): VentEvent[] | null {
  if (typeof raw !== 'string' || raw.length > 32000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 100) return null;
    if (!value.every((event: unknown) => {
      if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
      const e=event as Record<string,unknown>;
      return ['beforePsi','afterPsi','beforeTempC','afterTempC','count'].every(k=>
        typeof e[k]==='number' && Number.isFinite(e[k])) &&
        (e.beforePsi as number)>=0 && (e.afterPsi as number)>=0 &&
        (e.beforePsi as number)<=1e9 && (e.afterPsi as number)<=1e9 &&
        (e.beforeTempC as number)>-273.15 && (e.afterTempC as number)>-273.15 &&
        e.count===1;
    })) return null;
    return value as VentEvent[];
  } catch { return null; }
}

export interface PressureReading {
  timestamp: number;
  pressureAbsPsi: number;
  tempC: number;
  apparentPercent: number;
  ventedMol: number;
}
/** Save physical measurements with their original instant's model output. */
export function parsePressureLog(raw: string): PressureReading[] | null {
  if (typeof raw !== 'string' || raw.length > 50000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 200) return null;
    if (!value.every((r: unknown) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
      const e=r as Record<string,unknown>;
      return ['timestamp','pressureAbsPsi','tempC','apparentPercent','ventedMol'].every(k =>
        typeof e[k]==='number' && Number.isFinite(e[k])) &&
        Number.isSafeInteger(e.timestamp) && (e.timestamp as number)>0 &&
        (e.pressureAbsPsi as number)>=0 && (e.ventedMol as number)>=0 &&
        (e.tempC as number)>-273.15;
    })) return null;
    return value as PressureReading[];
  } catch { return null; }
}
