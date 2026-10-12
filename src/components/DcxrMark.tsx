import type { HTMLAttributes } from 'react';

/**
 * Designer-authored DCXR identity. Use the original themed vector files with
 * no JS theme flash and no geometry duplication in React.
 */
export function DcxrMark({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} aria-hidden="true" className={['dcxr-mark', className].filter(Boolean).join(' ')}>
      <img className="dcxr-mark-light" src={`${import.meta.env.BASE_URL}brand/SVG/dcxr-light.svg`} alt="" loading="eager" decoding="async"/>
      <img className="dcxr-mark-dark" src={`${import.meta.env.BASE_URL}brand/SVG/dcxr-dark.svg`} alt="" loading="eager" decoding="async"/>
    </span>
  );
}
