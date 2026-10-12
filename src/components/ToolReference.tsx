import type { ReactNode } from 'react';
import { BookOpenText, ChevronDown } from 'lucide-react';

/**
 * Reference copy stays in server-rendered HTML for search engines and
 * accessibility, but never interrupts the calculation workbench.
 */
export function ToolReference({ children }: { children: ReactNode }) {
  return (
    <details className="workbench-reference" id="tool-reference">
      <summary className="workbench-reference-trigger">
        <span className="workbench-reference-icon"><BookOpenText size={16} strokeWidth={1.8} /></span>
        <span className="workbench-reference-title">Calculation method <small>Equation, inputs and limitations</small></span>
        <ChevronDown className="workbench-reference-chevron" size={16} strokeWidth={1.7} />
      </summary>
      <div className="workbench-reference-body">{children}</div>
    </details>
  );
}
