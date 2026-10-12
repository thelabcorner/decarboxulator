import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { analyticsPageUrl, createGtag, GA4_MEASUREMENT_ID, isAnalyticsHost } from '../lib/googleAnalytics';

type GoogleTag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: GoogleTag };

let lastTrackedPage: string | undefined;

function ensureGoogleTag(): GoogleTag {
  const target = window as AnalyticsWindow;
  if (target.gtag) return target.gtag;

  target.dataLayer ??= [];
  target.gtag = createGtag(target.dataLayer);
  target.gtag('js', new Date());
  // Route changes are tracked manually; never submit entire share-link URLs.
  target.gtag('config', GA4_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  return target.gtag;
}

function trackRoute() {
  const page = analyticsPageUrl(window.location.href);
  // Ignore query-only changes, StrictMode remounts, and redundant renders.
  if (page === lastTrackedPage) return;
  const referrer = lastTrackedPage ??
    (document.referrer ? analyticsPageUrl(document.referrer) : '');
  lastTrackedPage = page;

  const gtag = ensureGoogleTag();
  gtag('set', { page_location: page });
  gtag('event', 'page_view', {
    send_to: GA4_MEASUREMENT_ID,
    page_title: document.title,
    page_location: page,
    page_referrer: referrer,
  });
}

/**
 * One root-owned client lifecycle, with TanStack rendered navigation events.
 * GA4 enhanced measurement's history-pageview option must be OFF to prevent
 * a second independent view from firing on SPA navigation.
 */
export function GoogleAnalytics() {
  const router = useRouter();
  useEffect(() => {
    if (!import.meta.env.PROD || !isAnalyticsHost(window.location.hostname)) return;
    trackRoute();
    const unsubscribe = router.subscribe('onRendered', ({ pathChanged }) => {
      if (pathChanged) trackRoute();
    });
    return unsubscribe;
  }, [router]);
  return null;
}