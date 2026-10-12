import { describe, expect, it, vi } from 'vitest';
import { isOwnLaunch, isOurAppWindow, isOurRelatedApp, verifyRelatedInstallation } from '../src/lib/pwaInstallation';

const ORIGIN = 'https://dcxr.thedabcorner.site';
const ROOT = ORIGIN + '/';
const MANIFEST = ROOT + 'site.webmanifest';

function appWindow(href: string, standalone: boolean, storage: Map<string, string>, referrer = '') {
  return {
    location: { href, origin: ORIGIN },
    document: { referrer },
    matchMedia: (query: string) => ({ matches: standalone && query === '(display-mode: standalone)' }),
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  } as unknown as Window;
}

describe('Decarboxulator installed-app identity', () => {
  it('does not confuse a forum PWA window with Decarboxulator', () => {
    const storage = new Map<string, string>();
    const win = appWindow(ROOT, true, storage, 'https://forum.example/thread');
    expect(isOurAppWindow(win, {} as Navigator, '/')).toBe(false);
    expect(storage.size).toBe(0);
  });

  it('recognizes its own manifest launch and retains only tab-scoped evidence', () => {
    const storage = new Map<string, string>();
    const launch = appWindow(ROOT + '?dcxr_launch=studio-v4', true, storage);
    expect(isOurAppWindow(launch, {} as Navigator, '/')).toBe(true);
    expect(isOurAppWindow(appWindow(ROOT + 'faq/', true, storage), {} as Navigator, '/')).toBe(true);
    expect(isOurAppWindow(appWindow(ROOT, true, new Map()), {} as Navigator, '/')).toBe(false);
    expect(isOurAppWindow(appWindow(ROOT, false, storage), {} as Navigator, '/')).toBe(false);
  });

  it('rejects spoofed, cross-site and non-app launches', () => {
    expect(isOwnLaunch(ROOT + '?dcxr_launch=studio-v4', ROOT, false)).toBe(false);
    expect(isOwnLaunch(ROOT + '?dcxr_launch=other', ROOT, true)).toBe(false);
    expect(isOwnLaunch(ROOT + 'faq/?dcxr_launch=studio-v4', ROOT, true)).toBe(false);
    expect(isOwnLaunch(ROOT + '?dcxr_launch=studio-v4', ROOT, true, 'https://forum.example/')).toBe(false);
    expect(isOwnLaunch('https://other.example/?dcxr_launch=studio-v4', ROOT, true)).toBe(false);
  });

  it('requires this PWA identity instead of accepting any installed app', () => {
    expect(isOurRelatedApp({ platform: 'webapp', id: 'https://forum.example/' }, ROOT, MANIFEST)).toBe(false);
    expect(isOurRelatedApp({ platform: 'play', id: ROOT }, ROOT, MANIFEST)).toBe(false);
    expect(isOurRelatedApp({ platform: 'webapp', id: ROOT }, ROOT, MANIFEST)).toBe(true);
    expect(isOurRelatedApp({ platform: 'webapp', url: MANIFEST }, ROOT, MANIFEST)).toBe(true);
    expect(isOurRelatedApp({ platform: 'webapp', url: MANIFEST + '?v=pwa-identity-2' }, ROOT, MANIFEST)).toBe(true);
    expect(isOurRelatedApp({ platform: 'webapp', url: MANIFEST + '?v=lime-chrome-1' }, ROOT, MANIFEST)).toBe(true);
    expect(isOurRelatedApp({ platform: 'webapp', url: MANIFEST + '?v=unrelated' }, ROOT, MANIFEST)).toBe(false);
    expect(isOurRelatedApp({ platform: 'webapp', id: 'https://other.example/', url: MANIFEST }, ROOT, MANIFEST)).toBe(false);
  });

  it('treats missing, empty or failing installation APIs as unknown', async () => {
    expect(await verifyRelatedInstallation({} as Navigator, '/', ORIGIN)).toBe(false);
    const app = (getInstalledRelatedApps: () => Promise<unknown>) =>
      ({ getInstalledRelatedApps } as unknown as Navigator);
    expect(await verifyRelatedInstallation(app(vi.fn(async () => [])), '/', ORIGIN)).toBe(false);
    expect(await verifyRelatedInstallation(app(vi.fn(async () => [{ platform: 'webapp', id: 'https://forum.example/' }])), '/', ORIGIN)).toBe(false);
    expect(await verifyRelatedInstallation(app(vi.fn(async () => [{ platform: 'webapp', id: ROOT }])), '/', ORIGIN)).toBe(true);
    expect(await verifyRelatedInstallation(app(vi.fn(async () => { throw new Error('Unsupported'); })), '/', ORIGIN)).toBe(false);
  });

  it('works for GitHub Pages project-scoped installs without cross-origin matching', async () => {
    const githubRoot = 'https://thelabcorner.github.io/decarboxulator/';
    const nav = { getInstalledRelatedApps: async () => [{ platform: 'webapp', id: githubRoot }] } as unknown as Navigator;
    expect(await verifyRelatedInstallation(nav, '/decarboxulator/', 'https://thelabcorner.github.io')).toBe(true);
    expect(await verifyRelatedInstallation(nav, '/', 'https://thelabcorner.github.io')).toBe(false);
  });
});
