import type { SVGProps } from 'react';

/**
 * Activation Delta — brand-lime delta with the original white molecular group.
 * Geometry must stay identical to public/brand/activation-delta.svg. The green
 * derives from the shared --accent token so it cannot drift across themes.
 */
export function ActivationDeltaMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M43 17 13 75h61L43 17Z" stroke="var(--brand-mark-delta, #aaff00)"
        strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M43 58h17" stroke="var(--brand-mark-delta, #aaff00)"
        strokeWidth="8" strokeLinecap="round"/>
      <path d="m67 36 14-15m0 0 8-8m-8 8-6-8" stroke="var(--brand-mark-molecule, #f5f7f6)"
        strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="81" cy="21" r="4.5" fill="var(--brand-mark-molecule, #f5f7f6)"/>
      <circle cx="90" cy="12" r="5.5" fill="var(--brand-mark-molecule, #f5f7f6)"/>
      <circle cx="74" cy="12" r="3.5" fill="var(--brand-mark-molecule, #f5f7f6)"/>
    </svg>
  );
}