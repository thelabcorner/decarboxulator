import { parseTrackerReadings, validWorkspaceValue, type TrackerReading } from './workspacePayload';

/** Each laboratory run is its own independent, versioned record. */
export const TRACKER_DEFAULTS = {
  unit: 'g', tare: '5', thca: '28', other: '0', current: '',
  trackerMode: 'manual', totalContent: '30', acidPercent: '85',
  otherPercent: '15', autoBalance: 'yes', scaleResolution: '0.01',
  measurementTempC: '', measurementNote: '',
} as const;
export type TrackerFields = { -readonly [K in keyof typeof TRACKER_DEFAULTS]: string };
export type TrackerStatus = 'draft' | 'running' | 'paused' | 'completed';
export interface TrackerSession {
  id: string;
  schemaVersion: 1;
  title: string;
  notes: string;
  status: TrackerStatus;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  fields: TrackerFields;
  readings: TrackerReading[];
}
export interface TrackerCollection { activeId: string; sessions: TrackerSession[] }

const DB_NAME = 'decarboxulator-v4-tracker';
export const LEGACY_TRACKER_KEY = 'decarboxulator-v4:workspace:tracker';
const STATUS: TrackerStatus[] = ['draft', 'running', 'paused', 'completed'];
const MAX_SESSIONS = 500;

export function newTrackerSession(now = Date.now()): TrackerSession {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `run-${now}-${Math.random().toString(36).slice(2)}`,
    schemaVersion: 1, title: `Decarb run · ${new Date(now).toLocaleDateString()}`,
    notes: '', status: 'draft', createdAt: now, updatedAt: now,
    startedAt: null, completedAt: null, fields: {...TRACKER_DEFAULTS}, readings: [],
  };
}

/** Reject corrupt or non-physical imported records before rendering any measurements. */
export function parseTrackerSession(raw: unknown): TrackerSession | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Partial<TrackerSession>;
  if (r.schemaVersion !== 1 || typeof r.id !== 'string' || r.id.length > 120 ||
      !r.id || typeof r.title !== 'string' || r.title.length > 120 ||
      typeof r.notes !== 'string' || r.notes.length > 4000 ||
      !STATUS.includes(r.status as TrackerStatus) ||
      ![r.createdAt,r.updatedAt].every(x => Number.isSafeInteger(x) && x! > 0) ||
      !(r.updatedAt! >= r.createdAt!) ||
      (r.startedAt !== null && (!Number.isSafeInteger(r.startedAt) || r.startedAt! < r.createdAt!)) ||
      (r.completedAt !== null && (!Number.isSafeInteger(r.completedAt) || r.completedAt! < r.createdAt!))) return null;
  if (r.status === 'completed' && !r.completedAt) return null;
  if (r.status !== 'completed' && r.completedAt !== null) return null;
  if (!r.fields || typeof r.fields !== 'object' || Array.isArray(r.fields)) return null;
  const fields = {...TRACKER_DEFAULTS} as TrackerFields;
  for (const key of Object.keys(fields) as (keyof TrackerFields)[]) {
    const value = r.fields[key];
    // New per-reading optional fields preserve v1 archive compatibility.
    if (value === undefined && (key==='measurementTempC'||key==='measurementNote')) continue;
    if (typeof value !== 'string') return null;
    if (key==='measurementNote') {
      if (value.length>300) return null;
      fields[key]=value;
      continue;
    }
    const valid = validWorkspaceValue(key,value,TRACKER_DEFAULTS[key]);
    // Draft numeric inputs can be temporarily empty / incomplete during
    // typing. Rejecting the entire *saved run* on reload would lose readings
    // merely because the user left a measurement input blank or typed "1e".
    const editableNumeric = !['unit','trackerMode','autoBalance'].includes(key);
    const editingValue = editableNumeric && value.length <= 40 && /^[0-9eE.+-]*$/.test(value);
    if (!valid && !editingValue) return null;
    fields[key] = value;
  }
  if (!Array.isArray(r.readings)) return null;
  // IndexedDB's structured-clone format permits cyclic objects; a damaged
  // record must be rejected, not throw from transaction.oncomplete and hang
  // the entire tracker library in its loading state.
  let readings: TrackerReading[] | null;
  try { readings = parseTrackerReadings(JSON.stringify(r.readings)); }
  catch { return null; }
  if (!readings || readings.some((reading,i) =>
    i > 0 && reading.timestamp <= readings[i-1].timestamp ||
    reading.timestamp < (r.startedAt ?? r.createdAt!))) return null;
  return {...r,fields,readings} as TrackerSession;
}

/** Existing v4 localStorage tracker data is imported once, never erased. */
export function migrateLegacyTracker(raw: string | null, now = Date.now()): TrackerSession | null {
  if (!raw) return null;
  let input: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    input = parsed as Record<string, unknown>;
  } catch { return null; }
  const s = newTrackerSession(now);
  for (const key of Object.keys(s.fields) as (keyof TrackerFields)[]) {
    if (key in input && validWorkspaceValue(key,input[key],TRACKER_DEFAULTS[key])) {
      s.fields[key] = input[key] as string;
    }
  }
  const readings = typeof input.readings === 'string' ? parseTrackerReadings(input.readings) : null;
  if (readings && readings.length) {
    const monotone = readings.every((p,i) => !i || p.timestamp > readings[i-1].timestamp);
    if (monotone) {
      s.readings = readings;
      s.createdAt = Math.min(s.createdAt, readings[0].timestamp);
      s.startedAt = readings[0].timestamp;
      s.status = input.tracking === 'yes' ? 'running' : 'paused';
    }
  }
  if (typeof input.startedAt === 'string' && Number.isSafeInteger(Number(input.startedAt)) &&
      Number(input.startedAt) > 0) {
    const t = Number(input.startedAt);
    if (!s.readings.length || t <= s.readings[0].timestamp) {
      s.startedAt = t;
      s.createdAt = Math.min(s.createdAt,t);
      s.status = input.tracking === 'yes' ? 'running' : 'paused';
    }
  }
  s.title = 'Recovered v4 tracker run';
  return s;
}

