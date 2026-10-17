import { describe, expect, it } from 'vitest';
import {
  decodeTrackerBackup, encodeTrackerArchive, encodeTrackerSession,
  mergeTrackerBackup, TRACKER_BACKUP_MAX_BYTES,
} from '../src/lib/trackerBackup';
import { newTrackerSession, parseTrackerSession, type TrackerCollection, type TrackerSession } from '../src/lib/trackerSessions';

const time = 1_791_000_000_000;
function session(overrides: Partial<TrackerSession> = {}): TrackerSession {
  return {
    ...newTrackerSession(time),
    id: 'run-original', title: 'Batch 014 / acid fraction',
    notes: 'Balance calibrated before the run',
    fields: { ...newTrackerSession(time).fields },
    ...overrides,
  };
}
const collection = (sessions: TrackerSession[]): TrackerCollection =>
  ({ activeId: sessions[0]?.id || '', sessions });

describe('tracker portable backup', () => {
  it('round-trips a single run including raw readings, metadata, status and timestamps', () => {
    const s = session({
      status: 'completed', startedAt: time + 100,
      completedAt: time + 4000, updatedAt: time + 5000,
      readings: [
        { weightG: 33, timestamp: time + 100 },
        { weightG: 32, timestamp: time + 3000, temperatureC: 78.5, note: 'Stabilized balance reading' },
      ],
    });
    expect(decodeTrackerBackup(encodeTrackerSession(s))).toEqual([s]);
  });

  it('round-trips an entire library through the archive contract', () => {
    const a = session();
    const b = session({ id:'second', title:'Batch 015', updatedAt:time + 300 });
    expect(decodeTrackerBackup(encodeTrackerArchive([a,b]))).toEqual([a,b]);
  });

  it('rejects incomplete, corrupt and unsupported archives atomically', () => {
    const a = session();
    for (const raw of [
      'not json', '{}', '[]',
      JSON.stringify({ format:'decarboxulator-tracker-session',session:{ ...a,status:'ghost' } }),
      JSON.stringify({ format:'decarboxulator-tracker-archive',version:2,sessions:[a] }),
      JSON.stringify({ format:'decarboxulator-tracker-archive',version:1,sessions:[a,{...a,id:'bad',readings:[{weightG:-5,timestamp:time}]}] }),
      JSON.stringify({ format:'decarboxulator-tracker-archive',version:1,sessions:[a,a] }),
      JSON.stringify({ format:'decarboxulator-tracker-archive',version:1,sessions:[] }),
      '{' + ' '.repeat(TRACKER_BACKUP_MAX_BYTES) + '}',
    ]) {
      expect(() => decodeTrackerBackup(raw)).toThrow();
    }
  });

  it('rejects impossible measurement chronology and malformed metadata', () => {
    const s = session({ startedAt:time + 100, readings:[
      { weightG:30,timestamp:time + 200 },
      { weightG:29,timestamp:time + 200 },
    ] });
    expect(parseTrackerSession(s)).toBeNull();
    expect(() => decodeTrackerBackup(encodeTrackerSession(s))).toThrow();
    expect(parseTrackerSession({ ...session(),fields:{...session().fields,trackerMode:'unsupported'} })).toBeNull();
  });

  it('merges new sessions without switching the active run or mutating existing records', () => {
    const saved = session();
    const original = collection([saved]);
    const incoming = session({ id:'second',title:'Imported batch',updatedAt:time + 10 });
    const result = mergeTrackerBackup(original,[incoming]);
    expect(result.report).toEqual({added:1,skipped:0});
    expect(result.collection.activeId).toEqual(saved.id);
    expect(result.collection.sessions).toEqual([incoming,saved]);
    expect(original.sessions).toEqual([saved]);
  });

  it('never overwrites local records on identifier collision', () => {
    const original = collection([session()]);
    const conflicting = session({ title:'Separate physical batch', updatedAt:time + 17 });
    const result = mergeTrackerBackup(original,[conflicting],()=> 'fresh-safe-id');
    expect(result.collection.sessions[0]).toMatchObject({
      id:'fresh-safe-id',title:'Separate physical batch',
    });
    expect(result.collection.sessions[1]).toEqual(original.sessions[0]);
    expect(mergeTrackerBackup(result.collection,[conflicting]).report).toEqual({added:0,skipped:1});
  });

  it('deduplicates repeated archives and preserves completed status', () => {
    const completed = session({
      status:'completed',startedAt:time + 100,completedAt:time + 200,updatedAt:time + 210,
    });
    const first = mergeTrackerBackup(collection([]),[completed]);
    const second = mergeTrackerBackup(first.collection,[completed]);
    expect(second.report).toEqual({added:0,skipped:1});
    expect(second.collection).toBe(first.collection);
    expect(first.collection.sessions[0].status).toBe('completed');
  });

  it('imports a remote running session as paused, without losing its readings', () => {
    const remote = session({
      status:'running',startedAt:time,readings:[{weightG:32,timestamp:time + 1000}],
      updatedAt:time + 1500,
    });
    const first = mergeTrackerBackup(collection([]),[remote]);
    expect(first.collection.sessions[0]).toMatchObject({
      status:'paused',startedAt:time,readings:remote.readings,
    });
    expect(remote.status).toBe('running');
    expect(mergeTrackerBackup(first.collection,[remote]).report).toEqual({added:0,skipped:1});
  });

  it('does not partially merge when the shared 25,565-entry capacity is exceeded', () => {
    const existing = Array.from({length:499}, (_,i) =>
      session({id:'id-'+i,title:'Existing run '+i,createdAt:time+i,updatedAt:time+i}));
    const source = [
      session({id:'new-1',title:'New one'}),
      session({id:'new-2',title:'New two'}),
    ];
    const original = collection(existing);
    expect(() => mergeTrackerBackup(original,source,undefined,25065)).toThrow(/25,565-entry/);
    expect(original.sessions.length).toBe(499);
    expect(mergeTrackerBackup(original,[source[0]],undefined,25065).report.added).toBe(1);
  });

  it('round-trips a fully populated 500-run library at the documented field limits', () => {
    const notes = '界'.repeat(4000);
    const full = Array.from({length:500},(_,i) => {
      const startedAt=time + i*100000;
      return session({
        id:'archive-'+i,title:'Run '+i,notes,createdAt:startedAt,
        updatedAt:startedAt+81000,startedAt,status:'paused',
        readings:Array.from({length:80},(_,j) => ({
          weightG:33-j/1000,timestamp:startedAt+j*1000,
        })),
      });
    });
    const json=encodeTrackerArchive(full);
    expect(new TextEncoder().encode(json).byteLength).toBeGreaterThan(5*1024*1024);
    expect(new TextEncoder().encode(json).byteLength).toBeLessThan(TRACKER_BACKUP_MAX_BYTES);
    const decoded=decodeTrackerBackup(json);
    expect(decoded.length).toBe(500);
    expect(decoded[499]).toEqual(full[499]);
  });

  it('rejects cyclic corrupted data without throwing from session parsing', () => {
    const corrupted=session();
    const cycle:unknown[]=[];
    cycle.push(cycle);
    (corrupted as {readings:unknown[]}).readings=cycle;
    expect(()=>parseTrackerSession(corrupted)).not.toThrow();
    expect(parseTrackerSession(corrupted)).toBeNull();
  });

  it('rejects duplicate newly generated IDs instead of replacing entries', () => {
    const original = collection([session()]);
    expect(() => mergeTrackerBackup(original,[session({title:'A distinct run'})],()=> 'run-original'))
      .toThrow(/unique session ID/);
  });
});
