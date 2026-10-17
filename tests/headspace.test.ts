import { describe, expect, it } from 'vitest';
import { estimateFreeHeadspace, ML_PER_US_FLOZ, resolveHeadspace, HEADSPACE_DEFAULTS } from '../src/lib/headspace';

describe('free gas headspace: vessel volume minus actual displacement', () => {
  it('uses US fluid ounces and subtracts actual contents and hardware', () => {
    const e=estimateFreeHeadspace(16,'floz',40,10);
    expect(e.error).toBeNull();
    expect(e.value).toBeCloseTo(16-50/ML_PER_US_FLOZ,11);
    expect(e.vesselMl).toBeCloseTo(16*ML_PER_US_FLOZ,10);
  });
  it('uses millilitres directly, including very small positive free volumes', () => {
    expect(estimateFreeHeadspace(100,'ml',70,20).value).toBeCloseTo(10/ML_PER_US_FLOZ,11);
  });
  it('rejects equal/excess displacement rather than negative/zero headspace', () => {
    expect(estimateFreeHeadspace(100,'ml',100,0).value).toBeNull();
    expect(estimateFreeHeadspace(100,'ml',110,0).value).toBeNull();
  });
  it('rejects negative, nonfinite, and zero capacity inputs', () => {
    expect(estimateFreeHeadspace(0,'ml',1,0).value).toBeNull();
    expect(estimateFreeHeadspace(100,'ml',-1,0).value).toBeNull();
    expect(estimateFreeHeadspace(Infinity,'floz',0,0).value).toBeNull();
  });
  it('manual entry is preserved and overrides estimator fields', () => {
    expect(resolveHeadspace(HEADSPACE_DEFAULTS,'12','10').value).toBe(12);
  });
  it('estimated mode requires real input; does not infer material volume from vessel volume', () => {
    const f={...HEADSPACE_DEFAULTS,headspaceMode:'estimate' as const};
    expect(resolveHeadspace(f,'12','10').value).toBeNull();
  });
  it('density mode uses material mass and explicitly entered displacement density', () => {
    const f={...HEADSPACE_DEFAULTS,headspaceMode:'estimate' as const,
      vesselCapacity:'250',vesselCapacityUnit:'ml' as const,
      displacementMode:'density' as const,materialDensity:'0.8'};
    const out=resolveHeadspace(f,'12','20');
    expect(out.value).toBeCloseTo(225/ML_PER_US_FLOZ,11);
  });
  it('density mode does not invent a density for solids, oils, or unknown material', () => {
    const f={...HEADSPACE_DEFAULTS,headspaceMode:'estimate' as const,displacementMode:'density' as const};
    expect(resolveHeadspace(f,'12','20').value).toBeNull();
  });
  it('invalid displacement cannot silently fall back to manual volume', () => {
    const f={...HEADSPACE_DEFAULTS,headspaceMode:'estimate' as const,
      vesselCapacity:'100',vesselCapacityUnit:'ml' as const,displacedVolumeMl:'105'};
    expect(resolveHeadspace(f,'16','10').value).toBeNull();
  });
});
