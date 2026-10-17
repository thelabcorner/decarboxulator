import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronRight, Clock3, Download,
  FileDown, FileUp, FolderOpen, Heart, Pencil, RotateCcw, Search, Star,
  Tag, Trash2, X,
} from 'lucide-react';
import {
  clearCalculationHistory, filterCalculations,
  MAX_CALCULATIONS, removeCalculation, restoreCalculations,
  updateCalculation, useCalculationHistory,
  type CalculationSort, type SavedCalculation,
} from '../lib/history';
import { useDialogFocus } from '../lib/useDialogFocus';
import {
  readUnifiedLibrary, encodeUnifiedLibrary, importUnifiedLibrary,
  deleteUnifiedRun, cloneUnifiedRun, setUnifiedRunStatus, legacySessionJSON,
} from '../lib/unifiedLibrary';
import type { TrackerSession } from '../lib/trackerSessions';
import { ScrollView } from './ScrollView';
import { CompactSelect } from './CompactSelect';
import './SavedLibrary.css';

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(timestamp);
}
async function downloadLibrary() {
  const json=encodeUnifiedLibrary(await readUnifiedLibrary());
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  if(blob.size>64*1024*1024)throw Error('Full library backup exceeds 64 MB. Export smaller legacy archives by record type.');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'decarboxulator-library-' + new Date().toISOString().slice(0, 10) + '.json';
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
  const [scope,setScope]=useState<'all'|'calculations'|'sessions'>('all');
  const [selectedRunId,setSelectedRunId]=useState<string|null>(null);
  const [runs,setRuns]=useState<TrackerSession[]>([]);
  const [total,setTotal]=useState(0);
  const [pageSize,setPageSize]=useState(160);
  const [loadError,setLoadError]=useState<string|null>(null);
  useEffect(()=>{
    if(!open)return;
    let alive=true;
    const refresh=async()=>{
      try{
        const data=await readUnifiedLibrary();
        if(alive){setRuns(data.sessions);setTotal(data.total);setLoadError(null);}
      }catch(e){if(alive)setLoadError(e instanceof Error?e.message:'Could not read library');}
    };
    void refresh();
    window.addEventListener('decarboxulator:library-changed',refresh);
    let channel:BroadcastChannel|null=null;
    try{channel=new BroadcastChannel('decarboxulator-v4:library');channel.onmessage=()=>void refresh();}catch{/* unavailable */}
    return ()=>{alive=false;window.removeEventListener('decarboxulator:library-changed',refresh);channel?.close();};
  },[open]);


  const toolNames = useMemo(() => [...new Set(entries.map(entry => entry.tool))].sort(), [entries]);
  const visible = useMemo(() => filterCalculations(entries, {query, tool, favorites, sort}),
    [entries, query, tool, favorites, sort]);
  const selected = entries.find(entry => entry.id === selectedId) ?? null;
  const selectedRun=runs.find(r=>r.id===selectedRunId)??null;
  const runVisible=useMemo(()=>runs.filter(run=>{
    if(favorites||tool!=='all')return false;
    const q=query.trim().toLocaleLowerCase();
    return !q||(run.title+' '+run.notes+' '+run.status).toLocaleLowerCase().includes(q);
  }),[runs,query,favorites,tool]);
  const results=useMemo(()=>{
    const list=[
      ...(scope==='sessions'?[]:visible.map(record=>({type:'calculation' as const,id:record.id,updatedAt:record.updatedAt,name:record.name,record}))),
      ...(scope==='calculations'?[]:runVisible.map(run=>({type:'session' as const,id:run.id,updatedAt:run.updatedAt,name:run.title,run}))),
    ];
    list.sort((a,b)=>sort==='oldest'?a.updatedAt-b.updatedAt:
      sort==='name'?a.name.localeCompare(b.name):
      sort==='tool'?a.type.localeCompare(b.type)||b.updatedAt-a.updatedAt:
      b.updatedAt-a.updatedAt);
    return list;
  },[visible,runVisible,scope,sort]);
  const showing=results.slice(0,pageSize);
  async function updateRun(id:string,action:'clone'|'delete'|'completed'|'paused'){
    try{
      if(action==='delete'){
        if(!window.confirm('Permanently delete this run and all its readings? Export a backup first if needed.'))return;
        await deleteUnifiedRun(id);setSelectedRunId(null);
      } else if(action==='clone'){await cloneUnifiedRun(id);}
      else{await setUnifiedRunStatus(id,action);}
      setNotice('Run updated in the shared library.');
    }catch(e){setNotice(e instanceof Error?e.message:'Could not update run.');}
  }
  function exportRun(run:TrackerSession){
    const blob=new Blob([legacySessionJSON(run)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='decarboxulator-run-'+run.id.slice(0,22)+'.json';
    anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const trackerLink=(id:string)=>import.meta.env.BASE_URL+'tools/decarb-tracker/?session='+encodeURIComponent(id);

  async function update(record: SavedCalculation, patch: {name?:string;note?:string;tags?:string[];favorite?:boolean}) {
    setNotice(await updateCalculation(record.id, patch) ? 'Changes saved.' : 'Could not save changes on this device.');
  }
  async function remove(record: SavedCalculation) {
    if (await removeCalculation(record.id)) {
      setRemoved(prev => [record, ...prev]);
      setNotice('Calculation deleted. Undo is available.');
      setShowDetail(false);
      setSelectedId(null);
    } else setNotice('Could not delete this calculation.');
  }
  async function clear() {
    const backup = [...entries];
    if (await clearCalculationHistory()) {
      setRemoved(backup);
      setNotice(backup.length + ' calculations deleted. Undo is available.');
      setShowDetail(false); setSelectedId(null); setConfirmClear(false);
    } else setNotice('Could not clear the library.');
  }
  async function undo() {
    if (await restoreCalculations(removed)) {
      setRemoved([]); setNotice('Calculations restored.');
    } else setNotice('Restore failed without modifying existing records. Export a backup before retrying.');
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 64 MB.');
      const added = await importUnifiedLibrary(await file.text());
      setNotice('Imported '+added.calculations+' calculations and '+added.sessions+' runs. Existing records were preserved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  if (!open) return null;
  return <>
    <button className="saved-library-backdrop" aria-label="Close saved library" type="button" onClick={onClose}/>
    <aside ref={dialogRef} className="saved-library-dialog" data-show-detail={showDetail}
      role="dialog" aria-modal="true" aria-labelledby="saved-library-title">
      <div className="saved-library-header">
        <div><span className="saved-library-kicker"><FolderOpen size={13}/> Workspace / Library</span>
          <h2 id="saved-library-title">Saved library</h2>
          <p>{total.toLocaleString()} / {MAX_CALCULATIONS.toLocaleString()} entries · {runs.length.toLocaleString()} tracker runs · {entries.length.toLocaleString()} calculations</p>
        </div>
        <button className="saved-library-icon-button" data-dialog-initial type="button"
          aria-label="Close saved library" onClick={onClose}><X size={17}/></button>
      </div>
      <div className="saved-library-actions">
        <button type="button" className="saved-library-small" onClick={() => {
          void downloadLibrary().then(()=>setNotice('Unified library exported with calculations and tracker sessions.'))
            .catch(e=>setNotice(e instanceof Error?e.message:'Export unavailable in this browser.'));
        }} disabled={!total}><FileDown size={14}/> Export all</button>
        <button type="button" className="saved-library-small" onClick={() => importRef.current?.click()}>
          <FileUp size={14}/> Import</button>
        <input hidden ref={importRef} type="file" tabIndex={-1} accept=".json,application/json"
          aria-label="Import saved library from JSON" onChange={e => void importFile(e.target.files?.[0])}/>
        <span className="saved-library-actions-spacer"/>
        <button type="button" className="saved-library-small" disabled={!entries.length}
          onClick={() => setConfirmClear(value => !value)}><Trash2 size={14}/> Clear calculations</button>
      </div>
      {confirmClear && <div className="saved-library-clear-confirm" role="group" aria-label="Confirm clear library">
        <span>Delete {entries.length} calculations? Tracker runs will remain untouched.</span>
        <button type="button" onClick={() => setConfirmClear(false)}>Cancel</button>
        <button type="button" onClick={() => void clear()}>Delete all</button>
      </div>}
      {(notice || removed.length > 0 || loadError) && <div className="saved-library-feedback" role="status">
        <span>{loadError||notice}</span>{removed.length ? <button type="button" onClick={() => void undo()}><RotateCcw size={13}/> Undo</button> : null}
      </div>}
      <div className="saved-library-body">
        <section className="saved-library-list-pane" aria-label="Saved records">
          <div className="saved-library-filters">
            <label className="saved-library-search"><Search size={15}/>
              <span className="sr-only">Search unified saved library</span>
              <input type="search" placeholder="Search calculations and tracker runs…" value={query} onChange={e=>setQuery(e.target.value)}/>
            </label>
            <div className="saved-library-scope" role="group" aria-label="Record type">
              {(['all','calculations','sessions'] as const).map(value=><button type="button" key={value}
                aria-pressed={scope===value} onClick={()=>{setScope(value);setTool('all');setFavorites(false);setPageSize(160);setSelectedId(null);setSelectedRunId(null);}}>
                {value==='all'?'All records':value==='calculations'?'Calculations':'Tracker runs'}
              </button>)}
            </div>
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
          <div className="saved-library-results-label">{results.length.toLocaleString()} matching records · showing {showing.length.toLocaleString()}</div>
          <ScrollView className="saved-library-list" viewportLabel="Unified saved records">
            {showing.length ? showing.map(item=>item.type==='calculation'
              ?<LibraryRow key={'calc:'+item.id} record={item.record} active={selectedId===item.id}
                onInspect={()=>{setSelectedId(item.id);setSelectedRunId(null);setShowDetail(true);}}
                onFavorite={()=>void update(item.record,{favorite:!item.record.favorite})}/>
              :<div key={'run:'+item.id} className="saved-library-row" data-selected={selectedRunId===item.id}>
                <button type="button" className="saved-library-row-main"
                  onClick={()=>{setSelectedRunId(item.id);setSelectedId(null);setShowDetail(true);}}
                  aria-label={'Inspect tracker run '+item.run.title}>
                  <span className="saved-library-row-icon"><FolderOpen size={15}/></span>
                  <span className="saved-library-row-copy">
                    <strong>{item.run.title}</strong>
                    <span className="saved-library-row-result">{item.run.status} · {item.run.readings.length} measurements</span>
                    <small>Tracker run · {dateLabel(item.run.updatedAt)}</small>
                  </span>
                  <ChevronRight size={15} className="saved-library-row-chevron"/>
                </button>
              </div>) :
              <div className="saved-library-empty">
                <Bookmark size={24} strokeWidth={1.2}/>
                <strong>{total?'No matching records':'Your library is empty'}</strong>
                <p>{total?'Adjust the search or record filters.':'Save a calculation or create a tracker run to begin.'}</p>
                {total?<button type="button" onClick={()=>{setQuery('');setScope('all');setTool('all');setFavorites(false);}}>Reset filters</button>:null}
              </div>}
            {results.length>pageSize&&<button type="button" className="saved-library-more"
              onClick={()=>setPageSize(n=>Math.min(results.length,n+160))}>
              Show 160 more · {results.length-pageSize} remaining
            </button>}
          </ScrollView>
        </section>
        {selected && <Inspector key={selected.id} record={selected}
          onClose={()=>setShowDetail(false)} onUpdate={update} onRemove={remove} message={setNotice}/>}
        {selectedRun&&<div className="saved-library-inspector">
          <div className="saved-library-inspector-toolbar">
            <button type="button" className="saved-library-back"
              onClick={()=>{setSelectedRunId(null);setShowDetail(false);}}><ArrowLeft size={15}/> Library</button>
            <span>Tracker run details</span>
          </div>
          <ScrollView className="saved-library-inspector-scroll" viewportLabel="Tracker run details">
            <div className="saved-library-record-heading">
              <span className="saved-library-kicker">Laboratory run · {selectedRun.status}</span>
              <h3>{selectedRun.title}</h3>
              <span className="saved-library-date"><Clock3 size={12}/> Updated {dateLabel(selectedRun.updatedAt)}</span>
            </div>
            <section className="saved-library-result-panel" aria-label="Run measurements">
              <span>Recorded readings</span>
              <strong>{selectedRun.readings.length.toLocaleString()}</strong>
              <small>Preserved as time-stamped measurements with the saved tracker setup.</small>
              <a className="saved-library-primary" href={trackerLink(selectedRun.id)}>
                <FolderOpen size={15}/> Open in tracker <ArrowUpRight size={14}/>
              </a>
            </section>
            <div className="saved-library-properties">
              <div><span>Status</span><p>{selectedRun.status}</p></div>
              <div><span>Notes</span><p>{selectedRun.notes||'No notes added'}</p></div>
              <div><span>Started</span><p>{selectedRun.startedAt?dateLabel(selectedRun.startedAt):'Not started'}</p></div>
            </div>
            <div className="saved-library-run-actions">
              <button type="button" className="saved-library-small" onClick={()=>exportRun(selectedRun)}>
                <FileDown size={13}/> Export run
              </button>
              <button type="button" className="saved-library-small" onClick={()=>void updateRun(selectedRun.id,'clone')}>
                <Bookmark size={13}/> Copy setup
              </button>
              {selectedRun.status==='completed'
                ?<button type="button" className="saved-library-small" onClick={()=>void updateRun(selectedRun.id,'paused')}>
                  <RotateCcw size={13}/> Reopen
                </button>
                :<button type="button" className="saved-library-small" disabled={!selectedRun.readings.length}
                  onClick={()=>void updateRun(selectedRun.id,'completed')}><Check size={13}/> Complete</button>}
            </div>
            <div className="saved-library-danger">
              <button type="button" className="saved-library-small" onClick={()=>void updateRun(selectedRun.id,'delete')}>
                <Trash2 size={14}/> Delete tracker run
              </button>
            </div>
          </ScrollView>
        </div>}
        {!selected&&!selectedRun && <div className="saved-library-no-selection">
          <Bookmark size={26} strokeWidth={1.2}/>
          <strong>Select a saved record</strong>
          <p>Inspect results, review tracker runs, and reopen the original workspace.</p>
        </div>}
      </div>
      <div className="saved-library-footer"><Heart size={12}/> Stored locally, not synced to an account <span><Download size={12}/> Export a backup</span></div>
    </aside>
  </>;
}
