import { describe, expect, it } from 'vitest';
import {
  MW_THCA, MW_THC, MW_CO2, CONVERSION_RATIO, CO2_RATIO,
  convert, calculateBatch, analyzeMassLoss, calculateEdibles,
  trackerSetup, trackerSnapshot,
} from '../src/lib/decarb';
import { calculateCartridge, consolidateCompounds, type CompoundRow } from '../src/lib/cartridge';
import { computePressure, convertTemp, toKelvin, parseTemperature, buildHeatmap, R_SI, PSI_PER_PA, FLOZ_TO_M3 } from '../src/lib/pressure';
import { validWorkspaceValue } from '../src/lib/workspacePayload';

// Values from NRC Canada CBIS-1 reference documentation / PubChem mean molar masses;
// monoisotopic exact masses must NOT be substituted into bulk-mass balances.
describe('independent scientific reference checks', () => {
  it('uses measured-standard mean molar masses for THCa and THC', () => {
    expect(MW_THCA).toBe(358.47);
    expect(MW_THC).toBe(314.46);
    expect(MW_CO2).toBeCloseTo(44.01, 8);
    expect(CONVERSION_RATIO).toBeCloseTo(314.46 / 358.47, 12);
    expect(CO2_RATIO).toBeCloseTo(44.01 / 358.47, 12);
  });

  it('mass-conserves decarb and inverse mass-equivalence across nine orders of magnitude', () => {
    for (const mass of [1e-9, 1e-6, .001, .3, 1, 28, 100, 1e4, 1e7]) {
      const output = convert(mass, 'decarb');
      expect((output.outputGrams + output.co2Grams) / mass).toBeCloseTo(1, 11);
      expect(convert(output.outputGrams, 'reverse').outputGrams / mass).toBeCloseTo(1, 11);
    }
  });

  it('batch yield conserves all components including inert mass and reaches 100% on pure THCa', () => {
    for (const total of [0.01, 10, 1000]) {
      for (const pct of [0, 25, 85, 100]) {
        const r = calculateBatch(total, pct);
        const inert = total - r.thcaGrams;
        expect(r.thcGrams + r.co2Grams).toBeCloseTo(r.thcaGrams, 8);
        expect(inert + r.thcGrams).toBeCloseTo(r.finalWeightGrams, 8);
        expect(r.finalThcPercent).toBeCloseTo(100 * r.thcGrams / r.finalWeightGrams, 8);
        if (pct === 100) expect(r.finalThcPercent).toBeCloseTo(100, 8);
      }
    }
  });

  it('gravimetric inverse agrees with forward model for every physical mixture', () => {
    for (const acidPct of [0, 1, 5, 50, 99, 100]) {
      const batch = calculateBatch(250, acidPct);
      const estimate = analyzeMassLoss(250, batch.finalWeightGrams)!;
      expect(estimate).not.toBeNull();
      expect(estimate.thcaPercent).toBeCloseTo(acidPct, 7);
      expect(estimate.thcGrams).toBeCloseTo(batch.thcGrams, 7);
    }
    expect(analyzeMassLoss(100, 100 - 100 * CO2_RATIO - .001)).toBeNull();
  });

  it('edible milligrams balance neutral THC and acid-origin theoretical recovery', () => {
    const actual = calculateEdibles(10, 25, 5, 20, 80)!;
    expect(actual.acidThcMg).toBeCloseTo(2500 * CONVERSION_RATIO * .8, 8);
    expect(actual.startingThcMg).toBeCloseTo(500, 8);
    expect(actual.totalThcMg).toBeCloseTo(actual.acidThcMg + actual.startingThcMg, 8);
    expect(actual.totalThcMg).toBeCloseTo(actual.servingThcMg * 20, 8);
    for (const servings of [0, -1, 1.5, Infinity, NaN]) {
      expect(calculateEdibles(10, 25, 5, servings, 80)).toBeNull();
    }
    expect(calculateEdibles(10, 101, 0, 2, 100)).toBeNull();
    expect(calculateEdibles(10, 25, 5, 2, Infinity)).toBeNull();
    const recovered = calculateEdibles(10, 25, 5, 20, 80, 50)!;
    expect(recovered.acidThcMg).toBeCloseTo(actual.acidThcMg / 2, 8);
    expect(recovered.startingThcMg).toBeCloseTo(actual.startingThcMg / 2, 8);
    expect(recovered.servingThcMg).toBeCloseTo(actual.servingThcMg / 2, 8);
  });
});

