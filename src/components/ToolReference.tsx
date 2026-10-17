import type { ReactNode } from 'react';
import { BookOpenText, ChevronDown } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { MathEquation } from './MathNotation';
import { METHOD_EQUATIONS } from '../lib/methodEquations';

/**
 * Reference copy stays in server-rendered HTML for search engines and
 * accessibility, but never interrupts the calculation workbench.
 */
export function ToolReference({ children }: { children: ReactNode }) {
  const route = useRouterState({select: s => s.location.pathname});
  const equations = METHOD_EQUATIONS[route.replace(/\/$/,'')] ?? [];
  return (
    <details className="workbench-reference" id="tool-reference">
      <summary className="workbench-reference-trigger">
        <span className="workbench-reference-icon"><BookOpenText size={16} strokeWidth={1.8} /></span>
        <span className="workbench-reference-title">Calculation method <small>Equation, inputs and limitations</small></span>
        <ChevronDown className="workbench-reference-chevron" size={16} strokeWidth={1.7} />
      </summary>
      <div className="workbench-reference-body">
        {equations.map(eq=><MathEquation key={eq.label} label={eq.label} tex={eq.tex} caption={eq.caption} compact/>)}
        {children}
      </div>
    </details>
  );
}
