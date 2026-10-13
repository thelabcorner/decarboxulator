import { describe, expect, it } from 'vitest';
import {
  CO2_RATIO, CONVERSION_RATIO, MW_CO2, MW_THCA, MW_THC,
  analyzeMassLoss, calculateBatch, calculateEdibles, convert, formatAmount, parseAmount,
  potentialTotalThcPercent,
} from '../src/lib/decarb';
import { rescaleMassInput } from '../src/lib/massUnits';

describe('THCa stoichiometry', () => {
  it('conserves theoretical molar mass', () => {
    expect(MW_THCA - MW_THC).toBeCloseTo(MW_CO2, 12);
    expect(CONVERSION_RATIO + CO2_RATIO).toBeCloseTo(1, 13);
  });
  it('round-trips masses and returns the CO2 mass', () => {
    for (const amount of [0, 0.0001, 1, 10, 1e5]) {
      const forward = convert(amount,'decarb');
      const reverse = convert(forward.outputGrams,'reverse');
      expect(reverse.outputGrams).toBeCloseTo(amount, 8);
      expect(forward.outputGrams + forward.co2Grams).toBeCloseTo(amount, 8);
    }
  });
  it('computes batch mass balance and post-decarb percentage', () => {
    const batch = calculateBatch(100,85);
    expect(batch.thcaGrams).toBe(85);
    expect(batch.thcGrams).toBeCloseTo(85*CONVERSION_RATIO, 11);
    expect(batch.finalWeightGrams).toBeCloseTo(100-batch.co2Grams, 11);
    expect(batch.finalThcPercent).toBeCloseTo(100*batch.thcGrams/batch.finalWeightGrams,11);
  });
  it('inverts only physical THCa mass loss', () => {
    const before=50, after=before - before*CO2_RATIO*.8;
    const result=analyzeMassLoss(before,after)!;
    expect(result.thcaPercent).toBeCloseTo(80,9);
    expect(analyzeMassLoss(50,60)).toBeNull();
    expect(analyzeMassLoss(50,20)).toBeNull();
    expect(analyzeMassLoss(0,0)).toBeNull();
  });
  it('accounts for existing neutral THC and serving split', () => {
    const result=calculateEdibles(3.5,18,2,12,90)!;
    expect(result.totalThcMg).toBeCloseTo(3500*.18*CONVERSION_RATIO*.9+70,9);
    expect(result.servingThcMg*12).toBeCloseTo(result.totalThcMg,10);
    expect(calculateEdibles(1,60,50,1,100)).toBeNull();
    expect(calculateEdibles(1,18,0,0,100)).toBeNull();
  });
  it('calculates potential total THC from fractions on the same mass basis', () => {
    expect(potentialTotalThcPercent(1,20)).toBeCloseTo(1+20*CONVERSION_RATIO,12);
    expect(potentialTotalThcPercent(0,0)).toBe(0);
    expect(potentialTotalThcPercent(0,100)).toBeCloseTo(100*CONVERSION_RATIO,12);
    for (const [thc,thca] of [[-1,1],[1,-1],[60,50],[NaN,4],[Infinity,1]]) {
      expect(potentialTotalThcPercent(thc,thca)).toBeNull();
    }
  });
  it('rejects invalid and hostile numeric input', () => {
    for (const input of ['', ' ', '-1', 'NaN', 'Infinity', '1e309', '0x10','12dogs','2,000']) {
      expect(parseAmount(input).value).toBeNull();
    }
    expect(parseAmount('0').value).toBe(0);
    expect(parseAmount('.25').value).toBe(.25);
    expect(parseAmount('101',{max:100}).value).toBeNull();
    expect(formatAmount(.0000000001,'g')).toContain('e-');
  });
  it('preserves mass across unit switches without floating-point input artefacts', () => {
    expect(rescaleMassInput('3.5','g','mg')).toBe('3500');
    expect(rescaleMassInput('3500','mg','g')).toBe('3.5');
    expect(rescaleMassInput('0.125','g','kg')).toBe('0.000125');
    expect(rescaleMassInput('','g','mg')).toBe('');
    expect(rescaleMassInput('1e9','kg','mg')).toBeNull();
  });
});
