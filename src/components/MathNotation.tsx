import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './MathNotation.css';

/**
 * Pure SSR-safe typesetting. Fixed scientific formulas remain authored LaTeX,
 * never generated from free-text user input or mixed with computation.
 * MathML is emitted alongside HTML for accessibility and selection.
 */
const KATEX_OPTIONS = {
  throwOnError: true,
  strict: 'error' as const,
  trust: false,
  output: 'htmlAndMathml' as const,
  maxExpand: 1000,
};

/** Use KaTeX's own sans-serif math glyphs where supported, not a substituted font file. */
export function MathNotation({tex,inline=false}: {tex:string;inline?:boolean}) {
  const html = useMemo(
    () => katex.renderToString(tex,{...KATEX_OPTIONS,displayMode:!inline}),
    [tex,inline],
  );
  return inline
    ? <span className="studio-math-inline" dangerouslySetInnerHTML={{__html:html}}/>
    : <div className="studio-math-viewport" role="region" aria-label="Mathematical equation" tabIndex={0}>
        <div className="studio-math-typeset" dangerouslySetInnerHTML={{__html:html}}/>
      </div>;
}

/** Fixed, immediately visible reference formula: no excessive callout styling. */
export function MathEquation({tex,label,caption,compact=false}: {
  tex:string;label?:string;caption?:string;compact?:boolean;
}) {
  return <figure className="studio-math-equation" data-compact={compact}>
    {label&&<div className="studio-math-heading"><span>DERIVATION</span><span>{label}</span></div>}
    <MathNotation tex={tex}/>
    {caption&&<figcaption>{caption}</figcaption>}
  </figure>;
}
