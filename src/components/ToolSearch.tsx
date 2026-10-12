import { Link } from '@tanstack/react-router';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { NAV_ITEMS, TOOLS } from '../lib/site';
import { VersionBadge } from './VersionBadge';
import { useDialogFocus } from '../lib/useDialogFocus';
import { ScrollView } from './ScrollView';

const entries = NAV_ITEMS.map(item => ({
  ...item,
  description: TOOLS.find(tool => tool.path === item.path)?.description
    ?? (item.path === '/' ? 'Open the calculator studio' : 'Read the chemistry methods and assumptions'),
}));

/** Keyboard-accessible, route-aware search. Results are regular links, not simulated commands. */
export function ToolSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const results = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return entries;
    return entries.filter(item => {
      const searchable = `${item.name} ${item.description}`.toLocaleLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [query]);

  if (!open) return null;

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      resultRefs.current[0]?.focus();
    }
    if (event.key === 'Enter' && results.length) {
      event.preventDefault();
      resultRefs.current[0]?.click();
    }
  }

  function handleResultKeys(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = index + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) inputRef.current?.focus();
      else resultRefs.current[Math.min(next, results.length - 1)]?.focus();
    }
  }

  return (
<div className="tool-search-layer">
      <button type="button" className="tool-search-backdrop" aria-label="Close search" onClick={onClose}/>
      <section ref={dialogRef} className="tool-search-dialog" role="dialog" aria-modal="true" aria-label="Find a calculator">
        <div className="tool-search-input-row">
          <Search size={17} aria-hidden="true"/>
          <input ref={inputRef} data-dialog-initial type="search" value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={handleKeys} placeholder="Find a calculator or method…" autoComplete="off"
            aria-label="Search calculators" aria-controls="calculator-search-results"/>
          <button className="icon-button" type="button" aria-label="Close search" onClick={onClose}><X size={15}/></button>
        </div>
        <div className="tool-search-section-title"><span>Tools &amp; reference</span><span>{results.length} results</span></div>
        <ScrollView as="nav" id="calculator-search-results" className="tool-search-results" viewportLabel="Calculator search results" aria-label="Search results">
          {results.length ? results.map((item, index) => (
            <Link key={item.path} to={item.path} ref={element => {resultRefs.current[index] = element;}}
              onClick={onClose} onKeyDown={event => handleResultKeys(event, index)} className="tool-search-result">
              <span className="tool-search-icon"><item.icon size={17} strokeWidth={1.8}/></span>
               <span className="tool-search-result-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
               {item.version ? <VersionBadge version={item.version}/> : null}
               <ArrowUpRight size={14} aria-hidden="true"/>
            </Link>
          )) : <p className="tool-search-empty">No matching tools. Try “THCa”, “yield”, or “mass”.</p>}
        </ScrollView>
        <div className="tool-search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Close</span>
        </div>
      </section>
    </div>
  );
}
