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
          <p>Theoretical THC and CO2 from a starting THCa mass</p>
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
      <section className="workbench-explainer" aria-labelledby="decarb-explainer-heading">
        <div className="workbench-explainer-intro">
          <span className="workbench-eyebrow">Scientific basis / THCa conversion</span>
          <h2 id="decarb-explainer-heading">How the THCa to THC calculator works</h2>
          <p>Decarboxylation releases one molecule of CO2 for every molecule of THCa converted to THC. Because THC has a lower molecular mass, the theoretical conversion factor is 314.46 / 358.47, or approximately 0.87723. Enter the starting THCa mass above to estimate the THC-equivalent mass and CO2 released at complete conversion.</p>
        </div>
        <div className="workbench-explainer-grid">
          <div>
            <h3>Understanding the 0.877 conversion factor</h3>
            <p>For 10 g of pure THCa, the theoretical output is approximately 8.772 g THC and 1.228 g CO2. The factor represents stoichiometric mass balance, not reaction efficiency, cannabinoid recovery or a guaranteed laboratory result. <Link to={GUIDE_PATH}>See the conversion formula and derivation</Link>.</p>
          </div>
          <div>
            <h3>Choosing the right decarboxylation tool</h3>
            <p>Use the <Link to="/tools/batch-yield">batch yield calculator</Link> for mixed starting material, the <Link to="/tools/thca-percentage">THCa mass-loss analyzer</Link> for weight-based estimates, or the <Link to="/tools/edible-dosage">edible dosage calculator</Link> for modeled THC per serving. Water, solvents and other volatile losses make CO2-only measurements uncertain.</p>
          </div>
        </div>
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
