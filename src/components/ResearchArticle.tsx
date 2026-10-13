import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, BookOpenText } from 'lucide-react';
import { ARTICLES, type ArticleEntry } from '../lib/articles';
import { CREATOR_NAME, CREATOR_URL, GUIDE_PATH, SOURCE_URL } from '../lib/site';
import './ResearchArticle.css';

/** A journal-like reading surface with a live model in the actual article.
 * Article text is SSR content; the tool is an ordinary hydrated React component.
 */
export function ResearchArticle({ entry, tool }: { entry: ArticleEntry; tool: ReactNode }) {
  return (
    <article className="research-article">
      <header className="research-head">
        <span className="research-eyebrow"><BookOpenText size={14}/> {entry.topic}</span>
        <h1>{entry.title}</h1>
        <p className="research-dek">{entry.dek}</p>
        <div className="research-byline">
          <span>By <a href={CREATOR_URL} rel="author">{CREATOR_NAME}</a></span>
          <span>Scientific notes / Decarboxulator v4</span>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source code <ArrowUpRight size={13}/></a>
        </div>
      </header>
      <div className="research-layout">
        <div className="research-main">
          <div className="research-intro">{entry.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
          {entry.sections.map((section, index) => (
            <div key={section.id}>
              <section className="research-section" id={section.id}>
                <span className="research-section-index">{String(index + 1).padStart(2, '0')}</span>
                <h2>{section.heading}</h2>
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </section>
              {index === 1 && <section className="research-embedded" id="calculator">
                <div className="research-embedded-head">
                  <div><span className="research-section-index">CALCULATION / INTERACTIVE</span>
                    <h2>{entry.toolLabel}</h2>
                    <p>The model runs here. Change the inputs and review its assumptions alongside the explanation.</p>
                  </div>
                </div>
                <div className="research-tool">{tool}</div>
                <Link to={entry.toolPath} className="research-tool-link">Open the dedicated calculator <ArrowRight size={14}/></Link>
              </section>}
            </div>
          ))}
          <section className="research-section research-references" id="references">
            <h2>References</h2>
            <div className="research-ref-list">{entry.references.map(ref =>
              <a key={ref.url} href={ref.url} target="_blank" rel="noopener noreferrer">{ref.label} <ArrowUpRight size={13}/></a>)}
            </div>
          </section>
          <section className="research-section" id="science-questions">
            <h2>Questions about this calculation</h2>
            {entry.questions.map(item => <details className="research-question" key={item.question}>
              <summary>{item.question}</summary><p>{item.answer}</p>
            </details>)}
          </section>
          <nav aria-label="Further reading" className="research-related">
            <span className="research-section-index">FURTHER READING</span>
            <Link to={GUIDE_PATH}>THCa conversion formula and scientific references <ArrowRight size={14}/></Link>
            {ARTICLES.filter(item => item.path !== entry.path).map(item =>
              <Link key={item.path} to={item.path}>{item.title} <ArrowRight size={14}/></Link>)}
          </nav>
        </div>
        <aside className="research-toc" aria-label="Article sections">
          <strong>On this page</strong>
          {entry.sections.map((section, i) => <a href={'#' + section.id} key={section.id}>
            <span>{String(i + 1).padStart(2, '0')}</span>{section.heading}</a>)}
          <a href="#calculator"><span>↳</span>Interactive calculator</a>
          <a href="#references"><span>·</span>References</a>
          <a href="#science-questions"><span>·</span>Questions</a>
        </aside>
      </div>
    </article>
  );
}
