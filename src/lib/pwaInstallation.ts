/** Identity-sensitive PWA checks. Standalone mode alone never identifies this app. */
export const LAUNCH_PARAM = 'dcxr_launch';
export const LAUNCH_VALUE = 'studio-v4';
const WINDOW_KEY = 'dcxr:v4:own-window';

export type InstallationEvidence = 'current-app' | 'device-installed' | 'unknown';

export function isOwnLaunch(href: string, base: string, standalone: boolean, referrer = ''): boolean {
  if (!standalone) return false;
  try {
    const url = new URL(href);
    const root = new URL(base, url.origin);
    return url.origin === root.origin && url.pathname === root.pathname &&
      url.searchParams.get(LAUNCH_PARAM) === LAUNCH_VALUE &&
      (!referrer || new URL(referrer).origin === url.origin);
  } catch { return false; }
}

export function isAppWindow(win: Window, nav: Navigator): boolean {
  return ['standalone', 'minimal-ui', 'window-controls-overlay'].some(mode =>
    win.matchMedia(`(display-mode: ${mode})`).matches) ||
    Boolean((nav as Navigator & { standalone?: boolean }).standalone);
}

export function isOurAppWindow(win: Window, nav: Navigator, basePath: string): boolean {
  if (!isAppWindow(win, nav)) return false;
  const root = new URL(basePath, win.location.origin).href;
  const launched = isOwnLaunch(win.location.href, root, true, win.document.referrer);
  try {
    if (launched) win.sessionStorage.setItem(WINDOW_KEY, root);
    return launched || win.sessionStorage.getItem(WINDOW_KEY) === root;
  } catch { return launched; }
}

export interface RelatedApp { platform?: string; id?: string; url?: string }
export function isOurRelatedApp(app: RelatedApp, id: string, manifest: string): boolean {
  if (app.platform !== 'webapp') return false;
  try {
    // ID is authoritative when supplied; never accept unrelated installed apps.
    if (app.id) return new URL(app.id).href === new URL(id).href;
    if (!app.url) return false;
    const url = new URL(app.url);
    const expected = new URL(manifest);
    return url.origin === expected.origin && url.pathname === expected.pathname &&
      (!url.search || url.search === '?v=pwa-identity-2' || url.search === '?v=lime-chrome-1');
  } catch { return false; }
}

/** Only a positive match confirms installation. An empty/unsupported API is unknown. */
export async function verifyRelatedInstallation(nav: Navigator, basePath: string, origin: string): Promise<boolean> {
  const api = nav as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };
  if (typeof api.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await api.getInstalledRelatedApps();
    const id = new URL(basePath, origin).href;
    const manifest = new URL(`${basePath}site.webmanifest`, origin).href;
    return Array.isArray(apps) && apps.some(app => app && isOurRelatedApp(app, id, manifest));
  } catch { return false; }
}
