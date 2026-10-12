/** Reuse the existing Decarboxulator V3 GA4 stream; do not create a new property. */
export const GA4_MEASUREMENT_ID = 'G-LK9VC1VS8P';

/** Share links embed calculator inputs in query parameters, which GA must not receive. */
export function analyticsPageUrl(href: string): string {
  const url = new URL(href);
  return url.origin + url.pathname;
}

/** Restrict collection to actual production hostnames, not local test environments. */
export function isAnalyticsHost(hostname: string): boolean {
  return hostname.toLowerCase() === 'dcxr.thedabcorner.site' ||
    hostname.toLowerCase() === 'decarboxulator.thedabcorner.site' ||
    hostname.toLowerCase() === 'thelabcorner.github.io';
}