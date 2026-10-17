import {beforeEach,describe,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {
  RECORD_DB_NAME,RECORD_LIBRARY_LIMIT,libraryCounts,
  openRecordDatabase,readLibraryCounts,initializeCalculationRecords,
  mutateCalculationRecords,readCalculationRecords,
} from '../src/lib/recordLibrary';
import {
  newTrackerSession,initializeTrackerCollection,readTrackerCollection,
  writeTrackerDelta,
} from '../src/lib/trackerSessions';
import {sanitizeSavedCalculation,type SavedCalculation} from '../src/lib/history';
import {deleteUnifiedRun,importUnifiedLibrary,readUnifiedLibrary} from '../src/lib/unifiedLibrary';
const origin='https://example.com';
const t=1790000000000;
const calculation=(id:string):SavedCalculation=>({
  id,tool:'Conversion '+id,result:'0.5 g',url:'/tools/batch-yield?key='+id,
  name:'Result '+id,note:'',tags:[],favorite:false,savedAt:t,updatedAt:t,
});
const parse=(raw:unknown)=>sanitizeSavedCalculation(raw);
beforeEach(()=>{
  vi.stubGlobal('indexedDB',new IDBFactory());
  const target=new EventTarget();
  vi.stubGlobal('window',{location:{origin},
    dispatchEvent:target.dispatchEvent.bind(target),
    addEventListener:target.addEventListener.bind(target),
    removeEventListener:target.removeEventListener.bind(target)});
  vi.stubGlobal('localStorage',{getItem:()=>null});
});
describe('unified IndexedDB record library',()=>{
  it('upgrades an existing V1 tracker database without losing sessions or readings',async()=>{
    const old=await new Promise<IDBDatabase>((resolve,reject)=>{
      const req=indexedDB.open(RECORD_DB_NAME,1);
      req.onupgradeneeded=()=>{
        req.result.createObjectStore('sessions',{keyPath:'id'});
        req.result.createObjectStore('meta',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    const s=newTrackerSession(t);
    s.readings=[{weightG:31.2,timestamp:t+5}];
    await new Promise<void>((resolve,reject)=>{
      const tx=old.transaction(['sessions','meta'],'readwrite');
      tx.objectStore('sessions').put(s);
      tx.objectStore('meta').put({key:'activeId',value:s.id});
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
    old.close();
    const db=await openRecordDatabase();
    expect(db.version).toBe(2);
    expect([...db.objectStoreNames]).toContain('calculations');
    const restored=await readTrackerCollection(db);
    expect(restored.sessions).toHaveLength(1);
    expect(restored.sessions[0].readings).toEqual(s.readings);
    expect(restored.activeId).toBe(s.id);
    expect(await initializeCalculationRecords(db,[calculation('a')],parse)).toHaveLength(1);
    expect(await initializeCalculationRecords(db,[calculation('b')],parse)).toHaveLength(1);
    expect((await readCalculationRecords(db,parse))[0].id).toBe('a');
    expect(await readLibraryCounts(db)).toMatchObject({total:2,sessions:1,calculations:1});
    db.close();
  });
  it('rejects stale tracker writes from another tab without overwriting later readings',async()=>{
    const db=await openRecordDatabase();
    const created=await initializeTrackerCollection(db,null);
    const old=created.sessions[0];
    const newer={...old,notes:'New measurement from the second tab',updatedAt:old.updatedAt+1,
      readings:[{weightG:31.5,timestamp:old.createdAt+10}]};
    await writeTrackerDelta(db,[newer],[],old.id,new Map([[old.id,old]]));
    const stale={...old,notes:'Stale first-tab edit',updatedAt:old.updatedAt+2};
    await expect(writeTrackerDelta(db,[stale],[],old.id,new Map([[old.id,old]])))
      .rejects.toThrow(/another tab/);
    const current=await readTrackerCollection(db);
    expect(current.sessions[0].notes).toBe('New measurement from the second tab');
    expect(current.sessions[0].readings).toEqual(newer.readings);
    db.close();
  });
  it('shares capacity across tracker and calculation transactions',async()=>{
    const db=await openRecordDatabase();
    const original=await initializeTrackerCollection(db,null);
    expect(original.sessions).toHaveLength(1);
    const count=RECORD_LIBRARY_LIMIT-1;
    expect(libraryCounts(1,count).remaining).toBe(0);
    const values=Array.from({length:count},(_,i)=>calculation('id-'+i));
    const migrated=await initializeCalculationRecords(db,values,parse);
    expect(migrated).toHaveLength(count);
    expect((await readLibraryCounts(db)).total).toBe(RECORD_LIBRARY_LIMIT);
    await expect(mutateCalculationRecords(db,parse,items=>[calculation('one-too-many'),...items]))
      .rejects.toThrow(/25,565/);
    await expect(writeTrackerDelta(db,[newTrackerSession(t+99)],[],original.activeId))
      .rejects.toThrow(/25,565/);
    expect((await readLibraryCounts(db)).total).toBe(RECORD_LIBRARY_LIMIT);
    expect((await readTrackerCollection(db)).sessions).toHaveLength(1);
    await mutateCalculationRecords(db,parse,items=>items.filter(item=>item.id!=='id-0'));
    expect((await readLibraryCounts(db)).remaining).toBe(1);
    await writeTrackerDelta(db,[newTrackerSession(t+99)],[],original.activeId);
    expect((await readLibraryCounts(db)).remaining).toBe(0);
    db.close();
  },60000);
  it('imports both record types, ignores reimport duplicates, and deletes only selected run',async()=>{
    const db=await openRecordDatabase();
    const tracker=await initializeTrackerCollection(db,null);
    await initializeCalculationRecords(db,[],parse);
    db.close();
    const next=newTrackerSession(t+100);
    next.title='Backup Run';
    const raw=JSON.stringify({format:'decarboxulator-unified-library',version:1,
      calculations:[calculation('source')],sessions:[next]});
    expect(await importUnifiedLibrary(raw)).toEqual({calculations:1,sessions:1});
    expect(await importUnifiedLibrary(raw)).toEqual({calculations:0,sessions:0});
    const before=await readUnifiedLibrary();
    expect(before.total).toBe(3);
    await deleteUnifiedRun(next.id);
    const after=await readUnifiedLibrary();
    expect(after.total).toBe(2);
    expect(after.sessions.map(s=>s.id)).toEqual([tracker.activeId]);
    expect(after.calculations.map(c=>c.id)).toEqual(['source']);
  });
});
