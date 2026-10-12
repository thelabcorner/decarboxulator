import { useSyncExternalStore } from 'react';

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
export const MAX_CALCULATIONS = 500;
const EMPTY: readonly SavedCalculation[] = Object.freeze([]);
const listeners = new Set<() => void>();
let snapshot: readonly SavedCalculation[] = EMPTY;
let initialized = false;
let listeningToStorage = false;

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
    if (!/^\/(?:decarboxulator\/)?(?:tools\/[a-z0-9-]+\/?|)$/i.test(decoded)) return null;
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
  const known = new Set<string>();
  const records: SavedCalculation[] = [];
  for (const record of [...values].sort((a,b) => b.updatedAt - a.updatedAt)) {
    const fingerprint = record.tool + '\u0000' + record.url;
    if (known.has(record.id) || known.has(fingerprint)) continue;
    known.add(record.id); known.add(fingerprint);
    records.push(record);
    if (records.length >= MAX_CALCULATIONS) break;
  }
  return records;
}
export function decodeCalculationLibrary(raw: string, origin = originForValidation()): SavedCalculation[] {
  const decoded: unknown = JSON.parse(raw);
  const records = Array.isArray(decoded) ? decoded :
    plainRecord(decoded) && decoded.version === VERSION && Array.isArray(decoded.entries) ? decoded.entries : null;
  if (!records || records.length > 10000) throw new Error('Not a supported Decarboxulator calculation library.');
  const items = records.map(item => sanitizeSavedCalculation(item, origin));
  if (items.some(item => item === null)) throw new Error('The file contains one or more invalid or unsafe calculation records.');
  return uniqueSorted(items as SavedCalculation[]);
}
export function encodeCalculationLibrary(records: readonly SavedCalculation[]) {
  return JSON.stringify({
    format: 'decarboxulator-calculations',
    version: VERSION,
    exportedAt: new Date().toISOString(),
    entries: records,
  }, null, 2);
}
function readStorage(): readonly SavedCalculation[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return decodeCalculationLibrary(saved);
    const previous = localStorage.getItem(LEGACY_KEY);
    if (previous) {
      const migrated = decodeCalculationLibrary(previous);
      try { localStorage.setItem(KEY, encodeCalculationLibrary(migrated)); }
      catch { /* Prior snapshots remain intact for recovery. */ }
      return migrated;
    }
  } catch { /* Restricted or corrupt storage must never stop a calculator. */ }
  return EMPTY;
}
function load() {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true;
    snapshot = readStorage();
  }
}
function publish(next: readonly SavedCalculation[]) {
  snapshot = next;
  listeners.forEach(listener => listener());
}
function onStorage(event: StorageEvent) {
  if (event.key !== KEY && event.key !== LEGACY_KEY && event.key !== null) return;
  publish(readStorage());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  if (!listeningToStorage && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    listeningToStorage = true;
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && listeningToStorage && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
      listeningToStorage = false;
    }
  };
}
/** SSR snapshot is deterministic; React rechecks the live store after hydration. */
export function useCalculationHistory(): readonly SavedCalculation[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}
/** Mutations return false when persistence fails; the UI must not announce success. */
function persist(records: readonly SavedCalculation[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(KEY, encodeCalculationLibrary(uniqueSorted(records)));
    publish(uniqueSorted(records));
    return true;
  } catch { return false; }
}
function newID() {
  return globalThis.crypto?.randomUUID?.() ?? `calc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function saveCalculation(tool: string, result: string, sharedUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  load();
  const url = sanitizeCalculationUrl(sharedUrl, window.location.origin);
  const name = boundedText(tool, 90);
  const output = boundedText(result, 240);
  if (!url || !name || !output) return false;
  const existing = snapshot.find(item => item.tool === name && item.url === url);
  const now = Date.now();
  if (existing) {
    return persist(snapshot.map(item => item.id === existing.id
      ? {...item, result: output, updatedAt: now} : item));
  }
  const record: SavedCalculation = {
    id: newID(), tool: name, result: output, url,
    name, note: '', tags: [], favorite: false,
    savedAt: now, updatedAt: now,
  };
  return persist([record, ...snapshot]);
}
export function isCalculationSaved(tool: string, sharedUrl: string, entries: readonly SavedCalculation[]) {
  const origin = originForValidation();
  const url = sanitizeCalculationUrl(sharedUrl, origin);
  return Boolean(url && entries.some(item => item.tool === tool && item.url === url));
}
export function updateCalculation(id: string, patch: CalculationPatch): boolean {
  load();
  const found = snapshot.find(item => item.id === id);
  if (!found) return false;
  const changes: CalculationPatch = {};
  if (patch.name !== undefined) {
    const name = boundedText(patch.name, 100);
    if (!name) return false;
    changes.name = name;
  }
  if (patch.note !== undefined) changes.note = boundedText(patch.note, 1500);
  if (patch.favorite !== undefined) changes.favorite = patch.favorite === true;
  if (patch.tags !== undefined) changes.tags = cleanTags(patch.tags);
  return persist(snapshot.map(item => item.id === id ? {...item, ...changes, updatedAt: Date.now()} : item));
}
export function removeCalculation(id: string): boolean {
  load();
  if (!snapshot.some(item => item.id === id)) return false;
  return persist(snapshot.filter(item => item.id !== id));
}
export function restoreCalculation(record: SavedCalculation): boolean {
  load();
  const clean = sanitizeSavedCalculation(record);
  if (!clean) return false;
  return persist([clean, ...snapshot.filter(item => item.id !== clean.id)]);
}
export function clearCalculationHistory(): boolean {
  load();
  return persist(EMPTY);
}
export function importCalculationLibrary(raw: string): number {
  load();
  const imported = decodeCalculationLibrary(raw);
  const existing = new Set(snapshot.map(item => item.tool + '\u0000' + item.url));
  const additions = imported.filter(item => !existing.has(item.tool + '\u0000' + item.url));
  if (!persist([...additions, ...snapshot])) throw new Error('Unable to save imported calculations on this device.');
  return additions.length;
}
export function exportCalculationLibrary(): string {
  load();
  return encodeCalculationLibrary(snapshot);
}
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
