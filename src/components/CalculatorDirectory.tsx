import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { APP_MAJOR_VERSION, TOOLS } from '../lib/site';
import { VersionBadge } from './VersionBadge';

/** Shared dense calculator index, used by the landing page and every tool. */
export function CalculatorDirectory({currentPath}:{currentPath?:string}) {
  const entries=currentPath?TOOLS.filter(tool=>tool.path!==currentPath):TOOLS;
  return <section className="workbench-tools" aria-label="More calculators">
    <div className="workbench-section-heading">
      <div><h2>{currentPath?'Other calculators':'Calculators'}</h2>
        <p>{currentPath?'Switch instruments or open another calculation':'Open a calculator'}</p></div>
      <span className="section-count">{String(entries.length).padStart(2,'0')} tools</span>
    </div>
    <nav className="workbench-tool-directory" aria-label="Calculator directory">
      {entries.map(tool=>{
        const ordinal=TOOLS.indexOf(tool)+1;
        return <Link to={tool.path} className="workbench-tool-row" key={tool.id}>
          <span className="workbench-tool-ordinal">{String(ordinal).padStart(2,'0')}</span>
          <span className="workbench-tool-icon"><tool.icon size={16} strokeWidth={1.75}/></span>
          <span className="workbench-tool-name"><strong>{tool.name}</strong><small>{tool.short}</small></span>
          <VersionBadge version={APP_MAJOR_VERSION}/>
          <ArrowUpRight size={14} aria-hidden="true"/>
        </Link>;
      })}
    </nav>
  </section>;
}
