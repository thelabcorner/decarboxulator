import { useId } from 'react';
import type { ReactNode } from 'react';

interface NumberFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  hint?: string;
  error?: string | null;
  max?: number;
  min?: number;
  aside?: ReactNode;
  prominent?: boolean;
}

export function NumberField({
  id, label, value, onChange, suffix, hint, error, max, min = 0, aside, prominent = false,
}: NumberFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const invalid = Boolean(error);
  return (
    <div className={prominent ? 'number-field number-field-prominent' : 'number-field'}>
      <div className="field-heading">
        <label htmlFor={inputId}>{label}</label>
        {aside ? <span className="field-aside">{aside}</span> : null}
      </div>
      <div className="number-input" data-invalid={invalid}>
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          autoComplete="off"
          min={min}
          max={max}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        />
        {suffix ? <span className="input-suffix">{suffix}</span> : null}
      </div>
      {error ? <p className="field-error" id={`${inputId}-error`} role="alert">{error}</p> :
        hint ? <p className="field-hint" id={`${inputId}-hint`}>{hint}</p> : null}
    </div>
  );
}
