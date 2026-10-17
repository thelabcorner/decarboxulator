/**
 * Shared on-device record store. V2 upgrades the existing tracker IndexedDB
 * in place rather than copying or deleting any saved laboratory observations.
 *
 * Every count / capacity check happens inside the same readwrite transaction.
 * Two browser tabs cannot independently pass a stale count and exceed the cap.
 */
export const RECORD_LIBRARY_LIMIT = 25565;
export const RECORD_DB_NAME = 'decarboxulator-v4-tracker';
export const RECORD_DB_VERSION = 2;

export function openRecordDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in globalThis)){reject(new Error('IndexedDB unavailable'));return;}
    const request=indexedDB.open(RECORD_DB_NAME,RECORD_DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('sessions'))db.createObjectStore('sessions',{keyPath:'id'});
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      if(!db.objectStoreNames.contains('calculations'))db.createObjectStore('calculations',{keyPath:'id'});
    };
    request.onerror=()=>reject(request.error??new Error('Could not open record library'));
    request.onblocked=()=>reject(new Error('Close older Decarboxulator tabs to upgrade the library.'));
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>db.close();
      resolve(db);
    };
  });
}
export type RecordCounts={sessions:number;calculations:number;total:number;remaining:number};
export function libraryCounts(sessions:number,calculations:number):RecordCounts {
  const total=sessions+calculations;
  return {sessions,calculations,total,remaining:Math.max(0,RECORD_LIBRARY_LIMIT-total)};
}
export function readLibraryCounts(db:IDBDatabase):Promise<RecordCounts>{
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['sessions','calculations'],'readonly');
    const a=tx.objectStore('sessions').count(),b=tx.objectStore('calculations').count();
    tx.oncomplete=()=>resolve(libraryCounts(a.result,b.result));
    tx.onerror=()=>reject(tx.error??new Error('Could not count saved records'));
    tx.onabort=()=>reject(tx.error??new Error('Record count aborted'));
  });
}

/** Transactional calculation storage. Existing v1 tracker sessions remain unchanged. */
export async function initializeCalculationRecords<T extends {id:string}>(
  db:IDBDatabase, legacy:readonly T[], validate:(record:unknown)=>T|null,
):Promise<T[]> {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['sessions','calculations','meta'],'readwrite',{durability:'strict'});
    const store=tx.objectStore('calculations'),meta=tx.objectStore('meta');
    const records=store.getAll(),marker=meta.get('calculationMigrationV2');
    const sessionCount=tx.objectStore('sessions').count();
    let result:T[]=[];
    let failure:Error|null=null;
    // Requests are started together. The callbacks execute before transaction
    // completion, permitting the migration to be committed atomically.
    let requestsReady=0;
    const finishMigration=()=>{
      if(++requestsReady!==3)return;
      {
          const parsed=(records.result as unknown[]).map(validate);
          if(parsed.some(x=>x===null)){
            failure=new Error('The calculation library contains invalid records. Nothing was overwritten.');
            tx.abort();return;
          }
          result=parsed as T[];
          if(marker.result)return;
          const ids=new Set(result.map(r=>r.id));
          for(const source of legacy){
            const clean=validate(source);
            if(!clean){failure=new Error('Legacy saved calculations could not be validated.');tx.abort();return;}
            if(ids.has(clean.id))continue;
            if(sessionCount.result+result.length+1>RECORD_LIBRARY_LIMIT){
              failure=new Error('The shared library has insufficient space to migrate existing calculations.');
              tx.abort();return;
            }
            store.put(clean);result.push(clean);ids.add(clean.id);
          }
          meta.put({key:'calculationMigrationV2',value:true});
      }
    };
    marker.onsuccess=finishMigration;
    records.onsuccess=finishMigration;
    sessionCount.onsuccess=finishMigration;
    tx.oncomplete=()=>{if(legacy.length)notifyLibraryChange();resolve(result);};
    tx.onerror=()=>reject(failure??tx.error??new Error('Could not initialize calculation records'));
    tx.onabort=()=>reject(failure??tx.error??new Error('Calculation migration was aborted'));
  });
}
export function readCalculationRecords<T>(
  db:IDBDatabase,validate:(raw:unknown)=>T|null,
):Promise<T[]> {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('calculations','readonly');
    const get=tx.objectStore('calculations').getAll();
    tx.oncomplete=()=>{
      const parsed=(get.result as unknown[]).map(validate);
      if(parsed.some(x=>x===null)){reject(new Error('Unsupported saved calculation record. Existing storage preserved.'));return;}
      resolve(parsed as T[]);
    };
    tx.onerror=()=>reject(tx.error??new Error('Unable to read calculations'));
    tx.onabort=()=>reject(tx.error??new Error('Calculation read aborted'));
  });
}
export function mutateCalculationRecords<T extends {id:string}>(
  db:IDBDatabase,validate:(raw:unknown)=>T|null,
  transform:(current:readonly T[])=>readonly T[],
):Promise<T[]> {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['sessions','calculations'],'readwrite',{durability:'strict'});
    const store=tx.objectStore('calculations'),all=store.getAll();
    const sessionCount=tx.objectStore('sessions').count();
    let result:T[]=[];
    let failure:Error|null=null;
    // Each mutation reads the authoritative database and runs after competing
    // transactions, including writes from another browser tab.
    let ready=0;
    const calculate=()=>{
      if(++ready!==2)return;
        try{
          const old=(all.result as unknown[]).map(validate);
          if(old.some(x=>x===null))throw Error('Unknown calculation data. No records were changed.');
          const next=transform(old as T[]);
          enforceLibraryCapacity(sessionCount.result,next.length);
          const oldMap=new Map((old as T[]).map(item=>[item.id,item]));
          const nextIds=new Set<string>();
          for(const item of next){
            const clean=validate(item);
            if(!clean)throw Error('Invalid calculation update');
            if(nextIds.has(clean.id))throw Error('Duplicate calculation record identifier');
            nextIds.add(clean.id);
            if(JSON.stringify(oldMap.get(clean.id))!==JSON.stringify(clean))store.put(clean);
          }
          for(const oldRecord of old as T[])if(!nextIds.has(oldRecord.id))store.delete(oldRecord.id);
          result=[...next];
        }catch(error){failure=error instanceof Error?error:new Error('Unable to update calculation records');tx.abort();}
    };
    all.onsuccess=calculate;
    sessionCount.onsuccess=calculate;
    tx.oncomplete=()=>{notifyLibraryChange();resolve(result);};
    tx.onerror=()=>reject(failure??tx.error??new Error('Calculation transaction failed'));
    tx.onabort=()=>reject(failure??tx.error??new Error('Calculation transaction aborted'));
  });
}

export function enforceLibraryCapacity(sessions:number,calculations:number) {
  if(sessions+calculations>RECORD_LIBRARY_LIMIT)
    throw new Error('The shared 25,565-entry library limit would be exceeded. No records were changed.');
}
/** Broadcast only after a transaction has committed. */
export function notifyLibraryChange() {
  if(typeof window!=='undefined'){
    window.dispatchEvent(new Event('decarboxulator:library-changed'));
    try{const bc=new BroadcastChannel('decarboxulator-v4:library');
      bc.postMessage('changed');bc.close();}catch{/* BroadcastChannel may be unavailable. */}
  }
}
