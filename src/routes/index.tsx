import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight, ChevronRight, Info } from 'lucide-react';
import { ConversionCalculator } from '../components/Calculators';
import { CONVERSION_RATIO } from '../lib/decarb';
import { APP_MAJOR_VERSION, CREATOR_NAME, CREATOR_URL, FAQ_PATH, GUIDE_PATH, HOME, SOURCE_URL, TOOLS, pageHead } from '../lib/site';
import { VersionBadge } from '../components/VersionBadge';

export const Route = createFileRoute('/')({
  head: () => pageHead(HOME),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="studio-home">
      <div className="workbench-heading">
        <div className="workbench-heading-title">
          <span className="workbench-eyebrow">Calculator / Conversion</span>
          <h1>THCa to THC</h1>
          <p>Theoretical THC and CO₂ from a starting THCa mass</p>
        </div>
        <div className="workbench-factor" title="Molar-mass ratio of THC to THCa">
          <span>MW ratio</span><strong>{CONVERSION_RATIO.toFixed(5)}</strong>
        </div>
      </div>
      <ConversionCalculator/>
      <section className="workbench-tools" aria-labelledby="tool-directory-heading">
        <div className="workbench-section-heading">
          <div><h2 id="tool-directory-heading">Calculators</h2><p>Open a calculator</p></div>
          <span className="section-count">{String(TOOLS.length).padStart(2, '0')} tools</span>
        </div>
        <nav className="workbench-tool-directory" aria-label="Calculator directory">
          {TOOLS.map((tool, index) => (
            <Link to={tool.path} className="workbench-tool-row" key={tool.id}>
              <span className="workbench-tool-ordinal">{String(index + 1).padStart(2, '0')}</span>
              <span className="workbench-tool-icon"><tool.icon size={16} strokeWidth={1.75}/></span>
               <span className="workbench-tool-name"><strong>{tool.name}</strong><small>{tool.eyebrow}</small></span>
               <VersionBadge version={APP_MAJOR_VERSION}/>
               <ArrowUpRight size={14} aria-hidden="true"/>
            </Link>
          ))}
        </nav>
      </section>
      <div className="workbench-methods">
        <Info size={14} aria-hidden="true"/>
        <span>Calculated yields are theoretical. <Link to={GUIDE_PATH}>Review assumptions <ChevronRight size={13}/></Link> · <Link to={FAQ_PATH}>FAQ</Link></span>
      </div>
      <div className="workbench-attribution">Created by <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">{CREATOR_NAME}</a>
        <span aria-hidden="true"> · </span><a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">TheDabCorner</a>
        <span aria-hidden="true"> · </span><a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">GitHub source</a></div>
    </div>
  );
}
