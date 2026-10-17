import {
  RECORD_LIBRARY_LIMIT, enforceLibraryCapacity, notifyLibraryChange,
  openRecordDatabase,
} from './recordLibrary';
import {
  newTrackerSession, parseTrackerSession,
  type TrackerCollection, type TrackerSession,
} from './trackerSessions';
import {
  decodeTrackerBackup, encodeTrackerArchive, mergeTrackerBackup,
} from './trackerBackup';
import {
  decodeCalculationLibrary, sanitizeSavedCalculation,
  type SavedCalculation,
} from './history';

export type UnifiedSnapshot={
  sessions:TrackerSession[];calculations:SavedCalculation[];
  activeId:string;total:number;
};
const MAX_BACKUP_BYTES=64*1024*1024;
export async function readUnifiedLibrary():Promise<UnifiedSnapshot>{
  const db=await openRecordDatabase();
  try{
    // All record types and the active pointer must represent the same instant.
    // Three separate readonly transactions can otherwise return a backup with
    // a misleading total during a concurrent save in another browser tab.
    return await new Promise<UnifiedSnapshot>((resolve,reject)=>{
      const tx=db.transaction(['sessions','calculations','meta'],'readonly');
      const runs=tx.objectStore('sessions').getAll();
      const calcs=tx.objectStore('calculations').getAll();
      const active=tx.objectStore('meta').get('activeId');
      tx.oncomplete=()=>{
        const sessions=(runs.result as unknown[]).map(parseTrackerSession);
        const calculations=(calcs.result as unknown[]).map(x=>sanitizeSavedCalculation(x));
        if(sessions.some(x=>x===null)||calculations.some(x=>x===null)){
          reject(Error('Unknown saved record format. Existing library was preserved.'));return;
        }
        const validSessions=(sessions as TrackerSession[]).sort((a,b)=>b.updatedAt-a.updatedAt);
        const activeId=typeof active.result?.value==='string'&&validSessions.some(s=>s.id===active.result.value)
          ?active.result.value:validSessions[0]?.id??'';
        resolve({sessions:validSessions,calculations:calculations as SavedCalculation[],activeId,
          total:validSessions.length+calculations.length});
      };
      tx.onerror=()=>reject(tx.error??Error('Unable to read saved library'));
      tx.onabort=()=>reject(tx.error??Error('Library snapshot was aborted'));
    });
  }finally{db.close();}
}

/** Mutate sessions with the same capacity lock as calculation writes. */
export async function mutateUnifiedSessions(
  change:(current:TrackerCollection,calculationCount:number)=>TrackerCollection,
):Promise<TrackerCollection>{
  const db=await openRecordDatabase();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(['sessions','calculations','meta'],'readwrite',{durability:'strict'});
      const store=tx.objectStore('sessions'),all=store.getAll();
      const count=tx.objectStore('calculations').count(),active=tx.objectStore('meta').get('activeId');
      let ready=0,fail:Error|null=null,result:TrackerCollection={activeId:'',sessions:[]};
      const apply=()=>{
        if(++ready!==3)return;
        try{
          const previous=(all.result as unknown[]).map(parseTrackerSession);
          if(previous.some(x=>x===null))throw Error('Unsupported tracker data. Nothing was changed.');
          const sessions=previous as TrackerSession[];
          const activeId=typeof active.result?.value==='string'&&sessions.some(s=>s.id===active.result.value)
            ?active.result.value:sessions[0]?.id??'';
          const next=change({activeId,sessions},count.result);
          enforceLibraryCapacity(next.sessions.length,count.result);
          const oldMap=new Map(sessions.map(s=>[s.id,s]));
          const newIds=new Set<string>();
          for(const item of next.sessions){
            const clean=parseTrackerSession(item);
            if(!clean||newIds.has(clean.id))throw Error('Invalid or duplicated tracker session');
            newIds.add(clean.id);
            if(JSON.stringify(oldMap.get(clean.id))!==JSON.stringify(clean))store.put(clean);
          }
          for(const old of sessions)if(!newIds.has(old.id))store.delete(old.id);
          if(next.activeId && !newIds.has(next.activeId))throw Error('Unknown active run');
          tx.objectStore('meta').put({key:'activeId',value:next.activeId});
          result=next;
        }catch(e){fail=e instanceof Error?e:Error('Could not update sessions');tx.abort();}
      };
      all.onsuccess=apply;count.onsuccess=apply;active.onsuccess=apply;
      tx.oncomplete=()=>{notifyLibraryChange();resolve(result);};
      tx.onerror=()=>reject(fail??tx.error??Error('Could not save sessions'));
      tx.onabort=()=>reject(fail??tx.error??Error('Tracker change aborted'));
    });
  }finally{db.close();}
}

