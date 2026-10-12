import { Link } from '@tanstack/react-router';
import { BookOpenText, ChevronDown, ExternalLink, HelpCircle } from 'lucide-react';
import { GUIDE_PATH } from '../lib/site';

import { TOOL_QUESTIONS, type ToolId } from '../lib/toolFaq';

export function ToolFAQ({ tool }: { tool: ToolId }) {
  const questions = TOOL_QUESTIONS[tool];
  return (
    <details className="workbench-reference tool-faq" id="tool-questions">
      <summary className="workbench-reference-trigger">
        <span className="workbench-reference-icon"><HelpCircle size={16} strokeWidth={1.8}/></span>
        <span className="workbench-reference-title">Questions &amp; limitations <small>{questions.length} answers</small></span>
        <ChevronDown size={16} strokeWidth={1.7} className="workbench-reference-chevron" aria-hidden="true"/>
      </summary>
      <div className="tool-faq-list">
        {questions.map(item => (
          <details className="tool-faq-item" key={item.question}>
            <summary>{item.question}<ChevronDown size={14} strokeWidth={1.7} aria-hidden="true"/></summary>
            <p>{item.answer}</p>
          </details>
        ))}
        <Link to={GUIDE_PATH} className="tool-faq-guide">
          <BookOpenText size={14} strokeWidth={1.8} aria-hidden="true"/>
          Decarboxylation math and FAQ
          <ExternalLink size={13} strokeWidth={1.7} aria-hidden="true"/>
        </Link>
      </div>
    </details>
  );
}
