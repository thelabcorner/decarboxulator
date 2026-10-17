/**
 * One source of truth for acidic → neutral cannabinoid mass stoichiometry.
 * Mean molecular masses (g/mol), not kinetic yields or process recovery.
 * References:
 * NRC Canada CBIS-1 reference material certificate (THCa, CBDa, CBGa, CBNa);
 * Cannabinoids: Characteristics and Potential for Use in Food Production
 * (Molecules 2021, 26, 6723); acid mass = neutral mass + CO2.
 *
 * An acid selector changes stoichiometry only. It must never silently transfer
 * THCa temperature/time kinetics or claim chemical completion.
 */
export const ACID_CANNABINOIDS = {
  THCa: { acid: 'THCa', neutral: 'THC', acidMw: 358.47, neutralMw: 314.46, name: 'Tetrahydrocannabinolic acid' },
  CBDa: { acid: 'CBDa', neutral: 'CBD', acidMw: 358.47, neutralMw: 314.46, name: 'Cannabidiolic acid' },
  CBGa: { acid: 'CBGa', neutral: 'CBG', acidMw: 360.49, neutralMw: 316.48, name: 'Cannabigerolic acid' },
  CBCa: { acid: 'CBCa', neutral: 'CBC', acidMw: 358.47, neutralMw: 314.46, name: 'Cannabichromenic acid' },
  CBNa: { acid: 'CBNa', neutral: 'CBN', acidMw: 354.43, neutralMw: 310.43, name: 'Cannabinolic acid' },
} as const;

export type AcidCannabinoid = keyof typeof ACID_CANNABINOIDS;
export const DEFAULT_ACID_CANNABINOID: AcidCannabinoid = 'THCa';
export const ACID_CANNABINOID_KEYS = Object.keys(ACID_CANNABINOIDS) as AcidCannabinoid[];

export function isAcidCannabinoid(value: unknown): value is AcidCannabinoid {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACID_CANNABINOIDS, value);
}

export function cannabinoidChemistry(key: AcidCannabinoid = DEFAULT_ACID_CANNABINOID) {
  if (!isAcidCannabinoid(key)) throw new RangeError('Unsupported acidic cannabinoid');
  const compound = ACID_CANNABINOIDS[key];
  return {
    ...compound,
    ratio: compound.neutralMw / compound.acidMw,
    co2Ratio: (compound.acidMw - compound.neutralMw) / compound.acidMw,
    co2Mw: compound.acidMw - compound.neutralMw,
  };
}
