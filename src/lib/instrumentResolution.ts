/**
 * Readability planning for gravimetric and pressure-derived apparent conversion.
 * These are worst-case digital-display quantization bounds, not statements about
 * metrological accuracy, precision, noise, temperature uncertainty, or safety.
 *
 * A digital reading with increment d is taken as +/-d/2 around its rounded
 * value. Sum absolute first-order coefficients to bound the inferred apparent
 * conversion error. Vented cycles reuse their calibration endpoints count
 * times, so their instrument rounding contribution also grows count times.
 */
import { cannabinoidChemistry, DEFAULT_ACID_CANNABINOID, type AcidCannabinoid } from './cannabinoids';
import { FLOZ_TO_M3, PSI_PER_PA, R_SI } from './pressure';

export type InstrumentVent = { beforeTempC: number; afterTempC: number; count: number };
export type ResolutionTargets = {
  minimumStep: number;
  recommendedStep: number;
  theoreticalCo2G: number;
  /** Effective worst-case apparent completion change for one unit of readout increment. */
  percentagePointsPerUnit: number;
};

export function scaleResolution(params: {
  sampleMassG: number;
  acidPercent: number;
  minimumTargetPp: number;
  recommendedTargetPp: number;
  cannabinoid?: AcidCannabinoid;
}): ResolutionTargets | null {
  const {sampleMassG,acidPercent,minimumTargetPp,recommendedTargetPp}=params;
  if (![sampleMassG,acidPercent,minimumTargetPp,recommendedTargetPp].every(Number.isFinite) ||
      !(sampleMassG>0) || !(acidPercent>0) || acidPercent>100 ||
      !(minimumTargetPp>0) || !(recommendedTargetPp>0) || recommendedTargetPp>=minimumTargetPp) return null;
  const {co2Ratio}=cannabinoidChemistry(params.cannabinoid??DEFAULT_ACID_CANNABINOID);
  const theoreticalCo2G=sampleMassG*acidPercent/100*co2Ratio;
  const sensitivity=100/theoreticalCo2G;
  const result={
    minimumStep:minimumTargetPp/sensitivity,
    recommendedStep:recommendedTargetPp/sensitivity,
    theoreticalCo2G,
    percentagePointsPerUnit:sensitivity,
  };
  return Object.values(result).every(x=>Number.isFinite(x)&&x>0)?result:null;
}

export function gaugeResolution(params: {
  sampleMassG: number;
  acidPercent: number;
  headspaceFloz: number;
  initialTempC: number;
  currentTempC: number;
  minimumTargetPp: number;
  recommendedTargetPp: number;
  cannabinoid?: AcidCannabinoid;
  vents?: readonly InstrumentVent[];
}): ResolutionTargets | null {
  const {sampleMassG,acidPercent,headspaceFloz,initialTempC,currentTempC,
    minimumTargetPp,recommendedTargetPp}=params;
  if (![sampleMassG,acidPercent,headspaceFloz,initialTempC,currentTempC,
    minimumTargetPp,recommendedTargetPp].every(Number.isFinite) ||
    !(sampleMassG>0) || !(acidPercent>0) || acidPercent>100 ||
    !(headspaceFloz>0) || !(initialTempC>-273.15) || !(currentTempC>-273.15) ||
    !(minimumTargetPp>0) || !(recommendedTargetPp>0) || recommendedTargetPp>=minimumTargetPp) return null;
  const {acidMw,co2Mw}=cannabinoidChemistry(params.cannabinoid??DEFAULT_ACID_CANNABINOID);
  const theoryMol=sampleMassG*acidPercent/100/acidMw;
  const theoreticalCo2G=theoryMol*co2Mw;
  const vents=params.vents??[];
  if(vents.length>100) return null;
  let weight=1/(initialTempC+273.15)+1/(currentTempC+273.15);
  let count=0;
  for(const v of vents){
    if(!Number.isFinite(v.beforeTempC)||!Number.isFinite(v.afterTempC) ||
      v.beforeTempC<=-273.15||v.afterTempC<=-273.15||
      !Number.isSafeInteger(v.count)||v.count<1||v.count>500||count+v.count>500)return null;
    count+=v.count;
    weight+=v.count*(1/(v.beforeTempC+273.15)+1/(v.afterTempC+273.15));
  }
  // Derivative dn/dP_PSI = V/(R*T*PSI_PER_PA); half-step quantization at
  // each independent input leads to total worst-case sum of |derivatives|/2.
  const molePerPsi=(headspaceFloz*FLOZ_TO_M3)/(R_SI*PSI_PER_PA);
  const sensitivity=100*(molePerPsi*weight/2)/theoryMol;
  const result={
    minimumStep:minimumTargetPp/sensitivity,
    recommendedStep:recommendedTargetPp/sensitivity,
    theoreticalCo2G,
    percentagePointsPerUnit:sensitivity,
  };
  return Object.values(result).every(x=>Number.isFinite(x)&&x>0)?result:null;
}
