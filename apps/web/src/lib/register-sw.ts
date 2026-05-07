/**
 * Service worker registration helper.
 *
 * Called once from RootLayout via a tiny client island. Idempotent:
 * the browser only installs the SW the first time, subsequent calls
 * are no-ops. Skipped entirely on `localhost` for dev ergonomics —
 * an SW caching the dev shell makes hot-reload behave weirdly.
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Skip registration on dev so HMR / hot-reload aren't sabotaged
  // by a previously-installed SW that's caching the old shell.
  // Production builds (NEXT_PUBLIC_ENV === 'production' OR a real
  // hostname) install normally.
  const host = window.location.hostname;
  const isLocalDev = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (isLocalDev) return;

  const onLoad = (): void => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* registration failed — site still works without SW */
    });
  };
  if (document.readyState === 'complete') {
    onLoad();
  } else {
    window.addEventListener('load', onLoad, { once: true });
  }
}
