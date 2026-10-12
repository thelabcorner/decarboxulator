/**
 * Stable, explicit calculation snapshots. Every known field is serialized so
 * opening a link never depends on device-local state or future default changes.
 * Version is reserved for compatible decoding; legacy field-only links survive.
 */
export const SHARE_VERSION = '1';
export const MAX_SHARE_URL_LENGTH = 8192;

export function buildShareUrl(
  currentHref: string,
  values: Readonly<Record<string, string>>,
  fields: Readonly<Record<string, string>>,
): string {
  const url = new URL(currentHref);
  url.hash = '';
  url.search = '';
  url.searchParams.set('v', SHARE_VERSION);
  for (const key of Object.keys(fields).sort()) {
    url.searchParams.set(key, values[key] ?? fields[key]);
  }
  const encoded = url.toString();
  if (encoded.length > MAX_SHARE_URL_LENGTH) throw new RangeError('Calculation link is too long to share.');
  return encoded;
}

export function readSharedState(search: string, fields: Readonly<Record<string, string>>): Record<string, string> | null {
  if (search.length > MAX_SHARE_URL_LENGTH) return null;
  const params = new URLSearchParams(search);
  // An explicit snapshot marker also restores all-default states even when
  // local storage contains edits. Field-only links remain backwards compatible.
  if (params.get('v') !== SHARE_VERSION && !Object.keys(fields).some(key => params.has(key))) return null;
  const output: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    const value = params.get(key);
    if (value === null) continue;
    // TanStack's JSON-first search serialization encodes a numeric-looking
    // string as %22...%22 to preserve its string type. Decode this narrow case
    // for old navigation links; our own share links use plain URLSearchParams.
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        const parsed: unknown = JSON.parse(value);
        output[key] = typeof parsed === 'string' ? parsed : value;
      } catch { output[key] = value; }
    } else output[key] = value;
  }
  return output;
}

export function isLocalShareUrl(raw: string): boolean {
  const hostname = new URL(raw).hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' ||
    hostname === '::1' || hostname === '[::1]' ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname);
}
