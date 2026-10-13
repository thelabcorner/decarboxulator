import { useState } from 'react';
import { CONVERSION_RATIO, formatNumber, parseAmount, potentialTotalThcPercent } from '../lib/decarb';

/** Percentage-basis calculation for two measured cannabinoid fractions.
 * All arithmetic delegates to the shared validated chemistry module.
 */
export function TotalThcCalculator() {
  const [thca, setThca] = useState('20');
  const [thc, setThc] = useState('1');
  const parsedThca = parseAmount(thca, {max: 100});
  const parsedThc = parseAmount(thc, {max: 100});
  const result = parsedThca.value === null || parsedThc.value === null ? null :
    potentialTotalThcPercent(parsedThc.value, parsedThca.value);
  const error = parsedThca.error || parsedThc.error ||
    (result === null ? 'Percentages must be nonnegative and total no more than 100%.' : null);
  return <section className="total-thc-panel" aria-label="Potential total THC calculator">
    <div className="total-thc-fields">
      <label htmlFor="article-thca">THCa from report (%)<input id="article-thca" type="number" min="0" max="100" step="any"
        inputMode="decimal" value={thca} onChange={event => setThca(event.target.value)}/></label>
      <label htmlFor="article-thc">Delta-9 THC from report (%)<input id="article-thc" type="number" min="0" max="100" step="any"
        inputMode="decimal" value={thc} onChange={event => setThc(event.target.value)}/></label>
    </div>
    <div className="total-thc-result" role="status" aria-live="polite">
      <div><small>Potential total THC</small><div><strong>{result === null ? '—' : formatNumber(result, 3)}{result === null ? '' : '%'}</strong></div></div>
      <div><small>THC equivalent per gram</small><div><strong>{result === null ? '—' : formatNumber(result * 10, 2)}{result === null ? '' : ' mg/g'}</strong></div></div>
    </div>
    {error ? <p className="total-thc-error" role="alert">{error}</p> : null}
    <p className="total-thc-note">THC + THCa × {CONVERSION_RATIO.toFixed(5)} on a shared percentage basis. Values describe potential THC-equivalent mass before incomplete conversion or recovery losses.</p>
  </section>;
}
