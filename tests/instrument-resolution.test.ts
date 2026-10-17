import {describe,expect,it} from 'vitest';
import {scaleResolution,gaugeResolution} from '../src/lib/instrumentResolution';
import {cannabinoidChemistry} from '../src/lib/cannabinoids';
import {FLOZ_TO_M3,R_SI,PSI_PER_PA} from '../src/lib/pressure';

const params={sampleMassG:10,acidPercent:80,minimumTargetPp:1,recommendedTargetPp:.1} as const;
const press={...params,headspaceFloz:16,initialTempC:25,currentTempC:25};
const theoryMol=params.sampleMassG*params.acidPercent/100/cannabinoidChemistry('THCa').acidMw;
const gasMolPerPsi=16*FLOZ_TO_M3/(R_SI*(25+273.15))/PSI_PER_PA;
describe('standalone instrumentation resolution planners',()=>{
 it('mass-loss sensitivity uses two weighings, each bounded to half a digit',()=>{
   const r=scaleResolution(params)!;
   const expectCo2=params.sampleMassG*.8*cannabinoidChemistry('THCa').co2Ratio;
   expect(r.theoreticalCo2G).toBeCloseTo(expectCo2,12);
   expect(r.minimumStep).toBeCloseTo(.01*expectCo2,12);
   expect(r.recommendedStep).toBeCloseTo(.001*expectCo2,12);
   expect(r.percentagePointsPerUnit).toBeCloseTo(100/expectCo2,12);
 });
 it('sealed gauge bounds initial and final readings, not only the current pressure',()=>{
   const r=gaugeResolution(press)!;
   expect(r.percentagePointsPerUnit).toBeCloseTo(100*gasMolPerPsi/theoryMol,12);
 });
 it('accounts for all vent endpoint rounding contributions',()=>{
   const single=gaugeResolution({...press,vents:[{beforeTempC:25,afterTempC:25,count:1}]})!;
   const triple=gaugeResolution({...press,vents:[{beforeTempC:25,afterTempC:25,count:3}]})!;
   const none=gaugeResolution(press)!;
   expect(single.percentagePointsPerUnit).toBeCloseTo(2*none.percentagePointsPerUnit,12);
   expect(triple.percentagePointsPerUnit).toBeCloseTo(4*none.percentagePointsPerUnit,12);
   expect(triple.recommendedStep).toBeLessThan(none.recommendedStep);
 });
 it('uses actual temperatures for unequal endpoints',()=>{
   const r=gaugeResolution({...press,initialTempC:20,currentTempC:120})!;
   const expected=100*(16*FLOZ_TO_M3/R_SI/PSI_PER_PA)*.5*
     (1/(20+273.15)+1/(120+273.15))/theoryMol;
   expect(r.percentagePointsPerUnit).toBeCloseTo(expected,12);
 });
 it('refuses invalid and underdetermined inputs',()=>{
   expect(scaleResolution({...params,recommendedTargetPp:1})).toBeNull();
   expect(gaugeResolution({...press,headspaceFloz:0})).toBeNull();
   expect(gaugeResolution({...press,vents:[{beforeTempC:25,afterTempC:25,count:-1}]})).toBeNull();
   expect(gaugeResolution({...press,vents:[{beforeTempC:25,afterTempC:25,count:501}]})).toBeNull();
 });
});
