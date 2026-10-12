/** Reuse the existing Decarboxulator V3 GA4 stream; do not create a new property. */
export const GA4_MEASUREMENT_ID = 'G-LK9VC1VS8P';

/**
 * Google's gtag.js queue expects the native Arguments object, not an Array.
 * Rest-parameter arrays are silently ignored by the loaded tag runtime.
 */
export function createGtag(dataLayer: unknown[]): (...args: unknown[]) => void {
  return function gtag(..._args: unknown[]) {
    dataLayer.push(arguments);
  };
}

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