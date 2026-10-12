import { describe, expect, it } from 'vitest';
import { CO2_RATIO } from '../src/lib/decarb';
import { fitTrackerKinetics, kineticPredict, type KineticReading } from '../src/lib/trackerKinetics';
import { trackerRawCSV } from '../src/lib/trackerAnalytics';

const hours=(t:number)=>Math.round(t*3600000);
const start=Date.UTC(2025,10,1,23,55,11,285);
const series=(raw:Array<[number,number]>,initContent:number,thca:number,origin=start)=>
  raw.map(([minutes,content])=>({
    timestamp:origin+Math.round(minutes*60000),
    completion:100*(initContent-content)/(thca*CO2_RATIO),
  }));
// Real-world lab exports supplied by the project owner. Retain raw masses and
// uneven timing, not their legacy derived "decarbRate" or rounded completion.
const november2025=series([
  [0,23.82],[1.4646,23.61],[6.5666,23.39],[11.44,23.16],
  [15.885,22.65],[20.11,22.2],[22.91,22.015],[26.045,21.83],
  [29.496,21.74],[32.816,21.64],[35.307,21.625],[37.245,21.56],
  [39.385,21.555],
],23.82,18.92);
const august2024=series([
  [0,54.98],[1.387,54.98],[17.061,54.85],[31.153,54.74],
  [84.260,50.48],[92.891,50.26],[101.814,50.11],[106.719,50.02],
  [111.413,49.96],[115.747,49.89],[118.257,49.86],
],54.98,44.58,Date.UTC(2024,7,29,19,38,35,416));
const december2025=series([
  [0,.1],[5.538,.19],[16.688,.38],[30.803,.68],
  [35.692,.695],[39.387,.75],[42.197,.755],[51.804,.83],
].map(([minute,loss])=>[minute,61.94-loss]),61.94,6.73,Date.UTC(2025,11,13,22,44,3,445));