describe('cartridge mass balance and target final fill', () => {
  const verify = (rows: CompoundRow[], carts = 10, capacity = 1) => {
    const r = calculateCartridge(rows, carts, capacity)!;
    expect(r).not.toBeNull();
    const inputs = r.compounds.reduce((total, c) => total + c.inputWeightG, 0);
    const outputs = r.compounds.reduce((total, c) => total + c.finalWeightG, 0);
    const co2 = r.thcaInputG - r.thcFromThcaG;
    expect(inputs).toBeCloseTo(r.totalInputWeightG, 9);
    expect(outputs).toBeCloseTo(r.totalFinalWeightG, 9);
    expect(inputs - outputs).toBeCloseTo(co2, 9);
    expect(outputs).toBeCloseTo(carts * capacity, 9);
    expect(r.compounds.reduce((total, c) => total + c.finalPct, 0)).toBeCloseTo(100, 9);
    expect(r.effectiveCarts).toBe(carts);
    return r;
  };

  it('avoids double-counting when multiple THCa rows are specified', () => {
    const r = verify([
      {type: 'THCa', parts: 40},
      {type: 'THCa', parts: 20},
      {type: 'Terpenes', parts: 20},
      {type: 'CBD', parts: 20},
    ]);
    expect(r.thcaOnlyMode).toBe(true);
    expect(consolidateCompounds(r.compounds).get('THC')!.weightG).toBeCloseTo(r.thcFromThcaG, 9);
  });

  it('keeps the final target exact for all-THCa, mixed acid, and neutral formulations', () => {
    verify([{type: 'THCa', parts: 100}]);
    verify([{type: 'THCa', parts: 20},{type: 'CBN', parts: 35},{type: 'Terpenes', parts: 45}]);
    verify([{type: 'THC', parts: 25},{type: 'THCa', parts: 25},{type: 'CBD', parts: 50}]);
    verify([{type: 'THC', parts: 80},{type: 'Terpenes', parts: 20}]);
  });

  it('rejects invalid percent contributions and partial cartridge counts', () => {
    expect(calculateCartridge([{type: 'THC', parts: -5}], 10, 1)).toBeNull();
    expect(calculateCartridge([{type: 'THC', parts: NaN}], 10, 1)).toBeNull();
    expect(calculateCartridge([{type: 'THC', parts: Infinity}], 10, 1)).toBeNull();
    expect(calculateCartridge([{type: 'THC', parts: 100}], 2.5, 1)).toBeNull();
  });
});

