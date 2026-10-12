import { useMemo, useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowRight, ChevronDown, Search, X } from 'lucide-react';
import { ToolHeading } from '../components/ui';
import { SCIENCE_CATEGORIES, SCIENCE_FAQ, type ScienceCategory } from '../lib/scienceFaq';
import { CREATOR_NAME, CREATOR_URL, FAQ, GUIDE_PATH, SOURCE_URL, TOOLS, pageHead } from '../lib/site';
import './learn/ScienceGuide.css';

export const Route = createFileRoute('/faq')({
  head: () => pageHead(FAQ),
  component: FaqPage,
});

/** Questions share the same ledger as the prerendered FAQPage structured data. */
function FaqPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ScienceCategory | 'all'>('all');
  const results = useMemo(() => SCIENCE_FAQ.filter(entry =>
    (category === 'all' || entry.category === category) &&
    (!query.trim() || (entry.question + ' ' + entry.answer).toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()))
  ), [category, query]);

  return (
    <div className="studio-home">
      <ToolHeading section="Reference / Knowledge base" title="Decarboxylation FAQ"
        description="Answers on chemistry, thermal processing, mass measurement, formulation and model limitations." />
      <div className="workbench-attribution">A reference created by <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">{CREATOR_NAME}</a>
        <span aria-hidden="true"> · </span><a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">TheDabCorner</a>
        <span aria-hidden="true"> · </span><a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">GitHub source</a></div>
      <div className="science-studio">
        <div className="science-studio-main">
          <section className="studio-panel science-faq-panel" id="science-questions">
            <div className="panel-heading">
              <div className="panel-heading-copy">
                <h2>Questions &amp; answers</h2>
                <p>{SCIENCE_FAQ.length} evidence-informed answers · {Object.keys(SCIENCE_CATEGORIES).length} topics</p>
              </div>
              <span className="small-label">Reference / FAQ</span>
            </div>
            <div className="panel-content">
              <div className="science-search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={event => setQuery(event.target.value)}
                  aria-label="Search science questions" placeholder="Search chemistry, methods, safety…" />
                {query && <button type="button" aria-label="Clear question search" onClick={() => setQuery('')}>
                  <X size={14} />
                </button>}
              </div>
              <div className="science-filters" role="group" aria-label="FAQ category">
                {([['all', 'All questions'], ...Object.entries(SCIENCE_CATEGORIES)] as Array<[ScienceCategory | 'all', string]>)
                  .map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>
                      {label}<span>{id === 'all' ? SCIENCE_FAQ.length : SCIENCE_FAQ.filter(f => f.category === id).length}</span>
                    </button>
                  ))}
              </div>
              <div className="science-result-count" role="status">{results.length} matching question{results.length === 1 ? '' : 's'}</div>
              {results.length > 0 ? (
                <div className="science-question-list">
                  {results.map((item, index) => (
                    <details key={item.question} className="science-question">
                      <summary>
                        <span className="science-question-number">{String(index + 1).padStart(2, '0')}</span>
                        <span className="science-question-title">{item.question}
                          <small>{SCIENCE_CATEGORIES[item.category]}</small>
                        </span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="science-empty">
                  <p>No matching questions.</p>
                  <button type="button" className="text-button" onClick={() => { setCategory('all'); setQuery(''); }}>
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="science-studio-side">
          <section className="studio-panel">
            <div className="panel-heading"><div className="panel-heading-copy">
              <h2>Scientific reference</h2><p>Equations and primary literature</p>
            </div></div>
            <div className="science-links">
              <Link to={GUIDE_PATH}><span>Decarboxylation math</span><ArrowRight size={14} /></Link>
            </div>
          </section>
          <section className="studio-panel">
            <div className="panel-heading"><div className="panel-heading-copy">
              <h2>Calculators</h2><p>Explore the workbenches</p>
            </div></div>
            <div className="science-links">
              {TOOLS.map(tool => <Link key={tool.id} to={tool.path}>
                <span>{tool.name}</span><ArrowRight size={14} />
              </Link>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
