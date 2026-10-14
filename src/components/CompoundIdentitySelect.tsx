import { CompactSelect } from './CompactSelect';
import './CannabinoidSelector.css';
import { cannabinoidChemistry, isAcidCannabinoid } from '../lib/cannabinoids';

const NEUTRAL = ['THC','CBD','CBG','CBC','CBN','THCV'];

function detail(value:string) {
  if (isAcidCannabinoid(value)) {
    const chemistry=cannabinoidChemistry(value);
    return `Acidic precursor · potential ${chemistry.neutral} after decarboxylation`;
  }
  if (NEUTRAL.includes(value)) return 'Neutral cannabinoid · no decarboxylation required';
  if(value==='Terpenes') return 'Other blend fraction · no cannabinoid conversion';
  return 'Unmodeled component · mass carried unchanged';
}

/** Formulations pick an actual ingredient identity, not a reaction direction. */
export function CompoundIdentitySelect<T extends string>({
  id, value, onChange, types, label='Ingredient compound',
}: {
  id:string; value:T; onChange:(value:T)=>void; types:readonly T[]; label?:string;
}) {
  return <div className="studio-compound-identity" data-compound={value}>
    <CompactSelect id={id} label={label} value={value} onChange={onChange}
      options={types.map(type=>({value:type,label:type,description:detail(type)}))}/>
    <span className="studio-compound-kind">{detail(value)}</span>
  </div>;
}
