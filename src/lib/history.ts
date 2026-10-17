import { useSyncExternalStore } from 'react';
import {
  RECORD_LIBRARY_LIMIT, openRecordDatabase, initializeCalculationRecords,
  mutateCalculationRecords, readCalculationRecords, type RecordCounts, readLibraryCounts,
} from './recordLibrary';

/** Local, user-owned calculation library. Never stores external or executable URLs. */
export interface SavedCalculation {
  id: string;
  tool: string;
  result: string;
  url: string;
  savedAt: number;
  updatedAt: number;
  name: string;
  note: string;
  favorite: boolean;
  tags: string[];
}
export type CalculationPatch = Partial<Pick<SavedCalculation, 'name' | 'note' | 'favorite' | 'tags'>>;
export type CalculationSort = 'recent' | 'oldest' | 'name' | 'tool';

const KEY = 'decarboxulator-v4:saved-calculations';
const LEGACY_KEY = 'decarboxulator-v4:history';
const VERSION = 2;
export const MAX_CALCULATIONS = RECORD_LIBRARY_LIMIT;
const EMPTY: readonly SavedCalculation[] = Object.freeze([]);
const listeners = new Set<() => void>();
let snapshot: readonly SavedCalculation[] = EMPTY;
let initialization: Promise<IDBDatabase> | null = null;
let channel: BroadcastChannel | null = null;
let listening = false;
let lastError: string | null = null;

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function boundedText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function validTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 9999999999999;
}
export function sanitizeCalculationUrl(raw: string, origin: string): string | null {
  if (raw.length > 8192 || !/^https?:\/\//i.test(origin)) return null;
  try {
    const parsed = new URL(raw, origin);
    if (parsed.origin !== origin || parsed.username || parsed.password || parsed.hash) return null;
    const decoded = decodeURIComponent(parsed.pathname);
    const route=decoded.replace(/^\/(?:decarboxulator|decarboxulator-v4-pr3-preview)(?=\/|$)/i,'');
    if (!/^\/(?:tools\/[a-z0-9-]+\/?|)$/i.test(route)) return null;
    if (decoded.includes('..') || decoded.includes('\\')) return null;
    return parsed.pathname + parsed.search;
  } catch { return null; }
}
function originForValidation() {
  return typeof window === 'undefined' ? 'https://decarboxulator.local' : window.location.origin;
}
function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => tag.trim().slice(0, 28))
    .filter(Boolean))].slice(0, 10);
}
export function sanitizeSavedCalculation(value: unknown, origin = originForValidation()): SavedCalculation | null {
  if (!plainRecord(value)) return null;
  if (typeof value.url !== 'string') return null;
  const url = sanitizeCalculationUrl(value.url, origin);
  if (!url || !validTime(value.savedAt)) return null;
  const tool = boundedText(value.tool, 90);
  const result = boundedText(value.result, 240);
  const id = boundedText(value.id, 96);
  if (!tool || !result || !id) return null;
  return {
    id, tool, result, url, savedAt: value.savedAt,
    updatedAt: validTime(value.updatedAt) ? value.updatedAt : value.savedAt,
    name: boundedText(value.name, 100) || tool,
    note: boundedText(value.note, 1500),
    favorite: value.favorite === true,
    tags: cleanTags(value.tags),
  };
}

