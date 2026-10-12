import { describe, expect, it } from 'vitest';
import { buildShareUrl, isLocalShareUrl, readSharedState } from '../src/lib/share';

const fields = { amount: '10', direction: 'decarb', unit: 'g' };

describe('share link snapshots', () => {
  it('round-trips exact inputs and strips stale query/hash', () => {
    const original = {amount: '25.125', direction: 'reverse', unit: 'mg'};
    const link = buildShareUrl('https://example.org/decarboxulator/tools/thc-to-thca/?utm_source=test#forward', original, fields);
    const parsed = new URL(link);
    expect(parsed.pathname).toBe('/decarboxulator/tools/thc-to-thca/');
    expect(parsed.hash).toBe('');
    expect(parsed.searchParams.get('utm_source')).toBeNull();
    expect(parsed.searchParams.get('v')).toBe('1');
    expect(readSharedState(parsed.search, fields)).toEqual(original);
  });
  it('preserves an all-default snapshot so device storage does not take precedence', () => {
    const link = new URL(buildShareUrl('https://example.org/tools/thca-to-thc', fields, fields));
    expect(readSharedState(link.search, fields)).toEqual(fields);
    expect(readSharedState('?v=1', fields)).toEqual({});
  });
  it('accepts legacy direct-field links and ignores unsolicited fields', () => {
    expect(readSharedState('?amount=20&unit=kg&extra=ignore', fields)).toEqual({amount:'20',unit:'kg'});
    expect(readSharedState('?unit=g&amount=%2225%22&direction=reverse', fields)).toEqual({
      unit:'g', amount:'25', direction:'reverse',
    });
    expect(readSharedState('?utm=test', fields)).toBeNull();
  });
  it('rejects excessive query strings instead of processing them', () => {
    expect(readSharedState('?amount='+'0'.repeat(9000), fields)).toBeNull();
    expect(() => buildShareUrl('https://example.org/tools/x', {amount:'x'.repeat(10000)}, fields)).toThrow(RangeError);
  });
  it('recognizes localhost and private LAN links as non-public', () => {
    expect(isLocalShareUrl('http://localhost:42061/tools/x')).toBe(true);
    expect(isLocalShareUrl('http://192.168.1.70:42061/tools/x')).toBe(true);
    expect(isLocalShareUrl('https://thelabcorner.github.io/decarboxulator/')).toBe(false);
  });
});