export function openTrackerDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME,1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions',{keyPath:'id'});
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta',{keyPath:'key'});
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open local database'));
    request.onblocked = () => reject(new Error('Close other tabs using the older tracker database'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function readTrackerCollection(db: IDBDatabase): Promise<TrackerCollection> {
  return new Promise((resolve,reject) => {
    const tx=db.transaction(['sessions','meta'],'readonly');
    const sessionsReq=tx.objectStore('sessions').getAll();
    const activeReq=tx.objectStore('meta').get('activeId');
    tx.oncomplete = () => {
      const parsed=(sessionsReq.result as unknown[]).map(parseTrackerSession);
      if (parsed.some(s=>s===null))
        return reject(new Error('Some tracker records are damaged or use an unsupported schema. No records were modified.'));
      const sessions=(parsed as TrackerSession[]).sort((a,b)=>b.updatedAt-a.updatedAt);
      const activeId = activeReq.result?.value;
      resolve({sessions,activeId: typeof activeId === 'string' && sessions.some(s=>s.id===activeId)
        ? activeId : sessions[0]?.id ?? ''});
    };
    tx.onerror=()=>reject(tx.error ?? new Error('Could not read tracker sessions'));
    tx.onabort=()=>reject(tx.error ?? new Error('Tracker read transaction aborted'));
  });
}

/** Session edits + active pointer commit together: never create a split state. */
export function writeTrackerDelta(
  db: IDBDatabase, changes: TrackerSession[], removed: string[], activeId: string,
): Promise<void> {
  return new Promise((resolve,reject) => {
    let tx: IDBTransaction;
    try {
      tx=db.transaction(['sessions','meta'],'readwrite',{durability:'strict'});
      const store=tx.objectStore('sessions');
      for (const s of changes) store.put(s);
      for (const id of removed) store.delete(id);
      tx.objectStore('meta').put({key:'activeId',value:activeId});
    } catch (e) { reject(e); return; }
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error ?? new Error('Could not save tracker session'));
    tx.onabort=()=>reject(tx.error ?? new Error('Tracker save aborted'));
  });
}

export async function initializeTrackerCollection(db: IDBDatabase, legacy: string | null): Promise<TrackerCollection> {
  // Atomic read-or-create. React StrictMode and two adjacent browser tabs can
  // initialize concurrently; a separate getAll() then put() creates duplicate
  // first drafts. One readwrite transaction serializes the decision with put.
  return new Promise((resolve,reject) => {
    const tx=db.transaction(['sessions','meta'],'readwrite',{durability:'strict'});
    const store=tx.objectStore('sessions');
    const request=store.getAll();
    const activeRequest=tx.objectStore('meta').get('activeId');
    let created: TrackerSession | null = null;
    let invalid=false;
    request.onsuccess=()=>{
      const entries=(request.result as unknown[]).map(parseTrackerSession);
      if(entries.some(s=>s===null)){
        invalid=true;
        tx.abort(); // Never hide or replace unknown records.
        return;
      }
      const existing=entries as TrackerSession[];
      if (!existing.length) {
        created=migrateLegacyTracker(legacy) ?? newTrackerSession();
        store.put(created);
        tx.objectStore('meta').put({key:'activeId',value:created.id});
      }
    };
    tx.oncomplete=()=>{
      if (created) return resolve({activeId:created.id,sessions:[created]});
      const sessions=(request.result as unknown[]).flatMap(item=>{
        const s=parseTrackerSession(item);
        return s?[s]:[];
      }).sort((a,b)=>b.updatedAt-a.updatedAt);
      const activeId=activeRequest.result?.value;
      resolve({activeId:typeof activeId==='string' && sessions.some(s=>s.id===activeId)
        ?activeId:sessions[0]?.id??'',sessions});
    };
    tx.onerror=()=>reject(invalid
      ?new Error('Some tracker records are damaged or use an unsupported schema. Existing records were preserved.')
      :tx.error??new Error('Could not initialize tracker database'));
    tx.onabort=()=>reject(invalid
      ?new Error('Some tracker records are damaged or use an unsupported schema. Existing records were preserved.')
      :tx.error??new Error('Tracker initialization aborted'));
  });
}

/**
 * Diff against the last confirmed IndexedDB commit, never the latest queued UI
 * state. A rejected transaction must not make subsequent edits appear saved.
 */
export function trackerCollectionDelta(previous: TrackerCollection, current: TrackerCollection) {
  const old = new Map(previous.sessions.map(session => [session.id, session]));
  const next = new Set(current.sessions.map(session => session.id));
  return {
    changed: current.sessions.filter(session => old.get(session.id) !== session),
    removed: previous.sessions.filter(session => !next.has(session.id)).map(session => session.id),
    activeId: current.activeId,
  };
}

export function canCreateTrackerSession(length: number) { return length < MAX_SESSIONS; }