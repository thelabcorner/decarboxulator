import {
  canCreateTrackerSession, newTrackerSession, parseTrackerSession,
  type TrackerCollection, type TrackerSession,
} from './trackerSessions';

/**
 * Portable, strict tracker backup contract. A bad record aborts the whole
 * import; no partial restores and no write until everything is validated.
 */
// Bound untrusted backup parsing. The 500-run × 500-reading maximum can exceed
// 16 MB when notes are long; export individual runs if the archive is too large.
export const TRACKER_BACKUP_MAX_BYTES = 16 * 1024 * 1024;
export type TrackerImportReport = { added: number; skipped: number };

type Archive = {
  format: 'decarboxulator-tracker-archive';
  version: 1;
  exportedAt: string;
  sessions: TrackerSession[];
};

export function encodeTrackerArchive(sessions: readonly TrackerSession[]): string {
  const archive: Archive = {
    format: 'decarboxulator-tracker-archive',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: [...sessions],
  };
  return JSON.stringify(archive, null, 2);
}

export function encodeTrackerSession(session: TrackerSession): string {
  return JSON.stringify({
    format: 'decarboxulator-tracker-session',
    exportedAt: new Date().toISOString(),
    session,
    interpretation: 'Apparent CO2-only gravimetric conversion; not an analytical potency test',
  }, null, 2);
}

export function decodeTrackerBackup(raw: string): TrackerSession[] {
  if (new TextEncoder().encode(raw).byteLength > TRACKER_BACKUP_MAX_BYTES)
    throw new Error('Backup exceeds the 16 MB safety limit.');
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('This file is not valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Not a recognized Decarboxulator tracker backup.');
  const envelope = value as Record<string, unknown>;
  const records: unknown[] = envelope.format === 'decarboxulator-tracker-session'
    ? [envelope.session]
    : envelope.format === 'decarboxulator-tracker-archive' && envelope.version === 1
      && Array.isArray(envelope.sessions) ? envelope.sessions : [];
  if (!records.length || records.length > 500)
    throw new Error('Backup must contain between 1 and 500 supported tracker sessions.');
  const sessions = records.map(parseTrackerSession);
  if (sessions.some(session => !session))
    throw new Error('Backup contains invalid or unsupported tracker data; nothing was imported.');
  const valid = sessions as TrackerSession[];
  if (new Set(valid.map(session => session.id)).size !== valid.length)
    throw new Error('Backup has duplicate session identifiers; nothing was imported.');
  return valid;
}

/** Ignore local/generated IDs when detecting reimports of the same laboratory run. */
function identity(session: TrackerSession): string {
  return JSON.stringify([
    session.title, session.notes,
    session.status === 'running' ? 'paused' : session.status,
    session.createdAt, session.startedAt, session.completedAt,
    session.fields, session.readings,
  ]);
}

/** Never replace any existing data or start imported runs automatically. */
export function mergeTrackerBackup(
  original: TrackerCollection, incoming: readonly TrackerSession[],
  createId: () => string = () => newTrackerSession().id,
): { collection: TrackerCollection; report: TrackerImportReport } {
  const ids = new Set(original.sessions.map(session => session.id));
  const identities = new Set(original.sessions.map(identity));
  const added: TrackerSession[] = [];
  let skipped = 0;
  for (const source of incoming) {
    const normalized: TrackerSession = source.status === 'running'
      ? { ...source, status: 'paused' } : source;
    const fingerprint = identity(normalized);
    if (identities.has(fingerprint)) { skipped++; continue; }
    if (!canCreateTrackerSession(original.sessions.length + added.length))
      throw new Error('The 500-session on-device limit would be exceeded. Nothing was imported.');
    let id = normalized.id;
    if (ids.has(id)) {
      // A distinct run with the same ID cannot overwrite local records.
      let attempts = 0;
      do {
        id = createId();
        if (++attempts > 16) throw new Error('Could not assign a unique session ID.');
      } while (ids.has(id));
    }
    ids.add(id);
    identities.add(fingerprint);
    added.push({ ...normalized, id });
  }
  return {
    collection: added.length ? { ...original, sessions: [...added, ...original.sessions] } : original,
    report: { added: added.length, skipped },
  };
}
