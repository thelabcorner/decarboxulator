import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Archive, Check, Copy, Download, FolderOpen, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { ScrollView } from './ScrollView';
import type { TrackerSession } from '../lib/trackerSessions';
import { encodeTrackerArchive, encodeTrackerSession, TRACKER_BACKUP_MAX_BYTES, type TrackerImportReport } from '../lib/trackerBackup';
import { trackerConfigFromPercent, validatedTrackerConfig, restoreTrackerPoints, trackerRawCSV } from '../lib/trackerAnalytics';
import { trackerSetup, formatNumber } from '../lib/decarb';
import { isAcidCannabinoid } from '../lib/cannabinoids';
import './TrackerSessions.css';

function downloadFile(filename:string,body:string,mime:string) {
  const url=URL.createObjectURL(new Blob([body],{type:mime}));
  const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function getProgress(s:TrackerSession) {
  const f=s.fields;
  const t=Number(f.tare),a=Number(f.thca),o=Number(f.other);
  const cannabinoid=isAcidCannabinoid(f.cannabinoid)?f.cannabinoid:'THCa';
  const cfg=f.trackerMode==='percentage'
    ? trackerConfigFromPercent(t,Number(f.totalContent),Number(f.acidPercent),Number(f.otherPercent),cannabinoid)
    : validatedTrackerConfig({tareG:t,thcaG:a,otherG:o,cannabinoid});
  if (!cfg) return null;
  const points=restoreTrackerPoints(s.readings,cfg);
  return {points,cfg,expected:trackerSetup(cfg).expectedCo2LossG};
}
function exportSession(s:TrackerSession,format:'json'|'csv') {
  const safe=s.title.replace(/[^a-z0-9-]+/gi,'-').replace(/^-|-$/g,'').slice(0,45)||'decarb-run';
  if (format==='json') {
    downloadFile(`${safe}.json`,encodeTrackerSession(s),'application/json;charset=utf-8');
  } else {
    downloadFile(`${safe}.csv`,trackerRawCSV(s.readings,getProgress(s)?.cfg??null),'text/csv;charset=utf-8');
  }
}

interface Props {
  sessions:TrackerSession[];
  activeId:string;
  onClose:()=>void;
  onOpen:(id:string)=>void;
  onClone:(id:string)=>void;
  onDelete:(id:string)=>void;
  onComplete:(id:string)=>void;
  onReopen:(id:string)=>void;
  onImport:(raw:string)=>TrackerImportReport;
  saveState:'loading'|'saved'|'saving'|'error';
}
export function TrackerSessionLibrary({sessions,activeId,onClose,onOpen,onClone,onDelete,onComplete,onReopen,onImport,saveState}:Props) {
  const [filter,setFilter]=useState<'all'|'open'|'completed'>('all');
  const [query,setQuery]=useState('');
  const [importing,setImporting]=useState(false);
  const [feedback,setFeedback]=useState<{error:boolean;message:string}|null>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  function exportRuns(records:TrackerSession[],filename:string) {
    const json=encodeTrackerArchive(records);
    const bytes=new Blob([json],{type:'application/json;charset=utf-8'}).size;
    if(bytes>TRACKER_BACKUP_MAX_BYTES){
      setFeedback({error:true,message:`This ${(bytes/1024/1024).toFixed(1)} MB backup exceeds the 16 MB import limit. Filter runs by status or batch name and use Export shown to save smaller restorable archives. Nothing was downloaded.`});
      return;
    }
    downloadFile(filename,json,'application/json;charset=utf-8');
    setFeedback({error:false,message:`${records.length} run${records.length===1?'':'s'} exported to a restorable JSON archive. Keep the file outside this browser.`});
  }
  function exportAll(){exportRuns(sessions,'decarboxulator-tracker-backup.json');}
  async function importFile(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];
    event.target.value=''; // Permit choosing the same file again after fixing an error.
    if (!file) return;
    setFeedback(null);
    if (file.size>TRACKER_BACKUP_MAX_BYTES) {
      setFeedback({error:true,message:'Backup exceeds the 16 MB safety limit.'});
      return;
    }
    setImporting(true);
    try {
      const result=onImport(await file.text());
      setFeedback({error:false,message:result.added
        ? `${result.added} run${result.added===1?'':'s'} restored. ${result.skipped?`${result.skipped} duplicate${result.skipped===1?'':'s'} skipped. `:''}Autosave in progress.`
        : `Nothing changed: ${result.skipped} existing run${result.skipped===1?'':'s'} already present.`});
    } catch (error) {
      setFeedback({error:true,message:error instanceof Error?error.message:'Could not import tracker backup.'});
    } finally { setImporting(false); }
  }
  const closeRef=useRef<HTMLButtonElement>(null);
  const onCloseRef=useRef(onClose);
  const dialogRef=useRef<HTMLElement>(null);
  useEffect(()=>{onCloseRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    closeRef.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.stopPropagation();onCloseRef.current();}
      if(e.key==='Tab'){
        const dialog=dialogRef.current;
        if(!dialog)return;
        const focusable=[...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])',
        )].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
        if(!focusable.length){e.preventDefault();dialog.focus();return;}
        const first=focusable[0],last=focusable.at(-1)!;
        if(!dialog.contains(document.activeElement) || e.shiftKey&&document.activeElement===first){
          e.preventDefault();(e.shiftKey?last:first).focus();
        }else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key,true);
    return ()=>{document.removeEventListener('keydown',key,true);previouslyFocused?.focus();};
  },[]);
  const visible=useMemo(()=>sessions.filter(s=>{
    if(filter==='completed'&&s.status!=='completed')return false;
    if(filter==='open'&&s.status==='completed')return false;
    return (s.title+' '+s.notes).toLocaleLowerCase().includes(query.toLocaleLowerCase());
  }).sort((a,b)=>b.updatedAt-a.updatedAt),[sessions,filter,query]);
  const completedCount=sessions.filter(s=>s.status==='completed').length;
  return <>
    <button type="button" aria-label="Close tracker session library" className="tracker-library-scrim" onClick={onClose}/>
    <section ref={dialogRef} className="tracker-library" role="dialog" aria-modal="true" aria-labelledby="tracker-library-title" tabIndex={-1}>
      <header className="tracker-library-header">
        <div><span className="tracker-overline"><Archive size={13}/> ON-DEVICE LAB RECORDS</span>
          <h2 id="tracker-library-title">Tracker sessions</h2>
          <p>{sessions.length} sessions · {completedCount} completed · saved to this browser's IndexedDB</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className="tracker-icon-control" aria-label="Close sessions"><X size={18}/></button>
      </header>
      <div className="tracker-library-filters">
        <label className="tracker-library-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)}
          placeholder="Find a run by name or note" aria-label="Search tracker sessions"/></label>
        <div className="tracker-library-filter-buttons" aria-label="Filter tracker sessions">
          {(['all','open','completed'] as const).map(key=><button type="button" key={key} aria-pressed={filter===key}
            onClick={()=>setFilter(key)}>{key==='all'?'All':key==='open'?'Open':'Completed'}</button>)}
        </div>
      </div>
      <div className="tracker-library-archive-toolbar">
        <span>PORTABLE BACKUP</span>
        <div className="tracker-library-archive-actions">
          <input ref={fileRef} type="file" accept=".json,application/json" className="tracker-library-file-input"
            onChange={event=>void importFile(event)} aria-label="Choose tracker backup JSON"/>
          <button type="button" className="tracker-mini-button" disabled={importing}
            onClick={()=>fileRef.current?.click()}><FolderOpen size={13}/>{importing?'Importing…':'Import JSON'}</button>
          {visible.length>0&&visible.length<sessions.length&&
            <button type="button" className="tracker-mini-button"
              onClick={()=>exportRuns(visible,'decarboxulator-tracker-selection.json')}>
              <Download size={13}/> Export shown ({visible.length})</button>}
          <button type="button" className="tracker-mini-button" onClick={exportAll}
            disabled={!sessions.length}><Download size={13}/> Export all ({sessions.length})</button>
        </div>
      </div>
      {feedback&&<div className="tracker-library-feedback" data-error={feedback.error}
        role={feedback.error?'alert':'status'}>
        {feedback.error?feedback.message:saveState==='error'
          ? 'Import is in memory but could not be saved to IndexedDB. Keep this page open and export a backup.'
          :saveState==='saved'?feedback.message.replace('Autosave in progress.','Saved on this device.')
          :feedback.message}
      </div>}
      <ScrollView className="tracker-library-scroll" viewportLabel="Tracker session list">
        {visible.length?visible.map(s=>{
          const progress=getProgress(s),last=progress?.points.at(-1);
          return <article className="tracker-session-row" key={s.id} data-current={s.id===activeId}>
            <div className="tracker-session-row-main">
              <span className="tracker-session-row-title">{s.title}
                {s.id===activeId&&<span className="tracker-mini-tag">CURRENT</span>}</span>
              <span className="tracker-session-row-sub">
                <span className="tracker-mini-tag">{s.status.toUpperCase()}</span>
                <span>{new Date(s.updatedAt).toLocaleString()}</span>
                <span>{s.readings.length} readings</span>
              </span>
              <span className="tracker-session-row-result">{last
                ? `${formatNumber(last.snapshot.completion,2)}% apparent · ${formatNumber(last.weightG,3)} g last mass`
                : 'No measurements recorded'}{s.notes?' · '+s.notes.slice(0,60):''}</span>
            </div>
            <div className="tracker-session-row-actions">
              <button type="button" className="tracker-mini-button tracker-mini-button-primary" onClick={()=>onOpen(s.id)}>
                <FolderOpen size={13}/> Review</button>
              {s.status==='completed'
                ? <button type="button" className="tracker-mini-button" onClick={()=>onReopen(s.id)}><RotateCcw size={13}/> Reopen</button>
                : <button type="button" className="tracker-mini-button" disabled={!s.readings.length}
                    onClick={()=>onComplete(s.id)}><Check size={13}/> Complete</button>}
              <button type="button" className="tracker-mini-button" onClick={()=>exportSession(s,'csv')} disabled={!s.readings.length}
                title="Export measurements to CSV"><Download size={13}/> CSV</button>
              <button type="button" className="tracker-mini-button" onClick={()=>exportSession(s,'json')}
                title="Download a full portable session backup"><Download size={13}/> JSON</button>
              <button type="button" className="tracker-mini-button" onClick={()=>onClone(s.id)} title="Create a new run with the same setup">
                <Copy size={13}/> Copy setup</button>
              <button type="button" className="tracker-mini-button tracker-mini-danger" title="Delete session" aria-label={`Delete ${s.title}`}
                onClick={()=>{if(window.confirm(`Permanently delete "${s.title}" and its ${s.readings.length} measurements from this device? Export a JSON backup first if needed.`))onDelete(s.id);}}>
                <Trash2 size={13}/></button>
            </div>
          </article>;
        }):<div className="tracker-library-empty">No sessions match the current filter.</div>}
      </ScrollView>
      <footer className="tracker-library-footer">Stored in this device's IndexedDB. Use Export all before clearing browser data, and Import JSON to restore a backup on another device. Restores never overwrite existing runs.</footer>
    </section>
  </>;
}