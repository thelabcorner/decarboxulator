import { describe, expect, it } from 'vitest';
import { calculateCartridge, calculateCartridgeFromInput, consolidateCompounds, consolidateStartingCompounds } from '../src/lib/cartridge';
import { CONVERSION_RATIO, CO2_RATIO, trackerSetup, trackerSnapshot } from '../src/lib/decarb';

describe('cartridge formulation', () => {
  it('returns null for invalid inputs', () => {
    expect(calculateCartridge([], 10, 1)).toBeNull();
    expect(calculateCartridge([{ type: 'THC', parts: 100 }], 0, 1)).toBeNull();
    expect(calculateCartridge([{ type: 'THC', parts: 100 }], 10, 0)).toBeNull();
    expect(calculateCartridge([{ type: 'THC', parts: 0 }], 10, 1)).toBeNull();
  });

  it('distributes mass proportionally in standard mode', () => {
    const result = calculateCartridge(
      [{ type: 'THC', parts: 85 }, { type: 'Terpenes', parts: 15 }],
      10, 1,
    );
    expect(result).not.toBeNull();
    expect(result!.thcaOnlyMode).toBe(false);
    expect(result!.totalFinalWeightG).toBeCloseTo(10, 8);
    const map = consolidateCompounds(result!.compounds);
    expect(map.get('THC')!.pct).toBeCloseTo(85, 8);
    expect(map.get('Terpenes')!.pct).toBeCloseTo(15, 8);
    expect(map.get('THC')!.weightG).toBeCloseTo(8.5, 8);
  });

  it('activates thcaOnlyMode when only THCa present', () => {
    const result = calculateCartridge(
      [{ type: 'THCa', parts: 90 }, { type: 'Terpenes', parts: 10 }],
      10, 1,
    );
    expect(result!.thcaOnlyMode).toBe(true);
    // Requested cartridges are a FINAL fill target; more input compensates for CO2 loss.
    expect(result!.totalInputWeightG).toBeGreaterThan(10);
    expect(result!.totalFinalWeightG).toBeCloseTo(10, 9);
  });

  it('applies correct conversion ratio in thcaOnlyMode', () => {
    const result = calculateCartridge(
      [{ type: 'THCa', parts: 100 }],
      10, 1,
    );
    // To fill 10 g final THC, input must be 10 / CONVERSION_RATIO.
    expect(result!.thcFromThcaG).toBeCloseTo(10, 8);
    expect(result!.thcaInputG).toBeCloseTo(10 / CONVERSION_RATIO, 8);
    const map = consolidateCompounds(result!.compounds);
    expect(map.get('THC')!.weightG).toBeCloseTo(10, 8);
  });

  it('calculates effective carts from THCa yield', () => {
    // Final-target solver supplies additional input mass to fill all ten carts.
    const result = calculateCartridge([{ type: 'THCa', parts: 100 }], 10, 1);
    const expectedFill = 10;
    expect(result!.effectiveCarts).toBe(expectedFill);
  });

  it('does not trigger crystallization when THCa < 15%', () => {
    // Model a blend that retains its THCa rather than decarboxylating.
    const result = calculateCartridge(
      [{ type: 'THC', parts: 90 }, { type: 'THCa', parts: 5 }, { type: 'Terpenes', parts: 5 }],
      10, 1, 'retain',
    );
    expect(result!.warnings.crystallization).toBe(false);
  });

  it('triggers crystallization warning when THCa >= 15% in final blend', () => {
    // Explicitly unconverted THCa, with pre-existing neutral THC.
    const result = calculateCartridge(
      [{ type: 'THC', parts: 80 }, { type: 'THCa', parts: 20 }],
      10, 1, 'retain',
    );
    expect(result!.warnings.crystallization).toBe(true);
  });

  it('triggers CBD crystallization warning when CBD >= 20%', () => {
    const result = calculateCartridge(
      [{ type: 'THC', parts: 75 }, { type: 'CBD', parts: 25 }],
      10, 1,
    );
    expect(result!.warnings.cbdCryst).toBe(true);
  });

  it('triggers terpene warning when Terpenes >= 10%', () => {
    const result = calculateCartridge(
      [{ type: 'THC', parts: 85 }, { type: 'Terpenes', parts: 15 }],
      10, 1,
    );
    expect(result!.warnings.terpenes).toBe(true);
  });

  it('consolidates multiple same-type rows', () => {
    const result = calculateCartridge(
      [{ type: 'THC', parts: 50 }, { type: 'THC', parts: 50 }],
      10, 1,
    );
    const map = consolidateCompounds(result!.compounds);
    expect(map.get('THC')!.pct).toBeCloseTo(100, 8);
    expect(map.size).toBe(1);
  });
  it('supplies pre-decarb batch inputs alongside finished output for eight cartridges', () => {
    const result=calculateCartridge([
      {type:'THCa',parts:80},{type:'CBD',parts:22},{type:'Terpenes',parts:5},
    ],8,1.05,'convert')!;
    const input=consolidateStartingCompounds(result.compounds);
    const output=consolidateCompounds(result.compounds);
    expect(result.totalFinalWeightG).toBeCloseTo(8.4,10);
    expect(result.effectiveCarts).toBe(8);
    expect(input.get('THCa')).toBeCloseTo(result.thcaInputG,10);
    expect(input.get('THCa')!).toBeGreaterThan(result.thcFromThcaG);
    expect(output.has('THCa')).toBe(false);
    expect(output.get('THC')!.weightG).toBeCloseTo(result.thcFromThcaG,10);
    expect(input.get('CBD')).toBeCloseTo(output.get('CBD')!.weightG,10);
    expect(input.get('Terpenes')).toBeCloseTo(output.get('Terpenes')!.weightG,10);
    expect([...input.values()].reduce((s,v)=>s+v,0)).toBeCloseTo(result.totalInputWeightG,10);
    expect(result.totalInputWeightG-result.totalFinalWeightG)
      .toBeCloseTo(result.thcaInputG-result.thcFromThcaG,10);
  });
  it('consolidates duplicate starting acids in available and retain modes', () => {
    const rows=[{type:'THCa' as const,parts:30},{type:'THCa' as const,parts:50},{type:'CBD' as const,parts:20}];
    for (const mode of ['convert','retain'] as const) {
      const result=calculateCartridgeFromInput(rows,10,1,mode)!;
      const input=consolidateStartingCompounds(result.compounds);
      expect(input.size).toBe(2);
      expect(input.get('THCa')).toBeCloseTo(8,10);
      expect(input.get('CBD')).toBeCloseTo(2,10);
      expect([...input.values()].reduce((s,v)=>s+v,0)).toBeCloseTo(10,10);
      expect(consolidateCompounds(result.compounds).has('THCa')).toBe(mode==='retain');
    }
  });
  it('converts THCa regardless of coexisting neutral THC', () => {
    const blend = [{type:'THC' as const,parts:50},{type:'THCa' as const,parts:50}];
    const converted = calculateCartridge(blend,10,1,'convert')!;
    const unconverted = calculateCartridge(blend,10,1,'retain')!;
    expect(converted.thcaOnlyMode).toBe(true);
    expect(consolidateCompounds(converted.compounds).get('THCa')).toBeUndefined();
    expect(consolidateCompounds(converted.compounds).get('THC')!.weightG).toBeCloseTo(10,8);
    expect(unconverted.thcaOnlyMode).toBe(false);
    expect(unconverted.totalInputWeightG).toBeCloseTo(10,8);
    expect(converted.totalInputWeightG).toBeGreaterThan(10);
  });
  it('conserves mass across duplicate THCa rows after conversion', () => {
    const result = calculateCartridge([
      {type:'THCa',parts:40},{type:'THCa',parts:30},{type:'CBD',parts:30},
    ],12,0.5,'convert')!;
    const inputSum = result.compounds.reduce((sum,c)=>sum+c.inputWeightG,0);
    const finalSum = result.compounds.reduce((sum,c)=>sum+c.finalWeightG,0);
    expect(inputSum).toBeCloseTo(result.totalInputWeightG,10);
    expect(finalSum).toBeCloseTo(6,10);
    expect(finalSum + result.thcaInputG * CO2_RATIO).toBeCloseTo(inputSum,10);
    expect(result.compounds.reduce((sum,c)=>sum+c.finalPct,0)).toBeCloseTo(100,10);
    expect(result.effectiveCarts).toBe(12);
  });
  it('rejects invalid row weights, non-integer cartridge counts and unknown modes', () => {
    expect(calculateCartridge([{type:'CBD',parts:-1}],10,1)).toBeNull();
    expect(calculateCartridge([{type:'CBD',parts:Infinity}],10,1)).toBeNull();
    expect(calculateCartridge([{type:'CBD',parts:1}],10.5,1)).toBeNull();
    expect(calculateCartridge([{type:'CBD',parts:1}],10,1,'invalid' as 'convert')).toBeNull();
  });
});