function uniqueSorted(values: readonly SavedCalculation[]) {
  const knownId=new Set<string>(),knownFingerprint=new Set<string>();
  const records:SavedCalculation[]=[];
  for(const record of [...values].sort((a,b)=>b.updatedAt-a.updatedAt)){
    const fingerprint=record.tool+'\\u0000'+record.url;
    if(knownId.has(record.id)||knownFingerprint.has(fingerprint))continue;
    knownId.add(record.id);knownFingerprint.add(fingerprint);records.push(record);
  }
  return records;
}
export function decodeCalculationLibrary(raw:string, origin=originForValidation()):SavedCalculation[]{
  const decoded:unknown=JSON.parse(raw);
  const records=Array.isArray(decoded)?decoded:
    plainRecord(decoded)&&decoded.version===VERSION&&Array.isArray(decoded.entries)?decoded.entries:null;
  if(!records||records.length>RECORD_LIBRARY_LIMIT)
    throw Error('Not a supported Decarboxulator calculation library or it exceeds the 25,565-entry limit.');
  const items=records.map(item=>sanitizeSavedCalculation(item,origin));
  if(items.some(item=>item===null))throw Error('The file contains invalid or unsafe calculation records.');
  return uniqueSorted(items as SavedCalculation[]);
}
export function encodeCalculationLibrary(records:readonly SavedCalculation[]){
  return JSON.stringify({
    format:'decarboxulator-calculations',version:VERSION,
    exportedAt:new Date().toISOString(),entries:records,
  },null,2);
}
function legacyRecords():SavedCalculation[]{
  // Read once; never delete the original localStorage snapshots. A migration
  // marker in the IndexedDB transaction prevents re-import after later clears.
  const saved=localStorage.getItem(KEY);
  if(saved!==null)return decodeCalculationLibrary(saved);
  const previous=localStorage.getItem(LEGACY_KEY);
  return previous?decodeCalculationLibrary(previous):[];
}
function publish(records:readonly SavedCalculation[]){
  snapshot=uniqueSorted(records);
  listeners.forEach(listener=>listener());
}
async function refresh(db:IDBDatabase){
  const records=await readCalculationRecords(db,(raw)=>sanitizeSavedCalculation(raw));
  publish(records);
}
function subscribe(listener:()=>void){
  listeners.add(listener);
  if(!listening&&typeof window!=='undefined'){
    listening=true;
    window.addEventListener('decarboxulator:library-changed',onChanged);
    try{
      channel=new BroadcastChannel('decarboxulator-v4:library');
      channel.onmessage=()=>onChanged();
    }catch{/* unsupported in private browsing */}
  }
  if(typeof window!=='undefined')void ensureReady().catch(()=>{});
  return ()=>{
    listeners.delete(listener);
    if(!listeners.size&&listening){
      listening=false;window.removeEventListener('decarboxulator:library-changed',onChanged);
      channel?.close();channel=null;
    }
  };
}
function onChanged(){ if(initialization)void initialization.then(refresh).catch(()=>{}); }
function ensureReady():Promise<IDBDatabase>{
  if(typeof window==='undefined')return Promise.reject(Error('Browser database unavailable'));
  if(!initialization){
    initialization=(async()=>{
      const db=await openRecordDatabase();
      try {
        const values=await initializeCalculationRecords(db,legacyRecords(),(raw)=>sanitizeSavedCalculation(raw));
        publish(values);
        lastError=null;
        return db;
      }catch(e){
        db.close();lastError=e instanceof Error?e.message:String(e);
        throw e;
      }
    })();
  }
  return initialization;
}
export function useCalculationHistory():readonly SavedCalculation[]{
  return useSyncExternalStore(subscribe,()=>snapshot,()=>EMPTY);
}
export function calculationLibraryError(){return lastError;}
export async function calculationLibraryCounts():Promise<RecordCounts>{
  return readLibraryCounts(await ensureReady());
}
async function mutate(transform:(current:readonly SavedCalculation[])=>readonly SavedCalculation[]):Promise<boolean>{
  try{
    const db=await ensureReady();
    const result=await mutateCalculationRecords(db,(raw)=>sanitizeSavedCalculation(raw),transform);
    publish(result);lastError=null;return true;
  }catch(e){
    lastError=e instanceof Error?e.message:String(e);
    return false;
  }
}
function newID(){
  return globalThis.crypto?.randomUUID?.()??'calc-'+Date.now()+'-'+Math.random().toString(36).slice(2);
}
export async function saveCalculation(tool:string,result:string,sharedUrl:string):Promise<boolean>{
  if(typeof window==='undefined')return false;
  const url=sanitizeCalculationUrl(sharedUrl,window.location.origin);
  const name=boundedText(tool,90),output=boundedText(result,240);
  if(!url||!name||!output)return false;
  return mutate(existing=>{
    const prior=existing.find(item=>item.tool===name&&item.url===url);
    const now=Date.now();
    if(prior)return existing.map(item=>item.id===prior.id?{...item,result:output,updatedAt:now}:item);
    if(existing.length>=RECORD_LIBRARY_LIMIT)throw Error('The shared library is full.');
    return [{id:newID(),tool:name,result:output,url,name,note:'',tags:[],
      favorite:false,savedAt:now,updatedAt:now},...existing];
  });
}
export function isCalculationSaved(tool:string,sharedUrl:string,entries:readonly SavedCalculation[]){
  const url=sanitizeCalculationUrl(sharedUrl,originForValidation());
  return Boolean(url&&entries.some(item=>item.tool===tool&&item.url===url));
}
export async function updateCalculation(id:string,patch:CalculationPatch):Promise<boolean>{
  const changes:CalculationPatch={};
  if(patch.name!==undefined){const name=boundedText(patch.name,100);if(!name)return false;changes.name=name;}
  if(patch.note!==undefined)changes.note=boundedText(patch.note,1500);
  if(patch.favorite!==undefined)changes.favorite=patch.favorite===true;
  if(patch.tags!==undefined)changes.tags=cleanTags(patch.tags);
  return mutate(records=>{
    if(!records.some(r=>r.id===id))throw Error('Calculation no longer exists');
    return records.map(r=>r.id===id?{...r,...changes,updatedAt:Date.now()}:r);
  });
}
export async function removeCalculation(id:string):Promise<boolean>{
  return mutate(records=>{
    if(!records.some(r=>r.id===id))throw Error('Calculation no longer exists');
    return records.filter(r=>r.id!==id);
  });
}
export async function restoreCalculations(recordsToRestore:readonly SavedCalculation[]):Promise<boolean>{
  const parsed=recordsToRestore.map(record=>sanitizeSavedCalculation(record));
  if(parsed.some(record=>!record))return false;
  return mutate(current=>{
    const existing=new Map(current.map(item=>[item.id,item]));
    const keys=new Set(current.map(item=>item.tool+'\u0000'+item.url));
    const added:SavedCalculation[]=[];
    for(const record of parsed as SavedCalculation[]){
      const old=existing.get(record.id);
      if(old){
        if(JSON.stringify(old)!==JSON.stringify(record))
          throw new Error('This record was modified by another tab. Existing data was preserved.');
        continue;
      }
      const key=record.tool+'\u0000'+record.url;
      if(keys.has(key))continue;
      added.push(record);
      existing.set(record.id,record);
      keys.add(key);
    }
    return [...added,...current];
  });
}
export async function restoreCalculation(record:SavedCalculation):Promise<boolean>{
  return restoreCalculations([record]);
}
export async function clearCalculationHistory():Promise<boolean>{return mutate(()=>[]);}
export async function importCalculationLibrary(raw:string):Promise<number>{
  const imported=decodeCalculationLibrary(raw);
  const db=await ensureReady();
  let added=0;
  const result=await mutateCalculationRecords(db,(raw)=>sanitizeSavedCalculation(raw),records=>{
    const fingerprints=new Set(records.map(r=>r.tool+'\\u0000'+r.url));
    const ids=new Set(records.map(r=>r.id));
    const additions:SavedCalculation[]=[];
    for(const r of imported){
      const fp=r.tool+'\\u0000'+r.url;
      if(fingerprints.has(fp))continue;
      let id=r.id;
      if(ids.has(id)){id=newID();while(ids.has(id))id=newID();}
      ids.add(id);fingerprints.add(fp);additions.push({...r,id});
    }
    added=additions.length;
    return [...additions,...records];
  });
  publish(result);
  return added;
}
export function exportCalculationLibrary():string{return encodeCalculationLibrary(snapshot);}

export function filterCalculations(
  entries: readonly SavedCalculation[],
  {query = '', tool = 'all', favorites = false, sort = 'recent'}:
  {query?: string; tool?: string; favorites?: boolean; sort?: CalculationSort} = {},
): SavedCalculation[] {
  const q = query.trim().toLocaleLowerCase();
  const result = entries.filter(item =>
    (tool === 'all' || item.tool === tool) &&
    (!favorites || item.favorite) &&
    (!q || [item.name, item.tool, item.result, item.note, ...item.tags].some(part => part.toLocaleLowerCase().includes(q)))
  );
  result.sort((a,b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'tool') return a.tool.localeCompare(b.tool) || b.updatedAt - a.updatedAt;
    if (sort === 'oldest') return a.updatedAt - b.updatedAt;
    return Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt;
  });
  return result;
}
