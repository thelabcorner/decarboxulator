/**
 * Henry's law as an OPTIONAL, ideal-equilibrium CO2 mass partition.
 * Input kH is the solubility form: mol of dissolved CO2 per litre of
 * liquid per atmosphere of CO2 partial pressure, AT THE MODELED TEMPERATURE.
 * This is NOT a universal cannabis/oil constant, nor a kinetics model.
 */
export const PA_PER_ATM=101325;
export const PSI_PER_ATM=14.695948775513449;
export type Co2Dissolution = { liquidMl: number; henryMolPerLAtm: number };
export function dissolvedCo2CapacityMolPerPa(v:Co2Dissolution):number|null {
  if(![v.liquidMl,v.henryMolPerLAtm].every(Number.isFinite)||
      v.liquidMl<=0||v.henryMolPerLAtm<=0)return null;
  const capacity=(v.liquidMl/1000)*v.henryMolPerLAtm/PA_PER_ATM;
  return Number.isFinite(capacity)&&capacity>0?capacity:null;
}
export function dissolvedCo2Moles(partialPsi:number, v:Co2Dissolution):number|null {
  const cap=dissolvedCo2CapacityMolPerPa(v);
  if(cap===null||!Number.isFinite(partialPsi)||partialPsi<0)return null;
  const mol=cap*(partialPsi/PSI_PER_ATM)*PA_PER_ATM;
  return Number.isFinite(mol)?mol:null;
}
