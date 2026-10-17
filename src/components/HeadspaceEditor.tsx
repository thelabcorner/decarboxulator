import { NumberField } from './NumberField';
import { FieldGrid, Selector } from './ui';
import { formatNumber } from '../lib/decarb';
import {
  ML_PER_US_FLOZ, resolveHeadspace, type HeadspaceFields,
} from '../lib/headspace';
import './HeadspaceEditor.css';

type Props = {
  fields: HeadspaceFields;
  sampleMassG: string;
  manualFloz: string;
  manualId?: string;
  onField: <K extends keyof HeadspaceFields>(key: K, value: HeadspaceFields[K]) => void;
  onManual: (value: string) => void;
  disabled?: boolean;
};

export function HeadspaceEditor({fields, sampleMassG, manualFloz, manualId, onField, onManual, disabled = false}: Props) {
  const result = resolveHeadspace(fields, manualFloz, sampleMassG);
  return <section className="headspace-editor" aria-label="Free gas headspace">
    <div className="headspace-editor-top">
      <div><strong>Free gas headspace</strong><small>Volume available to the gas, not vessel capacity</small></div>
      <div className="headspace-editor-toggle" role="group" aria-label="Headspace input method">
        <button type="button" aria-pressed={fields.headspaceMode==='manual'} disabled={disabled}
          onClick={()=>onField('headspaceMode','manual')}>Known</button>
        <button type="button" aria-pressed={fields.headspaceMode==='estimate'} disabled={disabled}
          onClick={()=>onField('headspaceMode','estimate')}>Estimate</button>
      </div>
    </div>
    {fields.headspaceMode==='manual'
      ? <div className="headspace-editor-fields">
          <NumberField id={manualId} label="Measured free gas volume" value={manualFloz} onChange={onManual}
            suffix="fl oz" error={result.error} min={Number.MIN_VALUE}/>
          <p className="headspace-editor-note">If you know only vessel capacity, select <strong>Estimate</strong> and subtract displaced contents.</p>
        </div>
      : <fieldset className="headspace-editor-fields" disabled={disabled}>
          <FieldGrid>
            <NumberField label="Internal vessel capacity" value={fields.vesselCapacity}
              onChange={v=>onField('vesselCapacity',v)} suffix={fields.vesselCapacityUnit==='floz'?'fl oz':'mL'}/>
            <Selector label="Capacity units" value={fields.vesselCapacityUnit}
              onChange={v=>onField('vesselCapacityUnit',v)}
              options={[{value:'floz',label:'fl oz (US)'},{value:'ml',label:'mL'}]}/>
          </FieldGrid>
          <Selector label="Material displacement" value={fields.displacementMode}
            onChange={v=>onField('displacementMode',v)}
            options={[{value:'measured',label:'Known volume'},{value:'density',label:'Mass ÷ density'}]}/>
          <FieldGrid>
            {fields.displacementMode==='measured'
              ? <NumberField label="Material volume displaced" value={fields.displacedVolumeMl}
                  onChange={v=>onField('displacedVolumeMl',v)} suffix="mL"/>
              : <NumberField label="Material density" value={fields.materialDensity}
                  onChange={v=>onField('materialDensity',v)} suffix="g/mL" min={Number.MIN_VALUE}/>}
            <NumberField label="Other displacement" value={fields.internalsVolumeMl}
              onChange={v=>onField('internalsVolumeMl',v)} suffix="mL"
              hint="Probes, stir bars, inserts"/>
          </FieldGrid>
          {result.value===null
            ? <p className="headspace-editor-error" role="status">{result.error}</p>
            : <output className="headspace-editor-result">
                <span>Estimated free gas volume</span>
                <strong>{formatNumber(result.value,3)} <small>fl oz</small></strong>
                <span>{formatNumber(result.value*ML_PER_US_FLOZ,2)} mL gas · {formatNumber(result.occupiedMl!,2)} mL displaced</span>
              </output>}
          <p className="headspace-editor-note">Uses internal volume minus actual non-gas displacement.
            For porous or loosely packed solids, bulk/packed volume is <strong>not</strong> necessarily displacement:
            connected voids may contain gas. Density mode is appropriate only with a defensible true displacement density.
            Temperature expansion, changing fill, foam and gas uptake are not modeled.</p>
        </fieldset>}
  </section>;
}
