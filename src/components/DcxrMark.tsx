import type { HTMLAttributes } from 'react';

/**
 * Use the original designer-authored dark DCXR vector in every UI theme.
 * The dark tile stays visible on light and dark surfaces without theme logic.
 */
export function DcxrMark({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} aria-hidden="true" className={['dcxr-mark', className].filter(Boolean).join(' ')}>
      <img src={`${import.meta.env.BASE_URL}brand/SVG/dcxr-dark.svg`} alt="" loading="eager" decoding="async"/>
    </span>
  );
}
