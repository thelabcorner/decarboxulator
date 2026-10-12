import { formatNumber } from '../lib/decarb';

/** A measured, proportional readout. All values are masses in the same unit. */
export function MassBalance({ retained, released, retainedLabel = 'Retained mass', releasedLabel = 'CO₂ released' }: {
  retained: number;
  released: number;
  retainedLabel?: string;
  releasedLabel?: string;
}) {
  const total = retained + released;
  const percent = total > 0 ? Math.max(0, Math.min(100, retained / total * 100)) : 0;
  return (
    <div className="mass-balance" aria-label="Theoretical mass distribution">
      <div className="mass-balance-top">
        <span>Mass balance</span>
        <strong>{total > 0 ? `${formatNumber(percent, 2)}% retained` : 'No mass'}</strong>
      </div>
      <div className="mass-balance-track" role="meter" aria-label="Theoretical retained mass percentage"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${formatNumber(percent, 2)} percent`}>
        <span style={{width: `${percent}%`}}/>
      </div>
      <div className="mass-balance-legend">
        <span><i className="mass-dot mass-dot-retained"/>{retainedLabel}</span>
        <span><i className="mass-dot mass-dot-released"/>{releasedLabel}</span>
      </div>
    </div>
  );
}
