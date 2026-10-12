import { describe, expect, it } from 'vitest';
import { parseTrackerReadings, MAX_TRACKER_READINGS } from '../src/lib/workspacePayload';
import {
  canCreateTrackerSession, migrateLegacyTracker, newTrackerSession, parseTrackerSession, TRACKER_DEFAULTS,
} from '../src/lib/trackerSessions';

describe('IndexedDB tracker schema and migration', () => {
  const base = () => newTrackerSession(1700000000000);
  it('creates a versioned, independent empty run', () => {
    const a=base(),b=base();
    expect(a.id).not.toBe(b.id);
    expect(a.schemaVersion).toBe(1);
    expect(a.status).toBe('draft');
    expect(a.startedAt).toBeNull();
    expect(a.completedAt).toBeNull();
    expect(a.fields).toEqual(TRACKER_DEFAULTS);
    expect(a.readings).toEqual([]);
    expect(parseTrackerSession(a)).toEqual(a);
  });
  it('refuses tampered or inconsistent records instead of calculating with them', () => {
    const valid=base();
    expect(parseTrackerSession({...valid,status:'completed',completedAt:null})).toBeNull();
    expect(parseTrackerSession({...valid,fields:{...valid.fields,thca:'oops'}})).toBeNull();
    expect(parseTrackerSession({...valid,fields:{...valid.fields,autoBalance:'maybe'}})).toBeNull();
    expect(parseTrackerSession({...valid,notes:'x'.repeat(4001)})).toBeNull();
    expect(parseTrackerSession({...valid,readings:[{timestamp:1700000001000,weightG:30},
      {timestamp:1700000000999,weightG:29}]})).toBeNull();
    expect(parseTrackerSession({...valid,readings:[{timestamp:1700000000500,weightG:33}]})).toEqual(
      {...valid,readings:[{timestamp:1700000000500,weightG:33}]});
    expect(parseTrackerSession({...valid,readings:[{timestamp:1699999999000,weightG:33}]})).toBeNull();
  });
  it('round-trips unfinished numeric edits without destroying an entire run on reload', () => {
    const initial=base();
    const unfinished={...initial,status:'paused' as const,startedAt:initial.createdAt,
      fields:{...initial.fields,thca:'28',current:'1e',scaleResolution:''},
      readings:[{timestamp:initial.createdAt+1200,weightG:32}]};
    expect(parseTrackerSession(unfinished)).toEqual(unfinished);
    expect(parseTrackerSession({...unfinished,fields:{...unfinished.fields,current:'<script>'}})).toBeNull();
  });
  it('recovers pre-IndexedDB v4 measurements with their original timestamps', () => {
    const readings=[{weightG:32.5,timestamp:1700000000200},{weightG:32,timestamp:1700000010200}];
    const record=migrateLegacyTracker(JSON.stringify({
      trackerMode:'manual',tare:'5',thca:'28',other:'0',
      startedAt:'1700000000000',tracking:'no',readings:JSON.stringify(readings),
    }),1700000200000);
    expect(record?.status).toBe('paused');
    expect(record?.startedAt).toBe(1700000000000);
    expect(record?.readings).toEqual(readings);
    expect(record?.fields.tare).toBe('5');
    expect(record?.fields.scaleResolution).toBe('0.01');
    expect(parseTrackerSession(record)).toEqual(record);
  });
  it('treats malformed legacy input as a draft, without reinterpreting its readings', () => {
    expect(migrateLegacyTracker('{bad')).toBeNull();
    const record=migrateLegacyTracker(JSON.stringify({
      thca:'Infinity',other:'-5',tracking:'yes',readings:'[{"weightG":99999999999}]',
    }));
    expect(record?.status).toBe('draft');
    expect(record?.readings).toEqual([]);
    expect(record?.fields.thca).toBe(TRACKER_DEFAULTS.thca);
    expect(record?.fields.other).toBe(TRACKER_DEFAULTS.other);
  });
  it('bounds number of independent runs', () => {
    expect(canCreateTrackerSession(499)).toBe(true);
    expect(canCreateTrackerSession(500)).toBe(false);
  });
  it('preserves measured temperatures and short free-text annotations across many observations', () => {
    const baseTime=1700000000000;
    const readings=Array.from({length:MAX_TRACKER_READINGS},(_,i)=>({
      weightG:33-i/1000,timestamp:baseTime+i*60000,
      temperatureC:115.5,note:'Balance stabilized',
    }));
    expect(MAX_TRACKER_READINGS).toBe(500);
    expect(parseTrackerReadings(JSON.stringify(readings))).toEqual(readings);
    expect(parseTrackerReadings(JSON.stringify([...readings,readings[0]]))).toBeNull();
    expect(parseTrackerReadings(JSON.stringify([{weightG:32,timestamp:baseTime,temperatureC:900}]))).toBeNull();
    expect(parseTrackerReadings(JSON.stringify([{weightG:32,timestamp:baseTime,note:'x'.repeat(301)}]))).toBeNull();
  });
});