import { CompactSelect } from './CompactSelect';
import './CannabinoidSelector.css';
import { ACID_CANNABINOID_KEYS, cannabinoidChemistry, type AcidCannabinoid } from '../lib/cannabinoids';

export type CompoundContext = 'conversion' | 'batch' | 'analysis' | 'pressure' | 'tracker';

const CONTEXT: Record<CompoundContext, {label:string; product:string; hint:string}> = {
  conversion: {label:'Starting acidic compound', product:'Neutral product', hint:'The molecular ratio determines mass yield; selecting a compound does not predict reaction completion.'},
  batch: {label:'Acid measured in the batch', product:'Potential product', hint:'The composition percentage below applies to this one acidic compound, not total cannabinoids.'},
  analysis: {label:'Assumed source of CO2', product:'Inferred product', hint:'Only valid if this is the sole decarboxylating acid and all mass loss is CO2.'},
  pressure: {label:'Acid producing modeled CO2', product:'Potential product', hint:'Defines theoretical CO2 generation, not a kinetic rate or vessel safety limit.'},
  tracker: {label:'Acid in the starting material', product:'Modeled product', hint:'Locked for the entire measurement run after recording starts.'},
};

/** Context-aware chemical identity field. One species is chosen, its product is derived.
 * The menu never pretends neutral -> acid is a chemical reaction.
 * Uses the existing portal context menu for mobile/keyboard/focus geometry. */
export function CannabinoidSelector({
  value, onChange, disabled = false, context = 'conversion', label,
}: {
  value: AcidCannabinoid;
  onChange: (next: AcidCannabinoid) => void;
  disabled?: boolean;
  context?: CompoundContext;
  label?: string;
}) {
  const chemistry = cannabinoidChemistry(value);
  const copy = CONTEXT[context];
  return <div className="studio-chemical-identity" data-context={context} data-acid={value}>
    <div className="studio-chemical-identity-grid">
      <CompactSelect className="studio-cannabinoid-select"
        label={label ?? copy.label} ariaLabel={label ?? copy.label}
        value={value} onChange={onChange} disabled={disabled}
        options={ACID_CANNABINOID_KEYS.map(key => ({
          value:key, label:key,
          description:`${cannabinoidChemistry(key).name} · product ${cannabinoidChemistry(key).neutral}`,
        }))}/>
      <div className="studio-chemical-product">
        <span className="studio-field-caption">{copy.product}</span>
        <div className="studio-chemical-product-value">
          <strong>{chemistry.neutral}</strong>
          <small>derived from {chemistry.acid}</small>
        </div>
      </div>
    </div>
    <p className="studio-chemical-hint">{copy.hint}</p>
  </div>;
}
