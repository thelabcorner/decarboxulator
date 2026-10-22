import { COMPOUND_TYPES, type CompoundRow } from './cartridge';
import { parseEdibleRows, type EdibleRow } from './edibleFormula';
import { MAX_INPUT, parseAmount, UNIT_KEYS } from './decarb';
import { isAcidCannabinoid } from './cannabinoids';
import { parsePressureLog, parseVentLog } from './pressureTracker';

export const MAX_COMPOUND_ROWS = 20;
// IndexedDB-backed runs support extended multi-hour/multi-day campaigns.
export const MAX_TRACKER_READINGS = 500;

export type TrackerReading = {
  weightG: number;
  timestamp: number;
  /** Optional *measured* temperature; never inferred from the apparent rate. */
  temperatureC?: number;
  /** Context for anomalies, interventions, or measurement conditions. */
  note?: string;
};
const validNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) &&
  value >= 0 && value <= MAX_INPUT;

export function parseCompoundRows(raw: string): CompoundRow[] | null {
  if (raw.length > 2048) return null;
  try {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_COMPOUND_ROWS) return null;
    if (!rows.every(row => row && typeof row === 'object' && !Array.isArray(row) &&
      typeof row.type === 'string' && COMPOUND_TYPES.includes(row.type as CompoundRow['type']) &&
      validNumber(row.parts))) return null;
    return rows.map(row => ({type: row.type as CompoundRow['type'], parts: row.parts as number}));
  } catch { return null; }
}

export function parseTrackerReadings(raw: string): TrackerReading[] | null {
  if (raw.length > 300000) return null;
  try {
    const records: unknown = JSON.parse(raw);
    if (!Array.isArray(records) || records.length > MAX_TRACKER_READINGS) return null;
    if (!records.every(point => point && typeof point === 'object' && !Array.isArray(point) &&
       validNumber(point.weightG) && typeof point.timestamp === 'number' &&
       Number.isSafeInteger(point.timestamp) && point.timestamp > 0 && point.timestamp < 9999999999999 &&
       (point.temperatureC === undefined ||
         typeof point.temperatureC === 'number' && Number.isFinite(point.temperatureC) &&
         point.temperatureC >= -273.15 && point.temperatureC <= 500) &&
       (point.note === undefined || typeof point.note === 'string' && point.note.length <= 300))) return null;
    return records.map(point => ({
      weightG: point.weightG as number,
      timestamp: point.timestamp as number,
      ...(point.temperatureC === undefined ? {} : {temperatureC:point.temperatureC as number}),
      ...(point.note === undefined ? {} : {note:point.note as string}),
    }));
  } catch { return null; }
}

/** Every restored value is typed against the declared workspace field, not just its length. */
export function validWorkspaceValue(key: string, proposed: unknown, initial: string) {
  if (typeof proposed !== 'string') return false;
  if (key === 'unit') return UNIT_KEYS.includes(proposed as typeof UNIT_KEYS[number]);
  if (key === 'cannabinoid') return isAcidCannabinoid(proposed);
  if (key === 'direction') return proposed === 'decarb' || proposed === 'reverse';
  if (key === 'tempUnit') return proposed === 'C' || proposed === 'F';
  if (key === 'pressureBasis' || key === 'sealPressureBasis') return proposed === 'psia' || proposed === 'psig';
  if (key === 'pressureTrackerMode') return proposed === 'seal' || proposed === 'vent';
  if (key === 'ventAccounting') return proposed === 'counted' || proposed === 'recorded';
  if (key === 'ventLog') return parseVentLog(proposed) !== null;
  if (key === 'pressureLog') return parsePressureLog(proposed) !== null;
  if (['sealPressure','initialPressure','currentPressure','ventBeforePressure','ventAfterPressure',
    'initialGasTemp','currentGasTemp','ventBeforeTemp','ventAfterTemp'].includes(key))
    return proposed.length <= 40 && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(proposed) && Number.isFinite(Number(proposed));
  if (key === 'tracking' || key === 'autoBalance') return proposed === 'yes' || proposed === 'no';
  if (key === 'trackerMode') return proposed === 'manual' || proposed === 'percentage';
  if (key === 'batchMode') return proposed === 'target' || proposed === 'available';
  if (key === 'transferLoss') return proposed.length <= 40 && parseAmount(proposed,{min:0,max:99.99}).value !== null;
  if (key === 'acidTreatment') return proposed === 'convert' || proposed === 'retain';
  if (key === 'temp') return proposed.length <= 40 &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(proposed) &&
    Number.isFinite(Number(proposed));
  if (key === 'edibleMode') return ['weight','concentration','desired'].includes(proposed);
  if (key === 'edibleRows') return parseEdibleRows(proposed) !== null;
  if (key === 'rows') return parseCompoundRows(proposed) !== null;
  if (key === 'readings') return parseTrackerReadings(proposed) !== null;
  if (proposed === '') return initial === '' || parseAmount(initial).value !== null;
  return proposed.length <= 40 && parseAmount(proposed).value !== null;
}

/**
 * Before an explicit THCa-treatment switch existed, mixed THC+THCa cartridge
 * snapshots retained THCa without modeling a decarb step. Preserve that
 * historical interpretation when old share links or saved inputs are loaded,
 * while new calculations default to the explicit conversion model.
 */
export function migrateLegacyWorkspace<T extends Record<string, string>>(
  id: string, source: unknown, restored: T,
): T {
  if (id === 'edibles' && source && typeof source === 'object' && !Array.isArray(source) &&
      !Object.hasOwn(source, 'edibleRows') && Object.hasOwn(restored, 'edibleRows')) {
    const old = source as Record<string, unknown>;
    const mass = parseAmount(String(old.mass ?? '')).value;
    const acid = parseAmount(String(old.thca ?? ''), {max:100}).value;
    const thc = parseAmount(String(old.thc ?? ''), {max:100}).value;
    const unit = old.unit === 'mg' || old.unit === 'kg' ? old.unit : 'g';
    if (mass !== null && acid !== null && thc !== null && acid+thc <= 100) {
      const materialG = mass * (unit === 'kg' ? 1000 : unit === 'mg' ? 0.001 : 1);
      const rows: EdibleRow[] = [
        {type:'THCa',weight:materialG,unit:'g',percent:acid,target:10},
        {type:'THC',weight:materialG,unit:'g',percent:thc,target:10},
      ];
      return {...restored, edibleMode:'concentration', edibleRows:JSON.stringify(rows)};
    }
  }
  if (id !== 'cartridge' || !source || typeof source !== 'object' ||
      Array.isArray(source) || Object.hasOwn(source, 'acidTreatment') ||
      !Object.hasOwn(restored, 'acidTreatment') || !Object.hasOwn(restored, 'rows')) return restored;
  const rows = parseCompoundRows(restored.rows);
  if (!rows || !rows.some(row => row.type === 'THCa' && row.parts > 0) ||
      !rows.some(row => row.type === 'THC' && row.parts > 0)) return restored;
  return {...restored, acidTreatment: 'retain'};
}
