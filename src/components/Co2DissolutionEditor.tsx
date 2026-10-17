import { NumberField } from './NumberField';
import { FieldGrid, Selector, Notice } from './ui';
import { parseAmount } from '../lib/decarb';
import type { Co2Dissolution } from '../lib/co2Dissolution';
import './Co2DissolutionEditor.css';

export const CO2_DISSOLUTION_DEFAULTS={
  co2Dissolution:'off' as 'off'|'on',
  co2LiquidMl:'',
  co2Henry:'',
};
type Fields=typeof CO2_DISSOLUTION_DEFAULTS;
export function getDissolution(fields:Fields):{value:Co2Dissolution|null;error:string|null} {
  if(fields.co2Dissolution==='off')return {value:null,error:null};
  const liquid=parseAmount(fields.co2LiquidMl,{min:Number.MIN_VALUE});
  const henry=parseAmount(fields.co2Henry,{min:Number.MIN_VALUE});
  if(liquid.value===null||henry.value===null)return {
    value:null,error:liquid.error??henry.error??'Enter the dissolved-phase parameters.',
  };
  return {value:{liquidMl:liquid.value,henryMolPerLAtm:henry.value},error:null};
}
export function Co2DissolutionEditor({fields,onChange,disabled=false}:{
  fields:Fields;
  onChange:<K extends keyof Fields>(key:K,value:Fields[K])=>void;
  disabled?:boolean;
}){
  const enabled=fields.co2Dissolution==='on';
  const validation=getDissolution(fields);
  return <section className="studio-dissolution" aria-label="Dissolved CO2 accounting">
    <fieldset disabled={disabled} className="studio-fieldset">
    <Selector label="Dissolved CO2 correction" value={fields.co2Dissolution}
      onChange={v=>onChange('co2Dissolution',v)}
      options={[{value:'off',label:'Off (ideal gas)'},{value:'on',label:'On (Henry)'}]}/>
    {enabled&&<div className="studio-dissolution-inputs">
      <FieldGrid>
        <NumberField label="Liquid phase volume" value={fields.co2LiquidMl} suffix="mL"
          onChange={v=>onChange('co2LiquidMl',v)} min={Number.MIN_VALUE}
          hint="Liquid that can actually absorb CO2"/>
        <NumberField label="Henry solubility coefficient" value={fields.co2Henry} suffix="mol/L/atm"
          onChange={v=>onChange('co2Henry',v)} min={Number.MIN_VALUE}
          hint="At modeled temperature and solvent composition"/>
      </FieldGrid>
      {validation.error&&<p className="field-error" role="alert">Enter a positive liquid volume and Henry solubility coefficient to enable this model.</p>}
      <Notice>Estimated CO2 partial pressure comes from measured total pressure, the initial trapped gas, and recorded vent losses.
        No gas analyzer required. Vent estimates assume a well-mixed gas released rapidly, with no CO2 generated during each vent;
        dissolved CO2 re-equilibrates afterward. Specify a solubility coefficient for the actual liquid and temperature.
        No universal coefficient is valid for cannabinoid mixtures. Equilibrium, fixed liquid volume, no other gas sources,
        and no significant initial dissolved CO2 are assumed. This is not a vessel safety calculation.</Notice>
    </div>}
    </fieldset>
  </section>;
}
