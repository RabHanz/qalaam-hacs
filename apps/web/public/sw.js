/**
 * Qalaam service worker — runtime caching for offline-capable Quran.
 *
 * Per-resource cache strategy:
 *
 *   navigation requests          network-first → cached shell on offline
 *   /_next/static + /fonts       cache-first (immutable, hashed filenames)
 *   /api/v1/metadata*            stale-while-revalidate
 *   /api/v1/verses/*             stale-while-revalidate
 *   /api/v1/translations/*       stale-while-revalidate
 *   /api/v1/recitations/*        stale-while-revalidate (segments only)
 *   /api/v1/audio/*              stale-while-revalidate (URL resolver)
 *   audio.qurancdn.com           cache-first, capped LRU (~120 entries)
 *   download.quranicaudio.com    same
 *   everyayah.com                same
 *   verses.quran.com             same
 *
 *   everything else              network-only (no caching)
 *
 * NOT cached: POST/PUT/DELETE, /v1/auth/*, /v1/admin/*, /v1/playback/*,
 * /v1/family/*. Authenticated + mutation paths must always hit network
 * so a refresh after offline reflects the latest state.
 *
 * Cache versioning: bump CACHE_VERSION to invalidate everything in
 * one shot when the shell semantics change. Old caches deleted on
 * activate.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `qalaam-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `qalaam-static-${CACHE_VERSION}`;
const API_CACHE = `qalaam-api-${CACHE_VERSION}`;
const AUDIO_CACHE = `qalaam-audio-${CACHE_VERSION}`;

// Capped audio cache size — eviction is LRU-ish, walking the
// keys() array and trimming the oldest entries past the cap.
const AUDIO_CACHE_MAX = 120;

const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, API_CACHE, AUDIO_CACHE];

const AUDIO_HOSTS = new Set([
  'audio.qurancdn.com',
  'download.quranicaudio.com',
  'everyayah.com',
  'verses.quran.com',
]);

// Pre-cache the bare-minimum shell so a cold offline boot hits the
// homepage. Next.js's per-route HTML is best fetched at first visit
// and then served from SHELL_CACHE on subsequent offline loads.
const SHELL_PRECACHE = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_PRECACHE))
      .catch(() => {
        /* shell precache best-effort — first nav will populate it */
      }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('qalaam-') && !ALL_CACHES.includes(n))
            .map((n) => caches.delete(n)),
        ),
      ),
  );
  self.clients.claim();
});

function shouldBypass(url) {
  // Authenticated + mutation paths — never cache.
  if (url.pathname.startsWith('/api/v1/auth')) return true;
  if (url.pathname.startsWith('/api/v1/admin')) return true;
  if (url.pathname.startsWith('/api/v1/playback')) return true;
  if (url.pathname.startsWith('/api/v1/family')) return true;
  if (url.pathname.startsWith('/api/v1/bookmarks')) return true;
  if (url.pathname.startsWith('/api/v1/hifdh')) return true;
  if (url.pathname.startsWith('/api/v1/plans')) return true;
  if (url.pathname.startsWith('/api/v1/khatm')) return true;
  if (url.pathname.startsWith('/api/v1/mistakes')) return true;
  if (url.pathname.startsWith('/api/v1/voice-notes')) return true;
  return false;
}

function isStaticAsset(url) {
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/fonts/')) return true;
  if (/\.(woff2?|ttf|otf|eot)$/i.test(url.pathname)) return true;
  return false;
}

function isCacheableApi(url) {
  if (!url.pathname.startsWith('/api/v1/')) return false;
  if (shouldBypass(url)) return false;
  return (
    url.pathname.startsWith('/api/v1/metadata') ||
    url.pathname.startsWith('/api/v1/verses') ||
    url.pathname.startsWith('/api/v1/translations') ||
    url.pathname.startsWith('/api/v1/transliterations') ||
    url.pathname.startsWith('/api/v1/recitations') ||
    url.pathname.startsWith('/api/v1/audio') ||
    url.pathname.startsWith('/api/v1/reciters') ||
    url.pathname.startsWith('/api/v1/layouts') ||
    url.pathname.startsWith('/api/v1/tafsirs') ||
    url.pathname.startsWith('/api/v1/topics') ||
    url.pathname.startsWith('/api/v1/themes') ||
    url.pathname.startsWith('/api/v1/morphology') ||
    url.pathname.startsWith('/api/v1/qpc-text') ||
    url.pathname.startsWith('/api/v1/surah-info') ||
    url.pathname.startsWith('/api/v1/mushaf-image') ||
    url.pathname.startsWith('/api/v1/mutashabihat') ||
    url.pathname.startsWith('/api/v1/wbw') ||
    url.pathname.startsWith('/api/v1/search') ||
    url.pathname.startsWith('/api/v1/chapters')
  );
}

function isAudio(url) {
  if (AUDIO_HOSTS.has(url.host)) return true;
  if (/\.(mp3|m4a|aac|ogg|opus)(\?|$)/i.test(url.pathname)) return true;
  return false;
}

async function trimCache(cacheName, max) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    const toDelete = keys.slice(0, keys.length - max);
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  } catch {
    /* cap eviction is best-effort */
  }
}

async function networkFirst(request, cacheName) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(cacheName);
      void cache.put(request, fresh.clone()).catch(() => undefined);
    }
    return fresh;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;
    // Final fallback for navigations: serve the cached homepage so
    // the SPA shell is at least visible offline. Internal SPA links
    // then resolve from later caches.
    if (request.mode === 'navigate') {
      const home = await caches.match('/');
      if (home) return home;
    }
    return Response.error();
  }
}

async function cacheFirst(request, cacheName, opts = {}) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok || (opts.allowOpaque && fresh.type === 'opaque')) {
      const cache = await caches.open(cacheName);
      await cache.put(request, fresh.clone()).catch(() => undefined);
      if (opts.maxEntries) {
        void trimCache(cacheName, opts.maxEntries);
      }
    }
    return fresh;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((fresh) => {
      if (fresh.ok) {
        void cache.put(request, fresh.clone()).catch(() => undefined);
      }
      return fresh;
    })
    .catch(() => null);
  return cached ?? (await networkPromise) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Skip extensions + non-HTTP schemes.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Authenticated/mutation paths — let the network handle it.
  if (shouldBypass(url)) return;

  // Same-origin static assets — cache-first.
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Same-origin Quran-data API — stale-while-revalidate.
  if (url.origin === self.location.origin && isCacheableApi(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Cross-origin audio CDNs — cache-first with LRU cap.
  if (isAudio(url)) {
    event.respondWith(
      cacheFirst(request, AUDIO_CACHE, { maxEntries: AUDIO_CACHE_MAX, allowOpaque: false }),
    );
    return;
  }

  // Same-origin navigation requests — network-first with cached shell
  // fallback, so updates land but offline shows the last-good HTML.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // Everything else — network only (no opaque-response caching).
});

// `postMessage({ type: 'SKIP_WAITING' })` from the page lets us
// activate a freshly-installed worker on user request without
// forcing a reload across all open tabs immediately.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
