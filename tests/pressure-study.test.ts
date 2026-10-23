import {describe,expect,it} from 'vitest';
import {
  buildPressureHeatmap,computePressure,convertTemp,fromKelvin,toKelvin,
  P_ATM_PSI,PRESSURE_CENTER_INDEX,HEADSPACE_FACTORS,PRESSURE_OFFSETS,
} from '../src/lib/pressure';
import {MW_THCA,MW_CO2} from '../src/lib/decarb';

const baseline = {weightG:28,thcaPct:85,tempValue:240,tempUnit:'F' as const,
  headspaceFloz:16,sealTempF:70,ambientPsi:P_ATM_PSI,efficiency:1};
const near=(a:number,b:number,eps=1e-9)=>expect(Math.abs(a-b)).toBeLessThanOrEqual(
  eps*Math.max(1,Math.abs(a),Math.abs(b)),
);

describe('independent pressure physics and study-field validation',()=>{
  it('is a 7x7 operating-point-centered sweep, with exact center and strictly ordered axes',()=>{
    const grid=buildPressureHeatmap(baseline);
    expect(grid).toHaveLength(7);
    for(const r of grid)expect(r).toHaveLength(7);
    expect(PRESSURE_CENTER_INDEX).toBe(3);
    expect(grid[3][3].isCurrent).toBe(true);
    expect(grid.flat().filter(p=>p.isCurrent)).toHaveLength(1);
    near(grid[3][3].tempValue,baseline.tempValue);
    near(grid[3][3].headspaceFloz,baseline.headspaceFloz);
    near(grid[3][3].pGaugePsi,computePressure(baseline)!.pGaugePsi);
    for(let i=0;i<7;i++){
      near(grid[i][3].headspaceFloz,baseline.headspaceFloz*HEADSPACE_FACTORS[i]);
      near(toKelvin(grid[3][i].tempValue,'F'),
        toKelvin(baseline.tempValue,'F')+PRESSURE_OFFSETS[i]*10);
      for(let j=1;j<7;j++)expect(grid[i][j].pAbsPsi).toBeGreaterThan(grid[i][j-1].pAbsPsi);
      for(let j=1;j<7;j++)expect(grid[j][i].pCo2Psi).toBeLessThan(grid[j-1][i].pCo2Psi);
    }
  });
  it('recomputes all heatmap cells from the selected starting vacuum instead of default atmospheric pressure',()=>{
    const atAmbient=buildPressureHeatmap({...baseline,sealPsi:P_ATM_PSI});
    const underVacuum=buildPressureHeatmap({...baseline,sealPsi:4.5});
    const factor=toKelvin(baseline.tempValue,'F')/toKelvin(baseline.sealTempF,'F');
    for(let r=0;r<7;r++)for(let c=0;c<7;c++){
      const a=atAmbient[r][c], v=underVacuum[r][c];
      near(a.pCo2Psi,v.pCo2Psi,1e-8);
      near(a.pAbsPsi-v.pAbsPsi,(P_ATM_PSI-4.5)*
        toKelvin(a.tempValue,'F')/toKelvin(baseline.sealTempF,'F'));
      near(a.pGaugePsi-v.pGaugePsi,a.pAbsPsi-v.pAbsPsi);
    }
    expect(factor).toBeGreaterThan(1);
    near(underVacuum[3][3].pAbsPsi,computePressure({...baseline,sealPsi:4.5})!.pAbsPsi);
  });
  it('preserves absolute physical scenarios after changing temperature units',()=>{
    const fGrid=buildPressureHeatmap(baseline);
    const cGrid=buildPressureHeatmap({...baseline,tempUnit:'C',
      tempValue:convertTemp(baseline.tempValue,'F','C')});
    for(let r=0;r<7;r++)for(let c=0;c<7;c++){
      near(fGrid[r][c].pGaugePsi,cGrid[r][c].pGaugePsi);
      near(toKelvin(fGrid[r][c].tempValue,'F'),toKelvin(cGrid[r][c].tempValue,'C'));
    }
  });
  it('matches independent ideal-mixture derivation and phase-neutral closed-form sensitivities',()=>{
    const r=computePressure(baseline)!;
    const nt=baseline.weightG*baseline.thcaPct/100/MW_THCA;
    const expectedCo2Mass=nt*MW_CO2;
    near(r.co2G,expectedCo2Mass);
    near(r.pAbsPsi,r.pAirPsi+r.pCo2Psi);
    near(r.pGaugePsi,r.pThermalGaugePsi+r.pCo2Psi);
    const h=1e-5;
    const plusV=computePressure({...baseline,headspaceFloz:baseline.headspaceFloz+h})!;
    const minusV=computePressure({...baseline,headspaceFloz:baseline.headspaceFloz-h})!;
    near((plusV.pGaugePsi-minusV.pGaugePsi)/(2*h),r.dGaugePerFloz,1e-7);
    const plusT=computePressure({...baseline,tempValue:baseline.tempValue+1e-3})!;
    const minusT=computePressure({...baseline,tempValue:baseline.tempValue-1e-3})!;
    near((plusT.pGaugePsi-minusT.pGaugePsi)/(2e-3)*9/5,r.dGaugePerC,1e-7);
  });
  it('checks pressure balance, conversion linearity, headspace inverse law and thermodynamics for 1200 deterministic scenarios',()=>{
    let state=0x51a8b23;
    function random(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}
    for(let i=0;i<1200;i++){
      const weightG=.1+random()*300, thcaPct=random()*100;
      const tempValue=20+random()*280,sealTempF=40+random()*80;
      const ambientPsi=10+random()*8,headspaceFloz=.5+random()*100;
      const efficiency=random();
      const input={weightG,thcaPct,tempValue,tempUnit:'F' as const,sealTempF,
        ambientPsi,headspaceFloz,efficiency};
      const r=computePressure(input)!;
      expect(Number.isFinite(r.pGaugePsi)).toBe(true);
      near(r.pAbsPsi,r.pAirPsi+r.pCo2Psi);
      near(r.pAbsPsi-r.pGaugePsi,ambientPsi);
      near(r.pCo2Psi,(weightG*thcaPct/100*efficiency/MW_THCA)*
        8.31446261815324*toKelvin(tempValue,'F')/(headspaceFloz*29.5735295625e-6)/
        6894.757293168);
      const doubled=computePressure({...input,headspaceFloz:headspaceFloz*2})!;
      near(doubled.pCo2Psi,r.pCo2Psi/2);
      near(doubled.pAirPsi,r.pAirPsi);
      const zero=computePressure({...input,efficiency:0})!;
      near(zero.pCo2Psi,0);
      near(r.pCo2Psi,(computePressure({...input,efficiency:1})!.pCo2Psi)*efficiency);
      const hot=computePressure({...input,tempValue:tempValue+18})!;
      near(hot.pAbsPsi/r.pAbsPsi,
        toKelvin(tempValue+18,'F')/toKelvin(tempValue,'F'));
      expect(r.dGaugePerC).toBeGreaterThan(0);
      expect(r.dGaugePerFloz).toBeLessThanOrEqual(0);
    }
  });
  it('does not turn extreme or invalid numbers into fake heatmap cells',()=>{
    expect(buildPressureHeatmap({...baseline,headspaceFloz:0})).toEqual([]);
    expect(buildPressureHeatmap({...baseline,tempValue:-459.67})).toEqual([]);
    expect(buildPressureHeatmap({...baseline,efficiency:1.25})).toEqual([]);
    expect(computePressure({...baseline,headspaceFloz:Infinity})).toBeNull();
    expect(computePressure({...baseline,sealTempF:-459.67})).toBeNull();
    expect(computePressure({...baseline,ambientPsi:-1})).toBeNull();
    expect(computePressure({...baseline,efficiency:NaN})).toBeNull();
    const nearAbsoluteZero=buildPressureHeatmap({...baseline,tempValue:-459.66});
    expect(nearAbsoluteZero).toHaveLength(7);
    expect(nearAbsoluteZero.every(row=>row.every(cell=>toKelvin(cell.tempValue,'F')>0))).toBe(true);
    expect(fromKelvin(toKelvin(212,'F'),'F')).toBeCloseTo(212,10);
  });
});
