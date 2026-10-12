import { describe, expect, it } from 'vitest';
import { analyticsPageUrl, GA4_MEASUREMENT_ID, isAnalyticsHost } from '../src/lib/googleAnalytics';

describe('restored Decarboxulator GA4 integration', () => {
  it('uses the historical V3 stream to preserve analytics continuity', () => {
    expect(GA4_MEASUREMENT_ID).toBe('G-LK9VC1VS8P');
  });
  it('redacts calculation snapshots, URL fragments and campaign parameters', () => {
    expect(analyticsPageUrl('https://thelabcorner.github.io/decarboxulator/tools/batch-yield/?v=1&weight=123.4#output'))
      .toBe('https://thelabcorner.github.io/decarboxulator/tools/batch-yield/');
    expect(analyticsPageUrl('https://dcxr.thedabcorner.site/faq/?utm_source=share'))
      .toBe('https://dcxr.thedabcorner.site/faq/');
    expect(analyticsPageUrl('https://decarboxulator.thedabcorner.site/tools/thca-to-thc/?thca=90'))
      .toBe('https://decarboxulator.thedabcorner.site/tools/thca-to-thc/');
  });
  it('does not send test or local-development traffic', () => {
    for (const domain of ['localhost', '127.0.0.1', '192.168.1.11', 'example.com', 'preview.pages.dev']) {
      expect(isAnalyticsHost(domain)).toBe(false);
    }
    for (const domain of ['thelabcorner.github.io', 'dcxr.thedabcorner.site', 'decarboxulator.thedabcorner.site']) {
      expect(isAnalyticsHost(domain)).toBe(true);
    }
  });
});