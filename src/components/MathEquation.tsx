import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './MathEquation.css';

/**
 * KaTeX with both semantic MathML and visible HTML.
 * Every expression is authored in source, never interpolated from unsanitized
 * user input. Sans-serif is intentional to match the application UI.
 * KaTeX owns glyph positioning: CSS only controls outer framing and scale.
 */
export function MathEquation({
  source, inline=false, title, number, compact=false,
}: {
  source:string;
  inline?:boolean;
  title?:string;
  number?:string;
  compact?:boolean;
}){
  const markup=useMemo(()=>katex.renderToString(String.raw`\mathsf{${source}}`,{
    displayMode:!inline,
    throwOnError:true,
    strict:'error',
    output:'htmlAndMathml',
    trust:false,
  }),[source,inline]);
  if(inline)return <span className="dcxr-math-inline" dangerouslySetInnerHTML={{__html:markup}}/>;
  return <figure className="dcxr-equation" data-compact={compact||undefined}>
    {(title||number)&&<figcaption className="dcxr-equation-caption">
      <span>{title}</span>
      {number&&<span className="dcxr-equation-number">{number}</span>}
    </figcaption>}
    <div className="dcxr-equation-scroll" tabIndex={0} role="group"
      aria-label={title??'Mathematical equation'}>
      <div className="dcxr-equation-render" dangerouslySetInnerHTML={{__html:markup}}/>
    </div>
  </figure>;
}

export function MathInline({source}:{source:string}){
  return <MathEquation source={source} inline/>;
}
