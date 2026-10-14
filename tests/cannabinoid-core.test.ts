import { describe, expect, it } from 'vitest';
import {
  ACID_CANNABINOID_KEYS, cannabinoidChemistry, DEFAULT_ACID_CANNABINOID,
  isAcidCannabinoid,
} from '../src/lib/cannabinoids';
import {
  analyzeMassLoss, calculateBatch, calculateEdibles, convert, trackerSetup, trackerSnapshot,
  CONVERSION_RATIO, CO2_RATIO,
} from '../src/lib/decarb';
import { validWorkspaceValue } from '../src/lib/workspacePayload';
import { buildShareUrl, readSharedState } from '../src/lib/share';

describe('multi-acid cannabinoid stoichiometry', () => {
  it('keeps THCa the backwards-compatible default across all calculators', () => {
    expect(DEFAULT_ACID_CANNABINOID).toBe('THCa');
    expect(convert(10,'decarb')).toEqual(convert(10,'decarb','THCa'));
    expect(calculateBatch(100,85)).toEqual(calculateBatch(100,85,'THCa'));
    expect(analyzeMassLoss(50,47)).toEqual(analyzeMassLoss(50,47,'THCa'));
    expect(calculateEdibles(3.5,18,2,12,90)).toEqual(calculateEdibles(3.5,18,2,12,90,100,'THCa'));
    expect(CONVERSION_RATIO).toBeCloseTo(cannabinoidChemistry('THCa').ratio,13);
    expect(CO2_RATIO).toBeCloseTo(cannabinoidChemistry('THCa').co2Ratio,13);
  });

  it('computes each acid to its own neutral molecular-mass ratio with conserved mass', () => {
    expect(ACID_CANNABINOID_KEYS).toEqual(['THCa','CBDa','CBGa','CBCa','CBNa']);
    for (const key of ACID_CANNABINOID_KEYS) {
      const {acidMw,neutralMw,ratio,co2Mw,co2Ratio} = cannabinoidChemistry(key);
      expect(acidMw-neutralMw).toBeCloseTo(co2Mw,12);
      // Two-decimal source masses can differ by 0.01 g/mol on subtraction.
      expect(co2Mw).toBeGreaterThan(43.99);
      expect(co2Mw).toBeLessThan(44.03);
      expect(ratio+co2Ratio).toBeCloseTo(1,13);
      for (const mass of [0,0.001,1,10,100000]) {
        const forward=convert(mass,'decarb',key);
        expect(forward.outputGrams).toBeCloseTo(mass*ratio,10);
        expect(forward.outputGrams+forward.co2Grams).toBeCloseTo(mass,8);
        const reverse=convert(forward.outputGrams,'reverse',key);
        expect(reverse.outputGrams).toBeCloseTo(mass,8);
        expect(reverse.co2Grams).toBeCloseTo(forward.co2Grams,8);
      }
    }
    // Both acids share a mass factor; CBGa/CBNa must NOT inherit it.
    expect(cannabinoidChemistry('CBDa').ratio).toBe(cannabinoidChemistry('THCa').ratio);
    expect(cannabinoidChemistry('CBGa').ratio).not.toBe(cannabinoidChemistry('THCa').ratio);
    expect(cannabinoidChemistry('CBNa').ratio).not.toBe(cannabinoidChemistry('THCa').ratio);
  });

  it('uses selected acid in batch, inverse mass analysis, simple edible, and tracker', () => {
    for (const key of ACID_CANNABINOID_KEYS) {
      const {ratio,co2Ratio}=cannabinoidChemistry(key);
      const batch=calculateBatch(100,65,key);
      expect(batch.thcaGrams).toBe(65);
      expect(batch.thcGrams).toBeCloseTo(65*ratio,11);
      expect(batch.co2Grams).toBeCloseTo(65*co2Ratio,11);
      expect(batch.finalWeightGrams+batch.co2Grams).toBeCloseTo(100,11);
      expect(batch.finalThcPercent).toBeCloseTo(100*65*ratio/batch.finalWeightGrams,11);
      const original=40, loss=original*co2Ratio*.75;
      const inversion=analyzeMassLoss(original,original-loss,key)!;
      expect(inversion.thcaPercent).toBeCloseTo(75,8);
      expect(inversion.thcGrams).toBeCloseTo(original*.75*ratio,8);
      expect(analyzeMassLoss(original,original*(1-co2Ratio*1.1),key)).toBeNull();
      const serving=calculateEdibles(10,40,10,10,50,80,key)!;
      expect(serving.totalThcMg).toBeCloseTo(10000*(.4*ratio*.5+.1)*.8,8);
      const cfg={tareG:5,thcaG:25,otherG:5,cannabinoid:key};
      const setup=trackerSetup(cfg);
      expect(setup.expectedCo2LossG).toBeCloseTo(25*co2Ratio,11);
      const snap=trackerSnapshot(setup.initialTotalG-setup.expectedCo2LossG*.5,cfg,setup)!;
      expect(snap.completion).toBeCloseTo(50,8);
      expect(snap.convertedThcG).toBeCloseTo(25*ratio*.5,8);
      expect(trackerSnapshot(setup.initialTotalG-setup.expectedCo2LossG*1.01,cfg,setup)).toBeNull();
    }
  });

  it('rejects unsupported compounds in restored and shared state', () => {
    expect(isAcidCannabinoid('CBGa')).toBe(true);
    for (const invalid of ['THC','Other','__proto__','constructor','','CBGa ','THCa/THC']) {
      expect(isAcidCannabinoid(invalid)).toBe(false);
      expect(validWorkspaceValue('cannabinoid',invalid,'THCa')).toBe(false);
    }
    expect(() => cannabinoidChemistry('garbage' as 'THCa')).toThrow(RangeError);
    const defaults={unit:'g',amount:'10',direction:'decarb',cannabinoid:'THCa'};
    const values={...defaults,cannabinoid:'CBGa'};
    const link=buildShareUrl('https://example.org/tools/thca-to-thc',values,defaults);
    expect(readSharedState(new URL(link).search,defaults)).toEqual(values);
    expect(validWorkspaceValue('cannabinoid','CBDa','THCa')).toBe(true);
  });
});
