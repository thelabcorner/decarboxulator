/**
 * Production-only offline shell. Never register a worker during Vite development:
 * caching live HMR modules would compromise the editor experience.
 */
export function registerOfflineStudio(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = new URL('sw.js', base);
  const register = () => {
    void navigator.serviceWorker.register(url, {
      scope: base.pathname,
      updateViaCache: 'none',
    }).catch(() => {
      // Storage restrictions and blocked service workers must never break the studio.
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
