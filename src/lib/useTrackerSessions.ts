import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canCreateTrackerSession, initializeTrackerCollection, newTrackerSession, LEGACY_TRACKER_KEY,
  openTrackerDatabase, readTrackerCollection, writeTrackerDelta,
  type TrackerCollection, type TrackerFields, type TrackerSession, type TrackerStatus,
} from './trackerSessions';
import type { TrackerReading } from './workspacePayload';
import { decodeTrackerBackup, mergeTrackerBackup } from './trackerBackup';
import { readLibraryCounts } from './recordLibrary';

export type TrackerSaveState = 'loading' | 'saved' | 'saving' | 'error';

/** IndexedDB is authoritative. localStorage is read solely for one-time legacy import. */
export function useTrackerSessions() {
  const [collection,setCollection] = useState<TrackerCollection>({activeId:'',sessions:[]});
  const [ready,setReady] = useState(false);
  const [calculationCount,setCalculationCount] = useState(0);
  const [saveState,setSaveState] = useState<TrackerSaveState>('loading');
  const [error,setError] = useState<string | null>(null);
  const dbRef = useRef<IDBDatabase | null>(null);
  const lastScheduled = useRef<TrackerCollection | null>(null);
  // Reconstruct deltas from transactions actually committed, not queued UI edits.
  const lastCommitted = useRef<TrackerCollection | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const latestCollection = useRef(collection);
  latestCollection.current=collection;
  const saveFailed=useRef(false);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const db = await openTrackerDatabase();
        const legacy = (()=>{try{return localStorage.getItem(LEGACY_TRACKER_KEY);}catch{return null;}})();
        const initial = await initializeTrackerCollection(db,legacy);
        const totals = await readLibraryCounts(db);
        setCalculationCount(totals.calculations);
        if (disposed) { db.close();return; }
        dbRef.current = db;
        lastScheduled.current = initial;
        lastCommitted.current = initial;
        setCollection(initial);
        setReady(true);
        setSaveState('saved');
      } catch (e) {
        if (disposed) return;
        // Remain functional, but never pretend volatile data is autosaved.
        const draft = newTrackerSession();
        const initial={activeId:draft.id,sessions:[draft]};
        lastScheduled.current = initial;
        setCollection(initial);
        setReady(true);
        setError(e instanceof Error?e.message:'Local database is unavailable');
        setSaveState('error');
      }
    })();
    return () => { disposed=true;dbRef.current?.close();dbRef.current=null; };
  },[]);

  useEffect(() => {
    if (!ready || !dbRef.current) return;
    const previous = lastScheduled.current;
    if (!previous) return;
    if (previous===collection) return;
    lastScheduled.current=collection;
    pending.current+=1;
    setSaveState('saving');
    const db=dbRef.current;
    writeQueue.current=writeQueue.current.catch(()=>{}).then(()=>{
      const persisted=lastCommitted.current;
      if (!persisted) throw new Error('Tracker storage has not loaded');
      const previousById=new Map(persisted.sessions.map(s=>[s.id,s]));
      const currentIds=new Set(collection.sessions.map(s=>s.id));
      const changed=collection.sessions.filter(s=>previousById.get(s.id)!==s);
      const removed=persisted.sessions.filter(s=>!currentIds.has(s.id)).map(s=>s.id);
      return (!changed.length&&!removed.length&&persisted.activeId===collection.activeId)
        ? Promise.resolve()
        : writeTrackerDelta(db,changed,removed,collection.activeId,
          new Map(persisted.sessions.map(item=>[item.id,item])));
    }).then(()=>{
      lastCommitted.current=collection;
      saveFailed.current=false;
      pending.current-=1;
      if (!pending.current) {setSaveState('saved');setError(null);}
    }).catch(e=>{
      saveFailed.current=true;
      pending.current-=1;
      setSaveState('error');
      setError(e instanceof Error?e.message:'Could not save the tracker session');
    });
  },[collection,ready]);

  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{
      if (pending.current>0) {
        event.preventDefault();
        event.returnValue='';
      }
    };
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[]);

  useEffect(()=>{
    const update=async()=>{
      const db=dbRef.current;
      if(!db)return;
      try{
        const counts=await readLibraryCounts(db);
        setCalculationCount(counts.calculations);
        if(pending.current||saveFailed.current||lastScheduled.current!==latestCollection.current)return;
        const stored=await readTrackerCollection(db);
        if(pending.current||saveFailed.current||lastScheduled.current!==latestCollection.current)return;
        const committed=lastCommitted.current;
        if(committed && (stored.activeId!==committed.activeId ||
          stored.sessions.length!==committed.sessions.length ||
          stored.sessions.some((item,i)=>item.id!==committed.sessions[i]?.id ||
            item.updatedAt!==committed.sessions[i]?.updatedAt))){
          lastCommitted.current=stored;
          lastScheduled.current=stored;
          setCollection(stored);
        }
      }catch(e){setError(e instanceof Error?e.message:'Unable to refresh the library');}
    };
    window.addEventListener('decarboxulator:library-changed',update);
    let channel:BroadcastChannel|null=null;
    try{channel=new BroadcastChannel('decarboxulator-v4:library');channel.onmessage=()=>void update();}catch{/* unavailable */}
    return ()=>{window.removeEventListener('decarboxulator:library-changed',update);channel?.close();};
  },[]);

  const active = collection.sessions.find(s=>s.id===collection.activeId) ?? null;
  const updateActive = useCallback((patch: Partial<TrackerSession>) => {
    setCollection(prev=>({...prev,sessions:prev.sessions.map(s=>s.id!==prev.activeId?s:{
      ...s,...patch,updatedAt:Date.now(),
    })}));
  },[]);
  const updateFields = useCallback((patch: Partial<TrackerFields>) => {
    setCollection(prev=>({...prev,sessions:prev.sessions.map(s=>s.id!==prev.activeId?s:{
      ...s,fields:{...s.fields,...patch},updatedAt:Date.now(),
    })}));
  },[]);
  const setField = useCallback((key: keyof TrackerFields,value:string) => updateFields({[key]:value}),[updateFields]);
  const newSession = useCallback(() => {
    setCollection(prev=>{
      if (!canCreateTrackerSession(prev.sessions.length,calculationCount)) return prev;
      const s=newTrackerSession();
      const sessions=prev.sessions.map(old=>old.id===prev.activeId && old.status==='running'?
        {...old,status:'paused' as TrackerStatus,updatedAt:Date.now()}:old);
      return {activeId:s.id,sessions:[s,...sessions]};
    });
  },[calculationCount]);
  const selectSession = useCallback((id:string) => {
    setCollection(prev=>{
      if (prev.activeId===id || !prev.sessions.some(s=>s.id===id)) return prev;
      return {activeId:id,sessions:prev.sessions.map(s=>s.id===prev.activeId&&s.status==='running'
        ? {...s,status:'paused' as TrackerStatus,updatedAt:Date.now()}:s)};
    });
  },[]);
  const removeSession = useCallback((id:string) => {
    setCollection(prev=>{
      if (!prev.sessions.some(s=>s.id===id)) return prev;
      const sessions=prev.sessions.filter(s=>s.id!==id);
      if (!sessions.length) {
        const s=newTrackerSession();
        return {activeId:s.id,sessions:[s]};
      }
      return {activeId:prev.activeId===id?sessions[0].id:prev.activeId,sessions};
    });
  },[]);
  const cloneSession = useCallback((id:string) => {
    setCollection(prev=>{
      if (!canCreateTrackerSession(prev.sessions.length,calculationCount)) return prev;
      const source=prev.sessions.find(s=>s.id===id);
      if (!source) return prev;
      const fresh=newTrackerSession();
      fresh.title=`Copy of ${source.title}`.slice(0,120);
      fresh.fields={...source.fields,current:''};
      return {activeId:fresh.id,sessions:[fresh,...prev.sessions.map(s=>s.id===prev.activeId&&s.status==='running'?
        {...s,status:'paused' as TrackerStatus,updatedAt:Date.now()}:s)]};
    });
  },[calculationCount]);
  const start = useCallback(() => {
    setCollection(prev=>({...prev,sessions:prev.sessions.map(s=>s.id!==prev.activeId?s:{
      ...s,status:'running',startedAt:s.startedAt??Date.now(),completedAt:null,updatedAt:Date.now(),
    })}));
  },[]);
  const pause = useCallback(() => updateActive({status:'paused'}),[updateActive]);
  const complete = useCallback(() => updateActive({status:'completed',completedAt:Date.now()}),[updateActive]);
  const reopen = useCallback(() => updateActive({status:'paused',completedAt:null}),[updateActive]);
  const markSessionComplete = useCallback((id:string) => {
    setCollection(prev=>({...prev,sessions:prev.sessions.map(s=>s.id!==id || !s.readings.length ||
      s.status==='completed'?s:{...s,status:'completed',completedAt:Date.now(),updatedAt:Date.now()})}));
  },[]);
  const reopenSession = useCallback((id:string) => {
    setCollection(prev=>({...prev,sessions:prev.sessions.map(s=>s.id!==id || s.status!=='completed'
      ?s:{...s,status:'paused',completedAt:null,updatedAt:Date.now()})}));
  },[]);
  const addReading = useCallback((reading:TrackerReading) => {
    setCollection(prev=>({...prev,sessions:prev.sessions.map(s=>s.id!==prev.activeId?s:{
      ...s,readings:[...s.readings,reading],fields:{...s.fields,current:'',measurementNote:''},
      updatedAt:Date.now(),
    })}));
  },[]);
  const removeReading = useCallback((index:number) => {
    setCollection(prev=>({...prev,sessions:prev.sessions.map(s=>s.id!==prev.activeId?s:{
      ...s,readings:s.readings.filter((_,i)=>i!==index),updatedAt:Date.now(),
    })}));
  },[]);
  const importBackup = useCallback((raw: string) => {
    if (!ready || !dbRef.current) throw new Error('IndexedDB must be available to restore a backup.');
    const imported = decodeTrackerBackup(raw);
    // Validate the entire archive and capacity before committing any in-memory changes.
    const result = mergeTrackerBackup(collection, imported,undefined,calculationCount);
    if (result.report.added) setCollection(result.collection);
    return result.report;
  }, [collection, ready,calculationCount]);

  const retrySave = useCallback(() => {
    const snapshot=collection;
    pending.current+=1;
    setSaveState('saving');
    writeQueue.current=writeQueue.current.catch(()=>{}).then(async()=>{
      let db=dbRef.current;
      if (!db) {
        db=await openTrackerDatabase();
        dbRef.current=db;
        const stored=await readTrackerCollection(db);
        // Reconnect without deleting any sessions that became available later.
        const localIds=new Set(snapshot.sessions.map(s=>s.id));
        const merged:TrackerCollection={activeId:snapshot.activeId,sessions:[
          ...snapshot.sessions,...stored.sessions.filter(s=>!localIds.has(s.id)),
        ]};
        await writeTrackerDelta(db,snapshot.sessions,[],merged.activeId);
        lastCommitted.current=merged;
        lastScheduled.current=merged;
        setCollection(merged);
        return;
      }
      const persisted=lastCommitted.current;
      if (!persisted) throw new Error('Tracker database has not finished loading');
      const oldById=new Map(persisted.sessions.map(s=>[s.id,s]));
      const nextIds=new Set(snapshot.sessions.map(s=>s.id));
      const changed=snapshot.sessions.filter(s=>oldById.get(s.id)!==s);
      const removed=persisted.sessions.filter(s=>!nextIds.has(s.id)).map(s=>s.id);
      await writeTrackerDelta(db,changed,removed,snapshot.activeId,
        new Map(persisted.sessions.map(item=>[item.id,item])));
      lastCommitted.current=snapshot;
    }).then(()=>{
      saveFailed.current=false;
      pending.current-=1;
      if (!pending.current) {setSaveState('saved');setError(null);}
    }).catch(e=>{
      saveFailed.current=true;
      pending.current-=1;setSaveState('error');
      setError(e instanceof Error?e.message:'Could not save tracker sessions');
    });
  },[collection]);

  return {
    active,sessions:collection.sessions,activeId:collection.activeId,ready,saveState,error,calculationCount,
    updateActive,setField,updateFields,newSession,selectSession,removeSession,cloneSession,
    start,pause,complete,reopen,markSessionComplete,reopenSession,addReading,removeReading,retrySave,importBackup,
  };
}