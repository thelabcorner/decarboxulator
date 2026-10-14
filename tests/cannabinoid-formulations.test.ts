import {describe,expect,it} from 'vitest';
import {ACID_CANNABINOID_KEYS,cannabinoidChemistry} from '../src/lib/cannabinoids';
import {calculateCartridge,calculateCartridgeFromInput,COMPOUND_TYPES} from '../src/lib/cartridge';
import {calculateEdibleFormula,DEFAULT_EDIBLE_ROWS,EDIBLE_COMPOUNDS,edibleRow,parseEdibleRows} from '../src/lib/edibleFormula';
import {parseCompoundRows} from '../src/lib/workspacePayload';

describe('multi-cannabinoid production formulation',()=>{
  it('supports all acid/neutral pairs in per-row editors and defaults to THCa',()=>{
    for(const key of ACID_CANNABINOID_KEYS) {
      expect(COMPOUND_TYPES).toContain(key);
      expect(COMPOUND_TYPES).toContain(cannabinoidChemistry(key).neutral);
      expect(EDIBLE_COMPOUNDS).toContain(key);
      expect(EDIBLE_COMPOUNDS).toContain(cannabinoidChemistry(key).neutral);
    }
    expect(edibleRow().type).toBe('THCa');
    expect(DEFAULT_EDIBLE_ROWS.weight[0].type).toBe('THCa');
    expect(DEFAULT_EDIBLE_ROWS.concentration[0].type).toBe('THCa');
    expect(DEFAULT_EDIBLE_ROWS.desired[0].type).toBe('THCa');
  });
  it('backsolves mixed-acid cartridge starting mass with exact independent ratios',()=>{
    const rows=[{type:'THCa' as const,parts:30},{type:'CBGa' as const,parts:35},
      {type:'CBDa' as const,parts:20},{type:'CBNa' as const,parts:15}];
    const result=calculateCartridge(rows,10,1,'convert')!;
    expect(result).not.toBeNull();
    const expected=rows.reduce((n,r)=>n+(r.parts/100)*cannabinoidChemistry(r.type).ratio,0);
    expect(result.totalInputWeightG).toBeCloseTo(10/expected,10);
    expect(result.totalFinalWeightG).toBeCloseTo(10,10);
    expect(result.acidBreakdown).toHaveLength(4);
    expect(result.compounds.map(r=>r.finalType)).toEqual(['THC','CBG','CBD','CBN']);
    expect(result.thcFromThcaG).toBeCloseTo(result.thcaInputG*cannabinoidChemistry('THCa').ratio,10);
    const retained=calculateCartridge(rows,10,1,'retain')!;
    expect(retained.totalInputWeightG).toBe(10);
    expect(retained.acidBreakdown).toHaveLength(0);
    expect(retained.compounds.map(r=>r.finalType)).toEqual(rows.map(r=>r.type));
    const available=calculateCartridgeFromInput(rows,23,0.5,'convert')!;
    expect(available.compounds.reduce((s,row)=>s+row.finalWeightG,0)).toBeCloseTo(available.totalFinalWeightG,10);
    expect(available.acidBreakdown.reduce((s,row)=>s+row.inputG,0)).toBeCloseTo(23,10);
    expect(parseCompoundRows(JSON.stringify(rows))).toEqual(rows);
  });
  it('does not turn CBDa or CBGa into THC or ignore the conversion assumption',()=>{
    for(const key of ACID_CANNABINOID_KEYS.filter(k=>k!=='THCa')){
      const row={type:key,weight:1,unit:'g' as const,percent:100,target:100};
      const result=calculateEdibleFormula('weight',[row],10,50,60)!;
      const neutral=cannabinoidChemistry(key).neutral;
      expect(result.totalThcMg).toBe(0);
      expect(result.outputTotals[neutral]).toBeCloseTo(1000*cannabinoidChemistry(key).ratio*.5,8);
      expect(result.rows[0].outputType).toBe(neutral);
      const none=calculateEdibleFormula('weight',[row],10,0,60)!;
      expect(none.outputTotals[neutral]).toBe(0);
      expect(calculateEdibleFormula('desired',[row],10,0,60)).toBeNull();
      const target=calculateEdibleFormula('desired',[row],10,50,60)!;
      expect(target.outputTotals[neutral]).toBeCloseTo(1000,8);
      expect(target.rows[0].inputMaterialMg).toBeCloseTo(1000/(.5*cannabinoidChemistry(key).ratio),8);
    }
  });
  it('preserves THCa THC recovery behavior while showing independently recovered other output',()=>{
    const rows=[edibleRow('THCa'),edibleRow('CBDa'),edibleRow('THC')].map(row=>({...row,weight:1,unit:'g' as const}));
    const result=calculateEdibleFormula('weight',rows,10,50,80)!;
    expect(result.totalThcMg).toBeCloseTo(1000*(cannabinoidChemistry('THCa').ratio*.5*.8+.8),9);
    expect(result.outputTotals.CBD).toBeCloseTo(1000*cannabinoidChemistry('CBDa').ratio*.5,9);
    expect(result.outputTotals.THC).toBeCloseTo(result.totalThcMg,9);
    expect(parseEdibleRows(JSON.stringify(rows))).toEqual(rows);
  });
});