function noisy(seed:number,kind:'first'|'lagged'= 'first'):KineticReading[] {
  let s=seed>>>0;const random=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};
  const k=1.1+(seed%11)*.18;
  return Array.from({length:18},(_,i)=>{
    const t=.055+i*.085;
    const clean=kind==='first'
      ?100*-Math.expm1(-k*t)
      :100*-Math.expm1(-Math.pow(k*Math.max(0,t-.17),1.8));
    return {timestamp:start+hours(t),completion:Math.max(0,Math.min(100,clean+(random()-.5)*1.25))};
  });
}
describe('empirical apparent-conversion kinetics and historical fixtures',()=>{
  it('retains out-of-model balance observations in raw CSV without inventing assay values',()=>{
    const cfg={tareG:53.81,thcaG:6.73,otherG:1.4};
    const exported=trackerRawCSV([
      {timestamp:start,weightG:61.84},
      {timestamp:start+60_000,weightG:61.11,note:'=unsafe()'},
    ],cfg);
    const lines=exported.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('model_status');
    expect(lines[1]).toContain('within_CO2_model');
    expect(lines[2]).toContain('outside_CO2_model');
    expect(lines[2]).toContain('61.11');
    expect(lines[2]).toContain('"\'=unsafe()"');
    // No arbitrary conversion value may be fabricated for the overshoot row.
    expect(lines[2]).toContain('61.11,0.83,,,,,,,');
  });
  it('recognizes the physical overshoot in Dec 2025 instead of claiming conversion >100%',()=>{
    const result=fitTrackerKinetics(december2025,december2025[0].timestamp,{bootstrap:0});
    expect(december2025.at(-1)!.completion).toBeGreaterThan(100);
    expect(result.excluded).toBe(1);
    expect(result.used).toBe(7);
    expect(result.warnings.join(' ')).toMatch(/excluded/);
    expect(result.curve.length).toBeGreaterThan(50);
    expect(result.curve.every(c=>c.estimate>=0&&c.estimate<=100)).toBe(true);
  });
  it('reconciles November 2025 export and refuses imaginary negative first rate',()=>{
    const fitted=fitTrackerKinetics(november2025,november2025[0].timestamp,{bootstrap:24});
    expect(november2025[0].completion).toBeCloseTo(0,9);
    expect(november2025.at(-1)!.completion).toBeCloseTo(97.485,1);
    expect(fitted.status).toBe('fitted');
    expect(fitted.rSquared).not.toBeNull();
    expect(fitted.curve.every(p=>Number.isFinite(p.estimate))).toBe(true);
    expect(fitted.model).not.toBeNull();
    expect(fitted.forecast90Hours).not.toBeNull();
    expect(fitted.forecast95Hours).not.toBeNull();
  });
  it('preserves the long 2024 induction and uneven heat-up spacing',()=>{
    const fitted=fitTrackerKinetics(august2024,august2024[0].timestamp,{bootstrap:0});
    expect(august2024[1].completion).toBeCloseTo(0,8);
    expect(august2024[3].completion).toBeLessThan(5);
    expect(august2024[4].completion).toBeGreaterThan(80);
    expect(fitted.status).toBe('fitted');
    expect(fitted.rSquared).not.toBeNull();
    expect(fitted.curve.every(p=>Number.isFinite(p.estimate))).toBe(true);
  });
  it('withholds estimates from plateaus, early sparse data and short span',()=>{
    expect(fitTrackerKinetics(noisy(17).slice(0,3),start).status).toBe('insufficient');
    const flat=Array.from({length:15},(_,i)=>({timestamp:start+hours(i*.1),completion:12+.05*i}));
    expect(fitTrackerKinetics(flat,start).status).toBe('unidentifiable');
    expect(fitTrackerKinetics(noisy(18).map(p=>({...p,timestamp:start+1000})),start).status).toBe('insufficient');
  });
  it('distinguishes inconsistent temperature from Arrhenius identification',()=>{
    const points=noisy(15).map((p,i)=>({...p,temperatureC:90+i*2}));
    expect(fitTrackerKinetics(points,start,{bootstrap:0}).warnings.join(' ')).toMatch(/Temperature varied/);
  });
  it('returns monotonically increasing physical forecast curves for the supported models',()=>{
    for(const shape of [.65,1,1.8,3.5])for(const lag of [0,.2]){
      const values=Array.from({length:51},(_,i)=>kineticPredict(i/50,Math.log(2),shape,lag));
      expect(values[0]).toBe(0);
      expect(values.at(-1)).toBeLessThan(100);
      expect(values.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=100&&(!i||v>=values[i-1]))).toBe(true);
    }
  });
  it('recovers known first-order kinetics in noisy synthetic runs (64 seeds)',()=>{
    let count=0;
    for(let i=1;i<=64;i++){
      const pts=noisy(i);
      const fitted=fitTrackerKinetics(pts,start,{bootstrap:0});
      const k=1.1+(i%11)*.18;
      if(fitted.status==='fitted'&&fitted.kPerHour!==null&&Math.abs(fitted.kPerHour-k)/k<.25)count++;
    }
    expect(count).toBeGreaterThanOrEqual(56);
  },20000);
  it('recovers lagged sigmoidal shape on noisy simulations without unexplained extrapolation',()=>{
    let predicted=0,good=0;
    for(let i=1;i<=30;i++){
      const fitted=fitTrackerKinetics(noisy(i,'lagged'),start,{bootstrap:0});
      if(fitted.forecast90Hours!==null)predicted++;
      if((fitted.rSquared??0)>.9&&fitted.shape!==null&&fitted.shape>1.15)good++;
    }
    expect(good).toBeGreaterThanOrEqual(23);
    expect(predicted).toBeGreaterThanOrEqual(20);
  },20000);
  it('bounds compute time and arrays with 500 time points',()=>{
    const pts=Array.from({length:500},(_,i)=>{
      const t=i*.005;
      return {timestamp:start+hours(t),completion:Math.max(0,Math.min(99.99,
        100*-Math.expm1(-t*.85)+Math.sin(i*.17)*.35))};
    });
    const result=fitTrackerKinetics(pts,start,{bootstrap:0});
    expect(result.count).toBe(500);
    expect(result.curve).toHaveLength(110);
    expect(result.status).toBe('fitted');
  },12000);
});
