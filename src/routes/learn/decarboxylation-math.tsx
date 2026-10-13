import { useMemo, useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowRight, ChevronDown, Search, X } from 'lucide-react';
import { Formula, ToolHeading } from '../../components/ui';
import { MW_THCA, MW_THC, MW_CO2, CONVERSION_RATIO, CO2_RATIO } from '../../lib/decarb';
import { SCIENCE_FAQ, SCIENCE_CATEGORIES, type ScienceCategory } from '../../lib/scienceFaq';
import { GUIDE, TOOLS, pageHead } from '../../lib/site';
import './ScienceGuide.css';
import { ARTICLES } from '../../lib/articles';

export const Route=createFileRoute('/learn/decarboxylation-math')({
  head:()=>pageHead(GUIDE),component:ScienceGuide,
});

function ScienceGuide(){
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState<ScienceCategory|'all'>('all');
  const questions=useMemo(()=>SCIENCE_FAQ.filter(f=>
    (category==='all'||f.category===category)&&
    (!query.trim()||(`${f.question} ${f.answer}`).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  ),[query,category]);
  return <>
    <ToolHeading section="Reference / Knowledge base" title="Decarboxylation math and FAQ"
      description="Molar masses, THC-equivalent calculations, measurement limitations and processing questions."/>
    <div className="science-studio">
      <div className="science-studio-main">
        <section className="studio-panel science-method-panel">
          <div className="panel-heading"><div className="panel-heading-copy"><h2>Mass balance</h2>
            <p>THCa → THC + CO2, by mass</p></div><span className="small-label">Reference 01</span></div>
          <div className="panel-content">
            <Formula>THCa → THC + CO2</Formula>
            <div className="science-constants">
              <div><small>THCa</small><strong>{MW_THCA} <em>g/mol</em></strong></div>
              <div><small>THC</small><strong>{MW_THC} <em>g/mol</em></strong></div>
              <div><small>CO2 lost</small><strong>{MW_CO2.toFixed(2)} <em>g/mol</em></strong></div>
              <div><small>Retained mass</small><strong>{(CONVERSION_RATIO*100).toFixed(3)}<em>%</em></strong></div>
            </div>
            <p className="science-method-footnote">
              One mole of THCa produces one mole each of THC and CO2 in the stoichiometric model.
              THC equivalence is input THCa mass × {CONVERSION_RATIO.toFixed(6)}; the expected CO2
              fraction is {(CO2_RATIO*100).toFixed(3)}%. Neither number represents real-world conversion efficiency.
            </p>
          </div>
        </section>
        <section className="studio-panel science-method-panel" id="thca-to-thc-conversion-formula">
          <div className="panel-heading"><div className="panel-heading-copy">
            <h2>THCa to THC conversion rate and formula</h2>
            <p>Mass retained after CO2 leaves the molecule</p>
          </div><span className="small-label">Reference 02</span></div>
          <div className="panel-content">
            <p><strong>Theoretical THC mass = starting THCa mass × 0.87723.</strong> The factor comes from the molecular mass ratio, 314.46 g/mol THC divided by 358.47 g/mol THCa. It applies when one mole of THCa loses CO2 and forms one mole of THC.</p>
            <p>For 10 g of pure THCa, the stoichiometric result is approximately 8.772 g of THC and 1.228 g of CO2. The corresponding CO2 mass fraction is 44.01 / 358.47, or about 12.277% of the starting THCa mass.</p>
            <p><strong>87.723% is the theoretical retained mass, not the chemical conversion rate.</strong> It does not mean that only 87.723% of THCa reacts. Actual conversion, degradation, handling losses, and evaporation of water, solvents or terpenes are separate effects; observed weight loss alone cannot distinguish them.</p>
            <p><Link to="/tools/thca-to-thc">Calculate THCa to THC mass</Link> or use the <Link to="/tools/thca-percentage">THCa percent analyzer</Link> to explore the assumptions behind a CO2-based mass-loss estimate.</p>
          </div>
        </section>
        <section className="studio-panel science-faq-panel" id="science-questions">
          <div className="panel-heading"><div className="panel-heading-copy">
            <h2>Questions &amp; answers</h2>
            <p>{SCIENCE_FAQ.length} questions, grouped by topic</p>
          </div></div>
          <div className="panel-content">
            <div className="science-search">
              <Search size={16} aria-hidden="true"/>
              <input value={query} onChange={e=>setQuery(e.target.value)}
                type="search" aria-label="Search science questions"
                placeholder="Search chemistry, methods, safety…"/>
              {query&&<button type="button" aria-label="Clear question search" onClick={()=>setQuery('')}><X size={14}/></button>}
            </div>
            <div className="science-filters" role="group" aria-label="FAQ category">
              {([['all','All questions'],...Object.entries(SCIENCE_CATEGORIES)] as Array<[ScienceCategory|'all',string]>).map(([id,label])=>
                <button type="button" key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>
                  {label}<span>{id==='all'?SCIENCE_FAQ.length:SCIENCE_FAQ.filter(f=>f.category===id).length}</span>
                </button>)}
            </div>
            <div className="science-result-count" role="status">{questions.length} matching question{questions.length===1?'':'s'}</div>
            {questions.length?<div className="science-question-list">
              {questions.map((f,i)=><details className="science-question" key={f.question}>
                <summary><span className="science-question-number">{String(i+1).padStart(2,'0')}</span>
                  <span className="science-question-title">{f.question}<small>{SCIENCE_CATEGORIES[f.category]}</small></span>
                  <ChevronDown size={16} aria-hidden="true"/></summary>
                <p>{f.answer}</p>
              </details>)}
            </div>:<div className="science-empty">
              <p>No matching questions.</p>
              <button type="button" className="text-button" onClick={()=>{setQuery('');setCategory('all');}}>Clear filters</button>
            </div>}
          </div>
        </section>
      </div>
      <aside className="science-studio-side">
        <section className="studio-panel">
          <div className="panel-heading"><div className="panel-heading-copy"><h2>Calculator tools</h2>
            <p>Choose a calculation</p></div></div>
          <div className="science-links">{TOOLS.map(tool=><Link to={tool.path} key={tool.id}>
            <span>{tool.name}</span><ArrowRight size={14}/></Link>)}</div>
        </section>
        <section className="studio-panel">
          <div className="panel-heading"><div className="panel-heading-copy"><h2>Methods and examples</h2></div></div>
          <div className="science-links">{ARTICLES.map(article =>
            <Link to={article.path} key={article.path}><span>{article.title}</span><ArrowRight size={14}/></Link>)}</div>
        </section>
        <section className="studio-panel">
          <div className="panel-heading"><div className="panel-heading-copy"><h2>Scientific sources</h2></div></div>
          <div className="science-sources">
            <a href="https://pubchem.ncbi.nlm.nih.gov/compound/98523" target="_blank" rel="noreferrer">PubChem · THCa</a>
            <a href="https://pubchem.ncbi.nlm.nih.gov/compound/16078" target="_blank" rel="noreferrer">PubChem · THC</a>
            <a href="https://pubchem.ncbi.nlm.nih.gov/compound/280" target="_blank" rel="noreferrer">PubChem · CO2</a>
            <a href="https://www.ams.usda.gov/rules-regulations/hemp" target="_blank" rel="noopener noreferrer">USDA · Total THC context</a>
            <a href="https://pubmed.ncbi.nlm.nih.gov/28861498/" target="_blank" rel="noopener noreferrer">Wang et al. (2016) · Decarboxylation kinetics</a>
            <a href="https://pubmed.ncbi.nlm.nih.gov/15734104/" target="_blank" rel="noopener noreferrer">Dussy et al. (2005) · THCa conversion and recovery</a>
          </div>
        </section>
      </aside>
    </div>
  </>;
}