export async function deleteUnifiedRun(id:string) {
  return mutateUnifiedSessions(prev=>{
    const remaining=prev.sessions.filter(s=>s.id!==id);
    if(remaining.length===prev.sessions.length)throw Error('Run no longer exists');
    return {sessions:remaining,activeId:prev.activeId===id?remaining[0]?.id??'':prev.activeId};
  });
}
export async function cloneUnifiedRun(id:string) {
  return mutateUnifiedSessions((prev,calcCount)=>{
    const source=prev.sessions.find(s=>s.id===id);
    if(!source)throw Error('Run no longer exists');
    enforceLibraryCapacity(prev.sessions.length+1,calcCount);
    const clone=newTrackerSession();
    clone.title=('Copy of '+source.title).slice(0,120);
    clone.fields={...source.fields,current:''};
    return {activeId:prev.activeId,sessions:[clone,...prev.sessions]};
  });
}
export async function setUnifiedRunStatus(id:string,status:'completed'|'paused') {
  return mutateUnifiedSessions(prev=>{
    if(!prev.sessions.some(s=>s.id===id))throw Error('Run no longer exists');
    if(status==='completed'&&!prev.sessions.find(s=>s.id===id)?.readings.length)
      throw Error('A run needs at least one reading before completion.');
    const now=Date.now();
    return {...prev,sessions:prev.sessions.map(s=>s.id!==id?s:{
      ...s,status,completedAt:status==='completed'?now:null,updatedAt:Math.max(now,s.updatedAt),
    })};
  });
}
export function encodeUnifiedLibrary(snapshot:UnifiedSnapshot):string{
  return JSON.stringify({
    format:'decarboxulator-unified-library',version:1,
    exportedAt:new Date().toISOString(),calculations:snapshot.calculations,
    sessions:snapshot.sessions,
  });
}
/** All-or-nothing import from unified, legacy tracker or saved-calculation JSON. */
export async function importUnifiedLibrary(raw:string):Promise<{calculations:number;sessions:number}>{
  if(new TextEncoder().encode(raw).byteLength>MAX_BACKUP_BYTES)throw Error('Backup exceeds the 64 MB import limit.');
  let decoded:unknown;
  try{decoded=JSON.parse(raw);}catch{throw Error('The selected file is not valid JSON.');}
  if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))throw Error('Unsupported backup file.');
  const archive=decoded as Record<string,unknown>;
  let calculations:SavedCalculation[]=[],sessions:TrackerSession[]=[];
  if(archive.format==='decarboxulator-unified-library'&&archive.version===1){
    if(!Array.isArray(archive.calculations)||!Array.isArray(archive.sessions)||
      archive.calculations.length+archive.sessions.length>RECORD_LIBRARY_LIMIT)
      throw Error('Invalid unified library record count.');
    const parsed=archive.calculations.map(r=>sanitizeSavedCalculation(r));
    if(parsed.some(r=>r===null))throw Error('Invalid calculation in backup.');
    calculations=parsed as SavedCalculation[];
    const parsedSessions=archive.sessions.map(parseTrackerSession);
    if(parsedSessions.some(r=>r===null))throw Error('Invalid tracker run in backup.');
    sessions=parsedSessions as TrackerSession[];
  }else if(archive.format==='decarboxulator-tracker-archive'||archive.format==='decarboxulator-tracker-session'){
    sessions=decodeTrackerBackup(raw);
  }else{
    calculations=decodeCalculationLibrary(raw);
  }
  const db=await openRecordDatabase();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(['sessions','calculations','meta'],'readwrite',{durability:'strict'});
      const runStore=tx.objectStore('sessions'),calcStore=tx.objectStore('calculations');
      const existingRuns=runStore.getAll(),existingCalcs=calcStore.getAll();
      const active=tx.objectStore('meta').get('activeId');
      let ready=0,failed:Error|null=null;
      let report={calculations:0,sessions:0};
      const apply=()=>{
        if(++ready!==3)return;
        try{
          const existing=(existingRuns.result as unknown[]).map(parseTrackerSession);
          const oldCalcs=(existingCalcs.result as unknown[]).map(x=>sanitizeSavedCalculation(x));
          if(existing.some(x=>x===null)||oldCalcs.some(x=>x===null))
            throw Error('Unrecognized existing data. No records changed.');
          const previous=existing as TrackerSession[],prevCalcs=oldCalcs as SavedCalculation[];
          const activeId=typeof active.result?.value==='string'&&previous.some(s=>s.id===active.result.value)
            ?active.result.value:previous[0]?.id??'';
          const fingerprints=new Set(prevCalcs.map(c=>c.tool+'\u0000'+c.url));
          const calcIds=new Set(prevCalcs.map(c=>c.id));
          const additions:SavedCalculation[]=[];
          for(const source of calculations){
            const key=source.tool+'\u0000'+source.url;
            if(fingerprints.has(key))continue;
            let id=source.id;
            while(calcIds.has(id))id=globalThis.crypto?.randomUUID?.()??'calc-'+Math.random();
            calcIds.add(id);fingerprints.add(key);
            additions.push({...source,id});
          }
           const merged=mergeTrackerBackup({activeId,sessions:previous},sessions,undefined,prevCalcs.length+additions.length);
           enforceLibraryCapacity(previous.length+merged.report.added,prevCalcs.length+additions.length);
          for(const run of merged.collection.sessions.slice(0,merged.report.added))runStore.put(run);
          for(const calc of additions)calcStore.put(calc);
          report={sessions:merged.report.added,calculations:additions.length};
        }catch(e){failed=e instanceof Error?e:Error('Invalid backup');tx.abort();}
      };
      existingRuns.onsuccess=apply;existingCalcs.onsuccess=apply;active.onsuccess=apply;
      tx.oncomplete=()=>{notifyLibraryChange();resolve(report);};
      tx.onerror=()=>reject(failed??tx.error??Error('Import transaction failed'));
      tx.onabort=()=>reject(failed??tx.error??Error('No records imported'));
    });
  }finally{db.close();}
}

export function legacySessionJSON(session:TrackerSession){return encodeTrackerArchive([session]);}
