import { describe, expect, it } from 'vitest';
import { calculateBatch, analyzeMassLoss, calculateEdibles, trackerSetup, trackerSnapshot, CO2_RATIO, CONVERSION_RATIO } from '../src/lib/decarb';
import { calculateCartridge, type CompoundRow, COMPOUND_TYPES, type AcidTreatment } from '../src/lib/cartridge';
import { computePressure, convertTemp } from '../src/lib/pressure';

// Deterministic, bounded property sweeps prevent fixture overfitting.
function randomSource(seed = 0xdecacafe) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
const close = (actual: number, expected: number, tolerance = 1e-9) => {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
};

describe('bounded deterministic physical-model property sweeps', () => {
  it('validates 2000 random batch forward→gravimetric inverse balances', () => {
    const next = randomSource(0xd0c03);
    for (let i = 0; i < 2000; i++) {
      const mass = .001 + next() * 100_000;
      const acidPercent = next() * 100;
      const b = calculateBatch(mass, acidPercent);
      close(b.thcaGrams, mass * acidPercent / 100);
      close(b.thcGrams + b.co2Grams, b.thcaGrams);
      close(b.finalWeightGrams, mass - b.co2Grams);
      close(b.thcGrams + mass - b.thcaGrams, b.finalWeightGrams);
      const inverted = analyzeMassLoss(mass, b.finalWeightGrams)!;
      expect(inverted).not.toBeNull();
      close(inverted.thcaPercent, acidPercent, 2e-7);
      close(inverted.thcGrams, b.thcGrams);
    }
  });

  it('validates 1000 random edible formulations including no-acid and no-neutral endpoints', () => {
    const next = randomSource(0xed1b1e);
    for (let i = 0; i < 1000; i++) {
      const grams = .005 + next() * 100;
      const acid = next() * 100;
      const neutral = next() * (100 - acid);
      const servings = 1 + Math.floor(next() * 200);
      const eff = next() * 100;
      const recovery = next() * 100;
      const out = calculateEdibles(grams, acid, neutral, servings, eff, recovery)!;
      expect(out).not.toBeNull();
      close(out.acidThcMg, grams * 1000 * (acid / 100) * CONVERSION_RATIO * (eff / 100) * (recovery / 100));
      close(out.startingThcMg, grams * 1000 * (neutral / 100) * (recovery / 100));
      close(out.servingThcMg * servings, out.totalThcMg);
    }
  });

  it('validates 1500 multi-row, mixed-acid cartridge formulations and both treatment modes', () => {
    const next = randomSource(0xca743);
    for (let i = 0; i < 1500; i++) {
      const rows: CompoundRow[] = Array.from({ length: 1 + Math.floor(next() * 12) }, () => ({
        type: COMPOUND_TYPES[Math.floor(next() * COMPOUND_TYPES.length)],
        parts: next() * 100,
      }));
      if (i % 3 === 0) rows.push({type:'THCa', parts: 7.5}, {type:'THCa', parts: 12.5});
      const mode: AcidTreatment = i % 2 === 0 ? 'convert' : 'retain';
      const count = 1 + Math.floor(next() * 50);
      const capacity = .1 + next() * 3;
      const c = calculateCartridge(rows,count,capacity,mode)!;
      expect(c).not.toBeNull();
      close(c.totalFinalWeightG,count * capacity);
      close(c.compounds.reduce((total,r) => total + r.finalWeightG,0),c.totalFinalWeightG);
      close(c.compounds.reduce((total,r) => total + r.inputWeightG,0),c.totalInputWeightG);
      close(c.compounds.reduce((total,r) => total + r.finalPct,0),100);
      close(c.totalInputWeightG-c.totalFinalWeightG,c.thcaInputG*CO2_RATIO);
      expect(c.effectiveCarts).toBe(count);
      if (mode === 'retain') {
        close(c.totalInputWeightG,c.totalFinalWeightG);
        expect(c.thcFromThcaG).toBe(0);
      }
    }
  });

  it('validates 1000 random tracked completions with exact mass conservation', () => {
    const next = randomSource(0x7ac83);
    for (let i = 0; i < 1000; i++) {
      const cfg = {tareG: next() * 30, thcaG:.001+next()*75, otherG:next()*75};
      const setup = trackerSetup(cfg);
      const expected = next();
      const measured = setup.initialTotalG - expected * setup.expectedCo2LossG;
      const snap = trackerSnapshot(measured,cfg,setup)!;
      expect(snap).not.toBeNull();
      close(snap.completion,expected*100,2e-7);
      close(snap.remainingThcaG+snap.convertedThcG+cfg.otherG,snap.contentWeightG);
      close(snap.thcaPct+snap.thcPct+snap.otherPct,100);
    }
  });

  it('validates 500 random C/F and headspace reciprocal gas pressure relationships', () => {
    const next = randomSource(0xface);
    for (let i = 0; i < 500; i++) {
      const tempF = 50+next()*250;
      const param = {weightG:.01+next()*250, thcaPct:next()*100,
        tempValue:tempF, tempUnit:'F' as const, headspaceFloz:1+next()*90};
      const a = computePressure(param)!;
      const b = computePressure({...param, tempUnit:'C',tempValue:convertTemp(tempF,'F','C')})!;
      const doubleHeadspace = computePressure({...param,headspaceFloz:param.headspaceFloz*2})!;
      expect(a).not.toBeNull();
      close(a.pGaugePsi,b.pGaugePsi);
      close(a.pCo2Psi,doubleHeadspace.pCo2Psi*2);
      close(a.pAbsPsi,a.pAirPsi+a.pCo2Psi);
      expect(a.pCo2Psi).toBeGreaterThanOrEqual(0);
    }
  });
});
