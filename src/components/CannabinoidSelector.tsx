import { CompactSelect } from './CompactSelect';
import { ACID_CANNABINOID_KEYS, cannabinoidChemistry, type AcidCannabinoid } from '../lib/cannabinoids';

/**
 * Reuses V4's existing portal-based, keyboard-accessible compact menu.
 * Form-local choice: the persisted workspace/run owns the selected acid.
 */
export function CannabinoidSelector({
  value, onChange, disabled = false, label = 'Acidic cannabinoid',
}: {
  value: AcidCannabinoid;
  onChange: (next: AcidCannabinoid) => void;
  disabled?: boolean;
  label?: string;
}) {
  return <CompactSelect
    className="studio-cannabinoid-select"
    label={label}
    ariaLabel={label}
    value={value}
    onChange={onChange}
    disabled={disabled}
    options={ACID_CANNABINOID_KEYS.map(key => {
      const compound = cannabinoidChemistry(key);
      return {value: key, label: `${key} → ${compound.neutral}`, description:compound.name};
    })}
  />;
}
