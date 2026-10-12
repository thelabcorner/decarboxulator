import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronRight, Clock3, Download,
  FileDown, FileUp, FolderOpen, Heart, Pencil, RotateCcw, Search, Star,
  Tag, Trash2, X,
} from 'lucide-react';
import {
  clearCalculationHistory, exportCalculationLibrary, filterCalculations,
  importCalculationLibrary, MAX_CALCULATIONS, removeCalculation, restoreCalculation,
  updateCalculation, useCalculationHistory,
  type CalculationSort, type SavedCalculation,
} from '../lib/history';
import { useDialogFocus } from '../lib/useDialogFocus';
import { ScrollView } from './ScrollView';
import { CompactSelect } from './CompactSelect';
import './SavedLibrary.css';

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(timestamp);
}
function downloadLibrary() {
  const blob = new Blob([exportCalculationLibrary()], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'decarboxulator-calculations-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LibraryRow({ record, active, onInspect, onFavorite }: {
  record: SavedCalculation; active: boolean;
  onInspect: () => void; onFavorite: () => void;
}) {
  return <div className="saved-library-row" data-selected={active}>
    <button type="button" className="saved-library-row-main" onClick={onInspect}
      aria-label={'Inspect ' + record.name}>
      <span className="saved-library-row-icon"><Bookmark size={15} strokeWidth={1.8}/></span>
      <span className="saved-library-row-copy">
        <strong>{record.name}</strong>
        <span className="saved-library-row-result">{record.result}</span>
        <small>{record.tool}<span aria-hidden="true"> · </span>{dateLabel(record.updatedAt)}</small>
      </span>
      <ChevronRight size={15} className="saved-library-row-chevron" aria-hidden="true"/>
    </button>
    <button type="button" className="saved-library-favorite"
      aria-label={record.favorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={record.favorite} title={record.favorite ? 'Unfavorite' : 'Favorite'}
      onClick={onFavorite}>
      <Star size={15} fill={record.favorite ? 'currentColor' : 'none'} strokeWidth={1.7}/>
    </button>
  </div>;
}

function Inspector({ record, onClose, onRemove, onUpdate, message }: {
  record: SavedCalculation; onClose: () => void;
  onRemove: (record: SavedCalculation) => void;
  onUpdate: (record: SavedCalculation, patch: {name?:string;note?:string;tags?:string[];favorite?:boolean}) => void;
  message: (text: string) => void;
}) {
  const [name, setName] = useState(record.name);
  const [note, setNote] = useState(record.note);
  const [tags, setTags] = useState(record.tags.join(', '));
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function commitEdit() {
    if (!name.trim()) { message('Enter a name before saving.'); return; }
    onUpdate(record, { name, note, tags: tags.split(',') });
    setEditing(false);
  }
  return <div className="saved-library-inspector">
    <div className="saved-library-inspector-toolbar">
      <button className="saved-library-back" type="button" onClick={onClose}><ArrowLeft size={15}/> Library</button>
      <span>Calculation details</span>
      <button className="saved-library-icon-button" type="button"
        aria-label={record.favorite ? 'Remove favorite' : 'Favorite calculation'}
        aria-pressed={record.favorite}
        onClick={() => onUpdate(record, {favorite: !record.favorite})}>
        <Star size={16} fill={record.favorite ? 'currentColor' : 'none'}/>
      </button>
    </div>
    <ScrollView className="saved-library-inspector-scroll" viewportLabel="Saved calculation details">
      <div className="saved-library-record-heading">
        <span className="saved-library-kicker">{record.tool}</span>
        <h3>{record.name}</h3>
        <span className="saved-library-date"><Clock3 size={12}/> Saved {dateLabel(record.savedAt)}</span>
      </div>
      <section className="saved-library-result-panel" aria-label="Saved result">
        <span>Calculated result</span>
        <strong>{record.result}</strong>
        <small>Values are restored from the saved input link.</small>
        <a className="saved-library-primary" href={record.url}>
          <RotateCcw size={15}/> Load in calculator <ArrowUpRight size={14}/>
        </a>
      </section>
      <div className="saved-library-section-title">
        <span>Record details</span>
        {!editing ? <button type="button" className="saved-library-small" onClick={() => setEditing(true)}>
          <Pencil size={13}/> Edit
        </button> : null}
      </div>
      {editing ? <form className="saved-library-edit" onSubmit={event => {event.preventDefault(); commitEdit();}}>
        <label htmlFor="library-record-name">Name</label>
        <input id="library-record-name" value={name} maxLength={100} onChange={e => setName(e.target.value)} required/>
        <label htmlFor="library-record-tags">Tags <small>Comma separated, up to 10</small></label>
        <input id="library-record-tags" value={tags} maxLength={310} onChange={e => setTags(e.target.value)} placeholder="Experiment, Batch A"/>
        <label htmlFor="library-record-note">Notes</label>
        <textarea id="library-record-note" value={note} maxLength={1500} rows={5}
          onChange={e => setNote(e.target.value)} placeholder="Add observations or a reference for this calculation."/>
        <div className="saved-library-edit-actions">
          <button type="button" className="saved-library-small" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" className="saved-library-primary"><Check size={14}/> Save changes</button>
        </div>
      </form> : <div className="saved-library-properties">
        <div><span>Notes</span><p>{record.note || 'No notes added'}</p></div>
        <div><span>Tags</span><div className="saved-library-tags">
          {record.tags.length ? record.tags.map(tag => <span key={tag}><Tag size={11}/>{tag}</span>) : <small>No tags</small>}
        </div></div>
        <div><span>Updated</span><p>{dateLabel(record.updatedAt)}</p></div>
      </div>}
      <div className="saved-library-danger">
        {confirmRemove ? <div className="saved-library-confirm">
          <strong>Delete this calculation?</strong>
          <p>You can undo the deletion until the library closes.</p>
          <div><button type="button" className="saved-library-small" onClick={() => setConfirmRemove(false)}>Cancel</button>
          <button type="button" className="saved-library-destructive" onClick={() => onRemove(record)}>Delete</button></div>
        </div> : <button type="button" className="saved-library-small" onClick={() => setConfirmRemove(true)}>
          <Trash2 size={14}/> Delete calculation
        </button>}
      </div>
    </ScrollView>
  </div>;
}

export function HistoryDrawer({ open, onClose, requestedId }: {
  open: boolean; onClose: () => void; requestedId?: string | null;
}) {
  const entries = useCalculationHistory();
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose);
  const importRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [tool, setTool] = useState('all');
  const [favorites, setFavorites] = useState(false);
  const [sort, setSort] = useState<CalculationSort>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(requestedId ?? null);
  const [showDetail, setShowDetail] = useState(Boolean(requestedId));
  const [confirmClear, setConfirmClear] = useState(false);
  const [removed, setRemoved] = useState<SavedCalculation[]>([]);
  const [notice, setNotice] = useState('');


  const toolNames = useMemo(() => [...new Set(entries.map(entry => entry.tool))].sort(), [entries]);
  const visible = useMemo(() => filterCalculations(entries, {query, tool, favorites, sort}),
    [entries, query, tool, favorites, sort]);
  const selected = entries.find(entry => entry.id === selectedId) ?? null;

  function update(record: SavedCalculation, patch: {name?:string;note?:string;tags?:string[];favorite?:boolean}) {
    setNotice(updateCalculation(record.id, patch) ? 'Changes saved.' : 'Could not save changes on this device.');
  }
  function remove(record: SavedCalculation) {
    if (removeCalculation(record.id)) {
      setRemoved(prev => [record, ...prev]);
      setNotice('Calculation deleted. Undo is available.');
      setShowDetail(false);
      setSelectedId(null);
    } else setNotice('Could not delete this calculation.');
  }
  function clear() {
    const backup = [...entries];
    if (clearCalculationHistory()) {
      setRemoved(backup);
      setNotice(backup.length + ' calculations deleted. Undo is available.');
      setShowDetail(false); setSelectedId(null); setConfirmClear(false);
    } else setNotice('Could not clear the library.');
  }
  function undo() {
    const ok = removed.map(record => restoreCalculation(record)).every(Boolean);
    if (ok) {setRemoved([]); setNotice('Calculations restored.');}
    else setNotice('Some records could not be restored; export your library before retrying.');
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 2 MB.');
      const added = importCalculationLibrary(await file.text());
      setNotice(added ? added + ' calculations imported.' : 'No new calculations to import.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  if (!open) return null;
  return <>
    <button className="saved-library-backdrop" aria-label="Close saved calculations" type="button" onClick={onClose}/>
    <aside ref={dialogRef} className="saved-library-dialog" data-show-detail={showDetail}
      role="dialog" aria-modal="true" aria-labelledby="saved-library-title">
      <div className="saved-library-header">
        <div><span className="saved-library-kicker"><FolderOpen size={13}/> Workspace / Library</span>
          <h2 id="saved-library-title">Saved calculations</h2>
          <p>{entries.length} of {MAX_CALCULATIONS} records stored on this device</p>
        </div>
        <button className="saved-library-icon-button" data-dialog-initial type="button"
          aria-label="Close saved calculations" onClick={onClose}><X size={17}/></button>
      </div>
      <div className="saved-library-actions">
        <button type="button" className="saved-library-small" onClick={() => {
          try {downloadLibrary();setNotice('Library exported to a JSON file.');}
          catch {setNotice('Export unavailable in this browser.');}
        }} disabled={!entries.length}><FileDown size={14}/> Export</button>
        <button type="button" className="saved-library-small" onClick={() => importRef.current?.click()}>
          <FileUp size={14}/> Import</button>
        <input hidden ref={importRef} type="file" tabIndex={-1} accept=".json,application/json"
          aria-label="Import saved calculations from JSON" onChange={e => void importFile(e.target.files?.[0])}/>
        <span className="saved-library-actions-spacer"/>
        <button type="button" className="saved-library-small" disabled={!entries.length}
          onClick={() => setConfirmClear(value => !value)}><Trash2 size={14}/> Clear</button>
      </div>
      {confirmClear && <div className="saved-library-clear-confirm" role="group" aria-label="Confirm clear library">
        <span>Delete all {entries.length} saved calculations?</span>
        <button type="button" onClick={() => setConfirmClear(false)}>Cancel</button>
        <button type="button" onClick={clear}>Delete all</button>
      </div>}
      {(notice || removed.length > 0) && <div className="saved-library-feedback" role="status">
        <span>{notice}</span>{removed.length ? <button type="button" onClick={undo}><RotateCcw size={13}/> Undo</button> : null}
      </div>}
      <div className="saved-library-body">
        <section className="saved-library-list-pane" aria-label="Calculation records">
          <div className="saved-library-filters">
            <label className="saved-library-search"><Search size={15}/>
              <span className="sr-only">Search calculations</span>
              <input type="search" placeholder="Search results, names, notes…" value={query} onChange={e=>setQuery(e.target.value)}/>
            </label>
            <div className="saved-library-filter-row">
              <CompactSelect ariaLabel="Filter by calculator" value={tool} onChange={setTool}
                options={[{value:'all',label:'All calculators'},...toolNames.map(name=>({value:name,label:name}))]}/>
              <CompactSelect ariaLabel="Sort calculations" value={sort} onChange={setSort}
                options={[{value:'recent',label:'Recent'},{value:'oldest',label:'Oldest'},
                  {value:'name',label:'Name'},{value:'tool',label:'Tool'}]}/>
              <button type="button" aria-label="Show favorites only" aria-pressed={favorites}
                className="saved-library-filter-star" data-selected={favorites}
                onClick={()=>setFavorites(value=>!value)}><Star size={15} fill={favorites ? 'currentColor' : 'none'}/></button>
            </div>
          </div>
          <div className="saved-library-results-label">{visible.length} {visible.length === 1 ? 'calculation' : 'calculations'}</div>
          <ScrollView className="saved-library-list" viewportLabel="Saved calculations list">
            {visible.length ? visible.map(record=><LibraryRow key={record.id} record={record} active={selectedId === record.id}
              onInspect={() => {setSelectedId(record.id);setShowDetail(true);}}
              onFavorite={() => update(record, {favorite: !record.favorite})}/>) :
              <div className="saved-library-empty">
                <Bookmark size={24} strokeWidth={1.2}/>
                <strong>{entries.length ? 'No matching calculations' : 'Your library is empty'}</strong>
                <p>{entries.length ? 'Adjust your filters or search.' : 'Save any calculator result to keep its inputs and revisit it here.'}</p>
                {entries.length ? <button type="button" onClick={()=>{setQuery('');setTool('all');setFavorites(false);}}>Reset filters</button> : null}
              </div>}
          </ScrollView>
        </section>
        {selected && <Inspector key={selected.id} record={selected}
          onClose={()=>setShowDetail(false)} onUpdate={update} onRemove={remove} message={setNotice}/>}
        {!selected && <div className="saved-library-no-selection">
          <Bookmark size={26} strokeWidth={1.2}/>
          <strong>Select a calculation</strong><p>Inspect, label, and reopen saved inputs without leaving the studio.</p>
        </div>}
      </div>
      <div className="saved-library-footer"><Heart size={12}/> Stored locally, not synced to an account <span><Download size={12}/> Export a backup</span></div>
    </aside>
  </>;
}
