import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import katex from 'katex';
import { MathEquation, MathNotation } from '../src/components/MathNotation';
import { METHOD_EQUATIONS } from '../src/lib/methodEquations';

describe('textbook math typography', () => {
  it('typesets every published method equation without parse errors', () => {
    let count=0;
    for (const [path,entries] of Object.entries(METHOD_EQUATIONS)) {
      expect(entries.length,path).toBeGreaterThan(0);
      for (const {tex} of entries) {
        const html=katex.renderToString(tex,{
          displayMode:true,throwOnError:true,strict:'error',trust:false,
          output:'htmlAndMathml',
        });
        expect(html,path).toContain('class="katex-html"');
        expect(html,path).toContain('class="katex-mathml"');
        expect(html,path).toContain('<math');
        count++;
      }
    }
    expect(count).toBe(14);
  });

  it('renders semantic MathML and a local horizontally scrollable equation frame in SSR', () => {
    const markup=renderToStaticMarkup(
      <MathEquation label="01 / REFERENCE" tex={String.raw`\\mathsf{m}=\\frac{M}{n}`} caption="A reference"/>
    );
    expect(markup).toContain('studio-math-viewport');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('<math');
    expect(markup).toContain('A reference');
  });

  it('supports inline typeset math without using text approximations', () => {
    const markup=renderToStaticMarkup(<MathNotation inline tex={String.raw`\\mathsf{CO}_2`}/>);
    expect(markup).toContain('studio-math-inline');
    expect(markup).toContain('<math');
  });
});