describe('gas-law dimensionality and guardrails', () => {
  const input = {weightG: 28, thcaPct: 85, tempValue: 240, tempUnit: 'F' as const, headspaceFloz: 16};
  it('conserves molar CO2 and scales pressure as 1 / gas volume', () => {
    const a = computePressure(input)!;
    const b = computePressure({...input, headspaceFloz: 32})!;
    const nCo2 = (input.weightG * input.thcaPct / 100) / MW_THCA;
    expect(a.co2G).toBeCloseTo(nCo2 * MW_CO2, 9);
    expect(a.pCo2Psi).toBeCloseTo(
      nCo2 * R_SI * toKelvin(240, 'F') / (16 * FLOZ_TO_M3) * PSI_PER_PA, 9,
    );
    expect(a.pCo2Psi / b.pCo2Psi).toBeCloseTo(2, 10);
    expect(a.pAbsPsi).toBeCloseTo(a.pAirPsi + a.pCo2Psi, 9);
  });

  it('accepts zero Celsius and zero Fahrenheit as physically valid inputs', () => {
    expect(computePressure({...input, tempUnit:'C', tempValue:0})).not.toBeNull();
    expect(computePressure({...input, tempValue:0})).not.toBeNull();
    expect(computePressure({...input, thcaPct:0})!.co2G).toBe(0);
  });

  it('rejects sub-absolute-zero and concentrations >100%; does not clamp invalid efficiencies', () => {
    expect(computePressure({...input, tempUnit:'C', tempValue:-274})).toBeNull();
    expect(computePressure({...input, thcaPct:120})).toBeNull();
    expect(computePressure({...input, efficiency:1.1})).toBeNull();
    expect(computePressure({...input, efficiency:NaN})).toBeNull();
    expect(computePressure({...input, headspaceFloz:Infinity})).toBeNull();
  });

  it('preserves pressure between Fahrenheit and Celsius without rounding', () => {
    const a = computePressure(input)!;
    const b = computePressure({...input, tempUnit:'C', tempValue:convertTemp(input.tempValue, 'F','C')})!;
    expect(a.pGaugePsi).toBeCloseTo(b.pGaugePsi, 10);
  });

  it('parses signed physical temperatures and rejects zero kelvin and unsafe restored values', () => {
    expect(parseTemperature('-40','F').value).toBe(-40);
    expect(parseTemperature('-40','C').value).toBe(-40);
    expect(parseTemperature('0','C').value).toBe(0);
    expect(parseTemperature('-273.15','C').value).toBeNull();
    expect(parseTemperature('-459.67','F').value).toBeNull();
    expect(parseTemperature('Infinity','F').value).toBeNull();
    expect(validWorkspaceValue('temp','-10','240')).toBe(true);
    expect(validWorkspaceValue('acidTreatment','retain','convert')).toBe(true);
    expect(validWorkspaceValue('acidTreatment','unexpected','convert')).toBe(false);
  });

  it('heatmap cell coordinates and values match the same formula directly', () => {
    for (const unit of ['F','C'] as const) {
      for (const row of buildHeatmap(10, 85, unit)) {
        for (const cell of row) {
          const expected = computePressure({
            weightG: 10, thcaPct:85, tempValue:cell.tempValue,
            tempUnit:cell.tempUnit, headspaceFloz:cell.headspaceFloz,
          })!;
          expect(cell.pGaugePsi).toBeCloseTo(expected.pGaugePsi, 10);
        }
      }
    }
  });
});

describe('gravimetric tracker physical bounds', () => {
  const cfg = {tareG:5,thcaG:28,otherG:3};
  const setup = trackerSetup(cfg);
  it('conserves mass and composition throughout the reaction', () => {
    for (const fraction of [0, .01, .25, .5, .75, .99, 1]) {
      const reading = setup.initialTotalG - setup.expectedCo2LossG * fraction;
      const snap = trackerSnapshot(reading,cfg,setup)!;
      expect(snap).not.toBeNull();
      expect(snap.completion).toBeCloseTo(100 * fraction, 7);
      expect(snap.remainingThcaG + snap.convertedThcG + cfg.otherG).toBeCloseTo(snap.contentWeightG, 8);
      expect(snap.thcaPct + snap.thcPct + snap.otherPct).toBeCloseTo(100, 7);
    }
  });
  it('rejects excess mass loss rather than clamping to an unearned 100% completion', () => {
    expect(trackerSnapshot(setup.initialTotalG - setup.expectedCo2LossG - .001,cfg,setup)).toBeNull();
    expect(trackerSnapshot(setup.initialTotalG + .001,cfg,setup)).toBeNull();
    expect(trackerSnapshot(NaN,cfg,setup)).toBeNull();
  });
});
