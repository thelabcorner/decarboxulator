import { describe, expect, it } from 'vitest';
import { computePressure, convertTemp, FLOZ_TO_M3, P_ATM_PSI, PSI_PER_PA, R_SI } from '../src/lib/pressure';
import { pressureTracker, asAbsolutePsi, parsePressureReading, parseVentLog, parsePressureLog,
  type PressureTrackerInput } from '../src/lib/pressureTracker';
import { cannabinoidChemistry } from '../src/lib/cannabinoids';
import { validWorkspaceValue } from '../src/lib/workspacePayload';

const basic:PressureTrackerInput = {
  mode:'seal',sampleG:10,acidPercent:80,headspaceFloz:16,
  initialPsi:P_ATM_PSI,initialTempC:20,currentPsi:P_ATM_PSI,
  currentTempC:20,targetPercent:90,cannabinoid:'THCa',
};
const moleP=(moles:number,tempC:number,vFloz=16)=>
  moles*R_SI*(tempC+273.15)/(vFloz*FLOZ_TO_M3)*PSI_PER_PA;

describe('pressure tracker / inverse ideal-gas balance',()=>{
  it('starts at zero and projects the target pressure at the current temperature',()=>{
    const r=pressureTracker(basic,P_ATM_PSI)!;
    expect(r.apparentPercent).toBeCloseTo(0,12);
    expect(r.targetPressureAbsPsi).toBeCloseTo(P_ATM_PSI+
      moleP(r.theoreticalCo2Mol*.9,20),10);
    expect(r.eventCount).toBe(0);
  });
  it('subtracts warming of initially trapped air instead of mislabeling it CO2',()=>{
    const temp=120;
    const currentPsi=P_ATM_PSI*(temp+273.15)/(20+273.15);
    const r=pressureTracker({...basic,currentTempC:temp,currentPsi},P_ATM_PSI)!;
    expect(r.apparentPercent).toBeCloseTo(0,10);
    expect(r.generatedMol).toBeCloseTo(0,12);
  });
  it('inverts a negative-gauge vacuum baseline at changed gas temperature',()=>{
    const start=asAbsolutePsi(-12,'psig',P_ATM_PSI)!;
    expect(start).toBeCloseTo(2.6959487755,9);
    const v=16*FLOZ_TO_M3, tempC=85;
    const chem=cannabinoidChemistry('CBDa');
    const ntheory=10*.8/chem.acidMw;
    const n0=start/PSI_PER_PA*v/(R_SI*(20+273.15));
    const measured=moleP(n0+ntheory*.35,tempC);
    const r=pressureTracker({...basic,cannabinoid:'CBDa',initialPsi:start,
      currentTempC:tempC,currentPsi:measured},P_ATM_PSI)!;
    expect(r.apparentPercent).toBeCloseTo(35,9);
    expect(r.status).toBe('in-range');
  });
  it('accounts for vent count PLUS retained gas (without losing original air)',()=>{
    const sample={...basic,mode:'vent' as const,initialPsi:14,currentPsi:18,
      vents:[{beforePsi:20,afterPsi:15,beforeTempC:20,afterTempC:20,count:2}]};
    const r=pressureTracker(sample,P_ATM_PSI)!;
    const expectedMoles=(18-14+2*(20-15))/PSI_PER_PA*
      (16*FLOZ_TO_M3)/(R_SI*(20+273.15));
    expect(r.generatedMol).toBeCloseTo(expectedMoles,12);
    expect(r.eventCount).toBe(2);
    expect(r.isCountedApproximation).toBe(true);
    expect(r.targetPressureAbsPsi).toBeCloseTo(14+moleP(r.theoreticalCo2Mol*.9,20)-10,9);
  });
  it('computes varying vent endpoints individually and corrects their temperatures',()=>{
    const vents=[
      {beforePsi:21,afterPsi:18,beforeTempC:80,afterTempC:70,count:1},
      {beforePsi:27,afterPsi:17,beforeTempC:90,afterTempC:30,count:1},
    ];
    const r=pressureTracker({...basic,mode:'vent',vents,currentPsi:25,currentTempC:90},P_ATM_PSI)!;
    const mol=(p:number,t:number)=>p/PSI_PER_PA*(16*FLOZ_TO_M3)/(R_SI*(t+273.15));
    const expected=mol(25,90)-mol(P_ATM_PSI,20)+mol(21,80)-mol(18,70)+mol(27,90)-mol(17,30);
    expect(r.generatedMol).toBeCloseTo(expected,12);
    expect(r.isCountedApproximation).toBe(false);
  });
  it('rejects ill-defined negative gas events and invalid absolute pressures',()=>{
    expect(pressureTracker({...basic,mode:'vent',vents:[
      {beforePsi:15,afterPsi:20,beforeTempC:20,afterTempC:20,count:1}]},P_ATM_PSI)).toBeNull();
    expect(pressureTracker({...basic,initialPsi:-2},P_ATM_PSI)).toBeNull();
    expect(asAbsolutePsi(-20,'psig',P_ATM_PSI)).toBeNull();
  });
  it('flags apparent values outside the theory without clipping',()=>{
    const upper=pressureTracker({...basic,currentPsi:P_ATM_PSI+2*moleP(
      10*.8/cannabinoidChemistry('THCa').acidMw,20)},P_ATM_PSI)!;
    expect(upper.apparentPercent).toBeCloseTo(200,7);
    expect(upper.status).toBe('above-theoretical');
    const negative=pressureTracker({...basic,currentPsi:4},P_ATM_PSI)!;
    expect(negative.apparentPercent).toBeLessThan(0);
    expect(negative.status).toBe('below-baseline');
  });
  it('keeps the heatmap vacuum starting inventory separate from ambient gauge reference',()=>{
    const args={weightG:10,thcaPct:80,tempValue:120,tempUnit:'C' as const,
      headspaceFloz:16,sealTempF:convertTemp(20,'C','F'),ambientPsi:P_ATM_PSI,
      efficiency:0,cannabinoid:'THCa' as const};
    const atmospheric=computePressure(args)!;
    const vacuum=computePressure({...args,sealPsi:3})!;
    expect(vacuum.pAirPsi).toBeCloseTo(3*(120+273.15)/(20+273.15),10);
    expect(vacuum.pGaugePsi).toBeCloseTo(vacuum.pAirPsi-P_ATM_PSI,10);
    expect(vacuum.pBaselineGaugePsi).toBeCloseTo(3-P_ATM_PSI,10);
    expect(vacuum.pThermalGaugePsi).toBeCloseTo(
      3*((120+273.15)/(20+273.15)-1),10);
    expect(atmospheric.pAirPsi).toBeGreaterThan(vacuum.pAirPsi);
  });
  it('validates signed pressure and persisted event history',()=>{
    expect(parsePressureReading('-12.2').value).toBe(-12.2);
    expect(validWorkspaceValue('initialPressure','-12','14.7')).toBe(true);
    expect(validWorkspaceValue('pressureBasis','psig','psia')).toBe(true);
    const validEvents=JSON.stringify([{beforePsi:15,afterPsi:12,
      beforeTempC:20,afterTempC:20,count:1}]);
    expect(parseVentLog(validEvents)).toHaveLength(1);
    expect(validWorkspaceValue('ventLog',validEvents,'[]')).toBe(true);
    expect(parseVentLog('[{"beforePsi":{},"count":1}]')).toBeNull();
    const readings=JSON.stringify([{timestamp:Date.now(),pressureAbsPsi:15,
      tempC:20,apparentPercent:10,ventedMol:0}]);
    expect(parsePressureLog(readings)).toHaveLength(1);
  });
});
