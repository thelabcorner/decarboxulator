import { describe, expect, it } from 'vitest';
import { CONVERSION_RATIO, CO2_RATIO } from '../src/lib/decarb';
import { DEFAULT_EDIBLE_ROWS, calculateEdibleFormula, edibleRow, parseEdibleRows } from '../src/lib/edibleFormula';
import { calculateCartridgeFromInput, calculateCartridge, consolidateCompounds } from '../src/lib/cartridge';
import { analyzeTrackerSeries, restoreTrackerPoints, trackerConfigFromPercent, trackerCSV } from '../src/lib/trackerAnalytics';
import { migrateLegacyWorkspace, parseTrackerReadings, validWorkspaceValue } from '../src/lib/workspacePayload';
import { SCIENCE_FAQ, SCIENCE_CATEGORIES } from '../src/lib/scienceFaq';

describe('V3 v2.3 edible parity + math corrections', () => {
  it('retains three distinct input modes', () => {
    expect(Object.keys(DEFAULT_EDIBLE_ROWS)).toEqual(['weight','concentration','desired']);
  });
  it('handles multiple independent measured compounds without relabeling CBN as CBD', () => {
    const rows = [
      {...edibleRow('THCa'),weight:3.5},
      {...edibleRow('THC'),weight:100,unit:'mg' as const},
      {...edibleRow('CBD'),weight:200,unit:'mg' as const},
      {...edibleRow('CBN'),weight:100,unit:'mg' as const},
    ];
    const r = calculateEdibleFormula('weight',rows,10);
    expect(r?.totalThcMg).toBeCloseTo(3500*CONVERSION_RATIO+100,6);
    expect(r?.perServingThcMg).toBeCloseTo((3500*CONVERSION_RATIO+100)/10,6);
    expect(r?.totals.CBD).toBe(200);
    expect(r?.totals.CBN).toBe(100);
  });
  it('concentration mode correctly applies input grams and specified potency', () => {
    const r=calculateEdibleFormula('concentration',[
      {...edibleRow('THCa'),weight:2,percent:35},
      {...edibleRow('THC'),weight:2,percent:5},
    ],10);
    expect(r?.rawThcaMg).toBe(700);
    expect(r?.totalThcMg).toBeCloseTo(700*CONVERSION_RATIO+100,8);
  });
  it('does not apply THC loss assumptions to CBD and CBN', () => {
    const r=calculateEdibleFormula('weight',[
      {...edibleRow('THC'),weight:1},
      {...edibleRow('CBD'),weight:1},
      {...edibleRow('CBN'),weight:1},
    ],5,0,50);
    expect(r?.totalThcMg).toBe(500);
    expect(r?.totals.CBD).toBe(1000);
    expect(r?.totals.CBN).toBe(1000);
  });
  it('back-solves a target THCa-derived active THC dose instead of raw acid dose', () => {
    const r=calculateEdibleFormula('desired',[{...edibleRow('THCa'),target:10}],12,80,75);
    expect(r?.totalThcMg).toBeCloseTo(120,8);
    expect(r?.rows[0].inputMaterialMg).toBeCloseTo(120/(CONVERSION_RATIO*.8*.75),8);
  });
  it('back-solves already-neutral THC through downstream recovery only', () => {
    const r=calculateEdibleFormula('desired',[{...edibleRow('THC'),target:8}],8,0,50);
    expect(r?.rows[0].inputMaterialMg).toBe(128);
    expect(r?.totalThcMg).toBe(64);
  });
  it('rejects unattainable targets and invalid servings', () => {
    expect(calculateEdibleFormula('desired',[{...edibleRow('THCa'),target:1}],10,0,100)).toBeNull();
    expect(calculateEdibleFormula('desired',[{...edibleRow('THC'),target:1}],10,100,0)).toBeNull();
    expect(calculateEdibleFormula('weight',DEFAULT_EDIBLE_ROWS.weight,2.5)).toBeNull();
  });
  it('rejects malformed JSON, invalid types, and oversized row sets', () => {
    expect(parseEdibleRows('not json')).toBeNull();
    expect(parseEdibleRows('[{"type":"UNKNOWN","weight":1,"unit":"g","percent":10,"target":1}]')).toBeNull();
    expect(parseEdibleRows(JSON.stringify(Array(25).fill(edibleRow())))).toBeNull();
    expect(parseEdibleRows(JSON.stringify([edibleRow()]))).toHaveLength(1);
  });
  it('migrates old single-ingredient saved workspaces without losing the THC component', () => {
    const defaults={edibleRows:JSON.stringify(DEFAULT_EDIBLE_ROWS.concentration),
      edibleMode:'concentration',mass:'3.5',thca:'18',thc:'0',unit:'g'};
    const migrated=migrateLegacyWorkspace('edibles',
      {mass:'2',thca:'40',thc:'3',unit:'g'},defaults);
    const rows=parseEdibleRows(migrated.edibleRows)!;
    expect(rows.map(r=>r.type)).toEqual(['THCa','THC']);
    expect(calculateEdibleFormula('concentration',rows,10)?.totalThcMg)
      .toBeCloseTo(800*CONVERSION_RATIO+60,8);
  });
  it('allows valid snapshot rows and rejects unknown mode values',()=>{
    expect(validWorkspaceValue('edibleMode','desired','weight')).toBe(true);
    expect(validWorkspaceValue('edibleMode','secret','weight')).toBe(false);
    expect(validWorkspaceValue('edibleRows',JSON.stringify(DEFAULT_EDIBLE_ROWS.weight),'[]')).toBe(true);
  });
});
describe('Tracker V3 2.0 restored session analysis',()=>{
  const cfg={tareG:5,thcaG:10,otherG:2};
  const now=1_780_000_000_000;
  const points=restoreTrackerPoints([
    {weightG:17,timestamp:now+3600000},
    {weightG:17-10*CO2_RATIO*.25,timestamp:now+7200000},
    {weightG:17-10*CO2_RATIO*.5,timestamp:now+10800000},
  ],cfg);
  it('reconstructs percentage setup with required 100 percent composition',()=>{
    expect(trackerConfigFromPercent(5,20,80,20)).toEqual({tareG:5,thcaG:16,otherG:4});
    expect(trackerConfigFromPercent(5,20,80,10)).toBeNull();
    expect(trackerConfigFromPercent(5,20,101,0)).toBeNull();
  });
  it('restores time-series measurements with physically modeled completion',()=>{
    expect(points).toHaveLength(3);
    points.forEach((p,i)=>expect(p.snapshot.completion).toBeCloseTo([0,25,50][i],8));
  });
  it('computes finite intervals, average and local rates separately',()=>{
    const a=analyzeTrackerSeries(points,cfg,now);
    expect(a.elapsedHours).toBe(3);
    expect(a.lastIntervalHours).toBe(1);
    expect(a.intervalThcRateGph).toBeCloseTo(10*CONVERSION_RATIO*.25,8);
    expect(a.avgThcRateGph).toBeCloseTo(10*CONVERSION_RATIO*.5/3,8);
    expect(a.estimatedRemainingHours).toBeCloseTo(2,8);
  });
  it('does not fabricate a rate from one observation',()=>{
    const a=analyzeTrackerSeries(points.slice(0,1),cfg,now);
    expect(a.intervalThcRateGph).toBeNull();
    expect(a.avgThcRateGph).toBeNull();
    expect(a.estimatedRemainingHours).toBeNull();
  });
  it('reports rebound instead of falsely showing unidirectional completion',()=>{
    const rebound=restoreTrackerPoints([
      {weightG:17-10*CO2_RATIO*.5,timestamp:now+1000},
      {weightG:17-10*CO2_RATIO*.4,timestamp:now+2000},
    ],cfg);
    const a=analyzeTrackerSeries(rebound,cfg,now);
    expect(a.massRebound).toBe(true);
    expect(a.intervalThcRateGph!).toBeLessThan(0);
    expect(a.estimatedRemainingHours).toBeNull();
  });
  it('rejects loss beyond chemically possible maximum',()=>{
    expect(restoreTrackerPoints([{weightG:17-10*CO2_RATIO*1.01,timestamp:now}],cfg)).toEqual([]);
  });
  it('exports numeric CSV with explicit UTC timestamps',()=>{
    const csv=trackerCSV(points);
    expect(csv).toContain('timestamp_utc');
    expect(csv).toContain(new Date(now+3600000).toISOString());
    expect(csv.trim().split('\r\n')).toHaveLength(4);
  });
  it('round-trips 80 stored readings without truncating valid workspace JSON',()=>{
    const readingString=JSON.stringify(Array.from({length:80},(_,i)=>({weightG:17,timestamp:now+i+1})));
    expect(parseTrackerReadings(readingString)).toHaveLength(80);
  });
});
describe('Cartridge V3 v2.1 bidirectional mass balance',()=>{
  const rows=[{type:'THCa' as const,parts:70},{type:'THC' as const,parts:30}];
  it('fills an exact target mass by backsolving THCa CO2 loss',()=>{
    const r=calculateCartridge(rows,10,1,'convert')!;
    expect(r.totalFinalWeightG).toBeCloseTo(10,8);
    expect(r.totalInputWeightG).toBeGreaterThan(10);
  });
  it('derives fillable cartridge count from a fixed input batch',()=>{
    const r=calculateCartridgeFromInput([{type:'THCa',parts:100}],10,1,'convert')!;
    expect(r.totalFinalWeightG).toBeCloseTo(10*CONVERSION_RATIO,8);
    expect(r.effectiveCarts).toBe(8);
    expect(r.totalInputWeightG-r.totalFinalWeightG).toBeCloseTo(10*CO2_RATIO,8);
  });
  it('retained-acid model conserves mass and keeps THCa distinct',()=>{
    const r=calculateCartridgeFromInput(rows,5,.5,'retain')!;
    expect(r.totalFinalWeightG).toBe(5);
    expect(r.thcaOnlyMode).toBe(false);
    expect(consolidateCompounds(r.compounds).get('THCa')?.pct).toBeCloseTo(70,8);
  });
  it('consolidates repeated THCa rows before conversion',()=>{
    const r=calculateCartridgeFromInput([{type:'THCa',parts:2},{type:'THCa',parts:3},
      {type:'Terpenes',parts:5}],10,1,'convert')!;
    expect(r.thcaInputG).toBeCloseTo(5,8);
    expect(r.totalFinalWeightG).toBeCloseTo(5*CONVERSION_RATIO+5,8);
  });
  it('rejects invalid initial material and capacities',()=>{
    expect(calculateCartridgeFromInput(rows,0,1)).toBeNull();
    expect(calculateCartridgeFromInput(rows,10,0)).toBeNull();
    expect(validWorkspaceValue('batchMode','available','target')).toBe(true);
  });
});
describe('V3 science FAQ coverage',()=>{
  it('restores original topic coverage across all categories',()=>{
    expect(SCIENCE_FAQ.length).toBeGreaterThanOrEqual(29);
    for(const category of Object.keys(SCIENCE_CATEGORIES)) {
      expect(SCIENCE_FAQ.some(item=>item.category===category)).toBe(true);
    }
  });
  it('includes key V3 questions while correcting safety claims',()=>{
    const text=SCIENCE_FAQ.map(q=>q.question+' '+q.answer).join(' ');
    for(const term of ['decarboxylation','terpenes','bubbling','activation energy','CBDa','pressure','edibles']) {
      expect(text.toLowerCase()).toContain(term.toLowerCase());
    }
    expect(text).toContain('not pressure-rated');
  });
});
