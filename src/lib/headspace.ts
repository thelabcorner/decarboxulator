import { parseAmount } from './decarb';

/** US customary liquid fluid ounce; the existing pressure solver uses the same convention. */
export const ML_PER_US_FLOZ = 29.5735295625;

export type HeadspaceMode = 'manual' | 'estimate';
export type VesselVolumeUnit = 'ml' | 'floz';
export type DisplacementMode = 'measured' | 'density';

export type HeadspaceFields = {
  headspaceMode: HeadspaceMode;
  vesselCapacity: string;
  vesselCapacityUnit: VesselVolumeUnit;
  displacementMode: DisplacementMode;
  displacedVolumeMl: string;
  materialDensity: string;
  internalsVolumeMl: string;
};

export const HEADSPACE_DEFAULTS: HeadspaceFields = {
  headspaceMode: 'manual',
  vesselCapacity: '16',
  vesselCapacityUnit: 'floz',
  displacementMode: 'measured',
  displacedVolumeMl: '',
  materialDensity: '',
  internalsVolumeMl: '0',
};

type EstimateResult =
  | { value: null; error: string; vesselMl: null; occupiedMl: null }
  | { value: number; error: null; vesselMl: number; occupiedMl: number };

/**
 * Free communicating gas volume is internal capacity minus actual non-gas
 * displacement. Bulk/packed-bed *envelope* volume is not the displacement
 * volume of a permeable porous sample. The user must supply displacement or
 * a defensible material density; no default density is invented.
 */
export function estimateFreeHeadspace(
  vesselCapacity: number, vesselUnit: VesselVolumeUnit,
  materialDisplacementMl: number, internalsMl: number,
): EstimateResult {
  const capacityMl = vesselCapacity * (vesselUnit === 'floz' ? ML_PER_US_FLOZ : 1);
  if (![capacityMl, materialDisplacementMl, internalsMl].every(Number.isFinite) ||
      capacityMl <= 0 || materialDisplacementMl < 0 || internalsMl < 0)
    return { value: null, error: 'Enter valid, nonnegative volumes and a positive vessel capacity.', vesselMl: null, occupiedMl: null };
  const occupiedMl = materialDisplacementMl + internalsMl;
  if (!Number.isFinite(occupiedMl) || occupiedMl >= capacityMl)
    return { value: null, error: 'The displaced volume must be smaller than the internal vessel capacity.', vesselMl: null, occupiedMl: null };
  const freeMl = capacityMl - occupiedMl;
  // Reject numerically ill-conditioned differences too close to zero.
  if (freeMl <= capacityMl * 1e-10)
    return { value: null, error: 'Headspace is too small to estimate reliably.', vesselMl: null, occupiedMl: null };
  return { value: freeMl / ML_PER_US_FLOZ, error: null, vesselMl: capacityMl, occupiedMl };
}

export function resolveHeadspace(fields: HeadspaceFields, manualFloz: string, sampleMassG: string) {
  if (fields.headspaceMode === 'manual') {
    const parsed = parseAmount(manualFloz, { min: Number.MIN_VALUE });
    return { value: parsed.value, error: parsed.error, vesselMl: null, occupiedMl: null };
  }

  const vessel = parseAmount(fields.vesselCapacity, { min: Number.MIN_VALUE });
  const internals = parseAmount(fields.internalsVolumeMl);
  if (vessel.value === null || internals.value === null)
    return { value: null, error: vessel.error ?? internals.error ?? 'Invalid volume.', vesselMl: null, occupiedMl: null };

  let displaced: number | null;
  if (fields.displacementMode === 'measured') {
    displaced = parseAmount(fields.displacedVolumeMl).value;
    if (displaced === null)
      return { value: null, error: 'Enter the measured material displacement in mL.', vesselMl: null, occupiedMl: null };
  } else {
    const mass = parseAmount(sampleMassG, { min: Number.MIN_VALUE });
    const density = parseAmount(fields.materialDensity, { min: Number.MIN_VALUE });
    if (mass.value === null || density.value === null)
      return { value: null, error: 'Enter a positive material mass and a defensible density.', vesselMl: null, occupiedMl: null };
    displaced = mass.value / density.value;
  }
  return estimateFreeHeadspace(vessel.value, fields.vesselCapacityUnit, displaced, internals.value);
}
