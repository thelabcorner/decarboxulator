import {describe,it,expect} from 'vitest';
import {computePressure,P_ATM_PSI,FLOZ_TO_M3,R_SI,PSI_PER_PA} from '../src/lib/pressure';
import {pressureTracker,type PressureTrackerInput} from '../src/lib/pressureTracker';
import {dissolvedCo2Moles} from '../src/lib/co2Dissolution';

const liquid={liquidMl:100,henryMolPerLAtm:.035};
const temp=25;
const v=16*FLOZ_TO_M3;
const capacity=v/(R_SI*(temp+273.15))/PSI_PER_PA;
const molAt=(p:number)=>p*capacity;
const seed:PressureTrackerInput={
  mode:'seal',sampleG:10,acidPercent:80,headspaceFloz:16,
  initialPsi:14,initialTempC:temp,currentPsi:20,currentTempC:temp,targetPercent:50,
};
describe('optional CO2-liquid partition',()=>{
  it('keeps the original gas model exactly when not opted in',()=>{
    const input={weightG:20,thcaPct:80,headspaceFloz:16,tempValue:25,tempUnit:'C' as const};
    expect(computePressure(input)).toEqual(computePressure({...input,dissolution:undefined}));
    expect(pressureTracker(seed,P_ATM_PSI)).toEqual(pressureTracker({...seed,dissolution:undefined},P_ATM_PSI));
  });
  it('distributes evolved CO2 across gas and liquid in equilibrium',()=>{
    const b={weightG:20,thcaPct:80,headspaceFloz:16,tempValue:25,tempUnit:'C' as const};
    const dry=computePressure(b)!;
    const wet=computePressure({...b,dissolution:liquid})!;
    expect(wet.pCo2Psi).toBeGreaterThan(0);
    expect(wet.pCo2Psi).toBeLessThan(dry.pCo2Psi);
    expect(wet.pAirPsi).toBeCloseTo(dry.pAirPsi,12);
    expect(wet.dissolvedCo2Mol).toBeGreaterThan(0);
    expect(wet.dissolvedCo2Mol+molAt(wet.pCo2Psi)).toBeCloseTo(wet.nCo2Mol,11);
  });
  it('uses the existing seal pressure to infer CO2 partial pressure',()=>{
    const dry=pressureTracker(seed,P_ATM_PSI)!;
    const wet=pressureTracker({...seed,dissolution:liquid},P_ATM_PSI)!;
    expect(wet.retainedAirPartialPressurePsi).toBeCloseTo(14,11);
    expect(wet.co2PartialPressurePsi).toBeCloseTo(6,11);
    expect(wet.dissolvedCo2Mol).toBeCloseTo(dissolvedCo2Moles(6,liquid)!,11);
    expect(wet.generatedMol).toBeCloseTo(dry.generatedMol+wet.dissolvedCo2Mol,11);
    expect(wet.targetPressureAbsPsi).not.toBeNull();
  });
  it('reduces the original inert-gas inventory after a measured vent',()=>{
    const event={beforePsi:20,afterPsi:15,beforeTempC:temp,afterTempC:temp,count:1};
    const wet=pressureTracker({...seed,mode:'vent',currentPsi:17,vents:[event],dissolution:liquid},P_ATM_PSI)!;
    const dry=pressureTracker({...seed,mode:'vent',currentPsi:17,vents:[event]},P_ATM_PSI)!;
    expect(wet).not.toBeNull();
    expect(wet.retainedAirPartialPressurePsi).toBeCloseTo(14*.75,11);
    expect(wet.co2PartialPressurePsi).toBeCloseTo(17-14*.75,11);
    expect(wet.generatedMol-dry.generatedMol).toBeCloseTo(wet.dissolvedCo2Mol,12);
    expect(wet.targetPressureAbsPsi).not.toBeNull();
  });
  it('handles counted vent gas mixing as repeated multiplicative fractions',()=>{
    const vent={beforePsi:20,afterPsi:15,beforeTempC:temp,afterTempC:temp,count:3};
    const wet=pressureTracker({...seed,mode:'vent',currentPsi:20,vents:[vent],dissolution:liquid},P_ATM_PSI)!;
    expect(wet.retainedAirPartialPressurePsi).toBeCloseTo(14*.75**3,10);
    expect(wet.co2PartialPressurePsi).toBeCloseTo(20-14*.75**3,10);
    expect(wet.isCountedApproximation).toBe(true);
  });
  it('accounts for temperature-corrected gas remaining after vent',()=>{
    const vent={beforePsi:23,afterPsi:15,beforeTempC:80,afterTempC:60,count:1};
    const expectedAir=14*(temp+273.15)/(temp+273.15)*
      ((15/(60+273.15))/(23/(80+273.15)));
    const wet=pressureTracker({...seed,mode:'vent',currentPsi:30,vents:[vent],dissolution:liquid},P_ATM_PSI)!;
    expect(wet.retainedAirPartialPressurePsi).toBeCloseTo(expectedAir,10);
    expect(wet.co2PartialPressurePsi).toBeCloseTo(30-expectedAir,10);
  });
  it('rejects physically inconsistent partial pressure instead of clamping it',()=>{
    expect(pressureTracker({...seed,mode:'vent',currentPsi:2,dissolution:liquid},P_ATM_PSI)).toBeNull();
  });
  it('rejects invalid liquid and solubility parameters instead of silent fallback',()=>{
    const b={weightG:10,thcaPct:80,headspaceFloz:16,tempValue:25,tempUnit:'C' as const};
    expect(computePressure({...b,dissolution:{liquidMl:0,henryMolPerLAtm:.035}})).toBeNull();
    expect(pressureTracker({...seed,dissolution:{liquidMl:100,henryMolPerLAtm:-1}},P_ATM_PSI)).toBeNull();
  });
});
