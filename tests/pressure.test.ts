import { describe, expect, it } from 'vitest';
import { computePressure, buildHeatmap, toKelvin, convertTemp, P_ATM_PSI, R_SI, FLOZ_TO_M3, PSI_PER_PA, HEADSPACE_FACTORS, PRESSURE_OFFSETS, PRESSURE_CENTER_INDEX } from '../src/lib/pressure';
import { MW_THCA, MW_CO2, CONVERSION_RATIO } from '../src/lib/decarb';

describe('pressure model', () => {
  it('converts temperatures to Kelvin correctly', () => {
    expect(toKelvin(32, 'F')).toBeCloseTo(273.15, 8);
    expect(toKelvin(212, 'F')).toBeCloseTo(373.15, 8);
    expect(toKelvin(0, 'C')).toBeCloseTo(273.15, 8);
    expect(toKelvin(100, 'C')).toBeCloseTo(373.15, 8);
  });

  it('converts between F and C', () => {
    expect(convertTemp(32, 'F', 'C')).toBeCloseTo(0, 8);
    expect(convertTemp(212, 'F', 'C')).toBeCloseTo(100, 8);
    expect(convertTemp(0, 'C', 'F')).toBeCloseTo(32, 8);
    expect(convertTemp(100, 'C', 'F')).toBeCloseTo(212, 8);
    expect(convertTemp(240, 'F', 'F')).toBe(240);
  });

  it('returns null for invalid inputs', () => {
    expect(computePressure({ weightG: 0, thcaPct: 85, tempValue: 240, tempUnit: 'F', headspaceFloz: 16 })).toBeNull();
    expect(computePressure({ weightG: 28, thcaPct: 0, tempValue: 240, tempUnit: 'F', headspaceFloz: 16 })!.pCo2Psi).toBe(0);
    expect(computePressure({ weightG: 28, thcaPct: 85, tempValue: -460, tempUnit: 'F', headspaceFloz: 16 })).toBeNull();
    expect(computePressure({ weightG: 28, thcaPct: 85, tempValue: 240, tempUnit: 'F', headspaceFloz: 0 })).toBeNull();
  });

  it('computes CO2 mass from stoichiometry', () => {
    const result = computePressure({ weightG: 100, thcaPct: 100, tempValue: 240, tempUnit: 'F', headspaceFloz: 16 });
    expect(result).not.toBeNull();
    // 100g pure THCa → n_thca = 100/MW_THCA mol → n_co2 = same → co2_g = n_co2 * MW_CO2
    const expectedCo2 = (100 / MW_THCA) * MW_CO2;
    expect(result!.co2G).toBeCloseTo(expectedCo2, 8);
    // CO2 ratio check
    expect(result!.co2G / 100).toBeCloseTo(1 - CONVERSION_RATIO, 8);
  });

  it('CO2 partial pressure follows ideal gas law', () => {
    const weightG = 50, thcaPct = 80, tempF = 200, headspaceFloz = 8;
    const result = computePressure({ weightG, thcaPct, tempValue: tempF, tempUnit: 'F', headspaceFloz });
    expect(result).not.toBeNull();

    // Manual calculation
    const T_K = toKelvin(tempF, 'F');
    const thcaG = weightG * (thcaPct / 100);
    const n_co2 = thcaG / MW_THCA;
    const V_m3 = headspaceFloz * FLOZ_TO_M3;
    const pCo2_psi = (n_co2 * R_SI * T_K) / V_m3 * PSI_PER_PA;
    expect(result!.pCo2Psi).toBeCloseTo(pCo2_psi, 6);
  });

  it('total absolute pressure = air heating + CO2 contribution', () => {
    const result = computePressure({ weightG: 28, thcaPct: 85, tempValue: 240, tempUnit: 'F', headspaceFloz: 16 });
    expect(result!.pAbsPsi).toBeCloseTo(result!.pAirPsi + result!.pCo2Psi, 8);
  });

  it('gauge pressure = absolute minus ambient', () => {
    const result = computePressure({ weightG: 28, thcaPct: 85, tempValue: 240, tempUnit: 'F', headspaceFloz: 16 });
    expect(result!.pGaugePsi).toBeCloseTo(result!.pAbsPsi - P_ATM_PSI, 8);
  });

  it('reports physical pressure without claiming a safety classification', () => {
    const lower = computePressure({ weightG: 1, thcaPct: 50, tempValue: 150, tempUnit: 'F', headspaceFloz: 64 });
    const higher = computePressure({ weightG: 500, thcaPct: 95, tempValue: 240, tempUnit: 'F', headspaceFloz: 4 });
    expect(lower!.pGaugePsi).toBeLessThan(higher!.pGaugePsi);
    expect('level' in lower!).toBe(false);
    expect('level' in higher!).toBe(false);
  });

  it('C and F inputs at equivalent temperatures give same result', () => {
    const resF = computePressure({ weightG: 28, thcaPct: 85, tempValue: 240, tempUnit: 'F', headspaceFloz: 16 });
    const resC = computePressure({ weightG: 28, thcaPct: 85, tempValue: convertTemp(240, 'F', 'C'), tempUnit: 'C', headspaceFloz: 16 });
    expect(resF!.pGaugePsi).toBeCloseTo(resC!.pGaugePsi, 6);
  });

  it('buildHeatmap has a 7 by 7 sweep and an exact center scenario', () => {
    const hm = buildHeatmap(28, 85, 'F');
    expect(hm).toHaveLength(HEADSPACE_FACTORS.length);
    expect(hm[0]).toHaveLength(PRESSURE_OFFSETS.length);
    for (let r = 0; r < hm.length; r++) {
      for (let c = 0; c < hm[r].length; c++) {
        const cell = hm[r][c];
        expect(typeof cell.pGaugePsi).toBe('number');
        expect(cell.isCurrent).toBe(r === PRESSURE_CENTER_INDEX && c === PRESSURE_CENTER_INDEX);
        expect(cell.headspaceFloz).toBeCloseTo(16 * HEADSPACE_FACTORS[r], 8);
      }
    }
    expect(hm[PRESSURE_CENTER_INDEX][PRESSURE_CENTER_INDEX].tempValue).toBeCloseTo(240, 8);
  });

  it('higher temperature always produces higher absolute pressure at same volume', () => {
    const hm = buildHeatmap(28, 85, 'F');
    for (const row of hm) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i].pAbsPsi).toBeGreaterThan(row[i - 1].pAbsPsi);
      }
    }
  });

  it('larger headspace always produces lower CO2 partial pressure', () => {
    // Rows increase in free gas headspace, lowering CO2 partial pressure.
    const hm = buildHeatmap(28, 85, 'F');
    for (let col = 0; col < PRESSURE_OFFSETS.length; col++) {
      for (let row = 1; row < HEADSPACE_FACTORS.length; row++) {
        expect(hm[row][col].pGaugePsi).toBeLessThan(hm[row - 1][col].pGaugePsi);
      }
    }
  });
  it('gas contribution vanishes with zero THCa or zero modeled conversion', () => {
    const base = {weightG:28,thcaPct:80,tempValue:240,tempUnit:'F' as const,headspaceFloz:16};
    const airOnly = computePressure({...base, thcaPct:0})!;
    const noConversion = computePressure({...base, efficiency:0})!;
    expect(airOnly.pCo2Psi).toBe(0);
    expect(noConversion.pCo2Psi).toBe(0);
    expect(noConversion.pGaugePsi).toBeCloseTo(airOnly.pGaugePsi,10);
  });
  it('validates physical temperature limits and process assumptions', () => {
    const b = {weightG:28,thcaPct:80,tempValue:240,tempUnit:'F' as const,headspaceFloz:16};
    expect(computePressure({...b,tempValue:0})).not.toBeNull();
    expect(computePressure({...b,tempValue:-459.67})).toBeNull();
    expect(computePressure({...b,efficiency:-0.1})).toBeNull();
    expect(computePressure({...b,efficiency:1.1})).toBeNull();
    expect(computePressure({...b,ambientPsi:0})).toBeNull();
    expect(computePressure({...b,thcaPct:101})).toBeNull();
  });
});