describe('decarb tracker math', () => {
  it('computes setup correctly', () => {
    const cfg = { tareG: 5, thcaG: 28, otherG: 2 };
    const setup = trackerSetup(cfg);
    expect(setup.initialTotalG).toBeCloseTo(35, 8);
    expect(setup.expectedFinalThcG).toBeCloseTo(28 * CONVERSION_RATIO, 8);
    expect(setup.expectedCo2LossG).toBeCloseTo(28 * CO2_RATIO, 8);
    expect(setup.expectedFinalContentG).toBeCloseTo(28 * CONVERSION_RATIO + 2, 8);
  });

  it('returns null for invalid current weight', () => {
    const cfg = { tareG: 5, thcaG: 28, otherG: 2 };
    const setup = trackerSetup(cfg);
    expect(trackerSnapshot(0, cfg, setup)).toBeNull();
    // current > initial total → invalid
    expect(trackerSnapshot(setup.initialTotalG + 1, cfg, setup)).toBeNull();
    expect(trackerSnapshot(setup.initialTotalG - setup.expectedCo2LossG - 0.01, cfg, setup)).toBeNull();
    expect(trackerSnapshot(NaN, cfg, setup)).toBeNull();
  });

  it('returns 0% completion at initial weight', () => {
    const cfg = { tareG: 5, thcaG: 28, otherG: 2 };
    const setup = trackerSetup(cfg);
    const snap = trackerSnapshot(setup.initialTotalG, cfg, setup);
    expect(snap!.completion).toBeCloseTo(0, 8);
    expect(snap!.weightLossG).toBeCloseTo(0, 8);
  });

  it('returns 100% completion when weight loss equals expected CO2 loss', () => {
    const cfg = { tareG: 5, thcaG: 28, otherG: 2 };
    const setup = trackerSetup(cfg);
    const finalWeight = setup.initialTotalG - setup.expectedCo2LossG;
    const snap = trackerSnapshot(finalWeight, cfg, setup);
    expect(snap!.completion).toBeCloseTo(100, 6);
    expect(snap!.remainingThcaG).toBeCloseTo(0, 6);
    expect(snap!.convertedThcG).toBeCloseTo(28 * CONVERSION_RATIO, 6);
  });

  it('correctly computes intermediate snapshot', () => {
    const cfg = { tareG: 5, thcaG: 28, otherG: 2 };
    const setup = trackerSetup(cfg);
    // 50% completion
    const midWeight = setup.initialTotalG - setup.expectedCo2LossG * 0.5;
    const snap = trackerSnapshot(midWeight, cfg, setup);
    expect(snap!.completion).toBeCloseTo(50, 6);
    expect(snap!.remainingThcaG).toBeCloseTo(14, 6);
    expect(snap!.convertedThcG).toBeCloseTo(14 * CONVERSION_RATIO, 6);
  });

  it('percentages sum to ~100 at any completion level', () => {
    const cfg = { tareG: 5, thcaG: 28, otherG: 2 };
    const setup = trackerSetup(cfg);
    for (const fraction of [0.1, 0.5, 0.9]) {
      const w = setup.initialTotalG - setup.expectedCo2LossG * fraction;
      const snap = trackerSnapshot(w, cfg, setup)!;
      const total = snap.thcaPct + snap.thcPct + snap.otherPct;
      expect(total).toBeCloseTo(100, 4);
    }
  });
});
