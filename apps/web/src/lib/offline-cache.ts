/**
 * offline-cache — page-side prefetch helpers that write into the
 * same `qalaam-audio-v1` cache the service worker reads from.
 *
 * The service worker's runtime fetch handler already caches anything
 * the user passively plays. This module gives the user explicit
 * agency: "save THIS surah for the flight tomorrow."
 *
 * Why caches.open from the page works:
 *   - The Cache API is shared between the page and the service worker
 *     for the same origin. cache.put() from the page is visible to the
 *     SW and vice versa.
 *   - We're not touching opaque cross-origin responses (the audio CDN
 *     serves CORS headers — verified earlier in this session).
 */

import { verseCountFor } from './playback-store.js';

const AUDIO_CACHE_NAME = 'qalaam-audio-v1';
const PREFETCH_CONCURRENCY = 6;

export interface PrefetchProgress {
  total: number;
  completed: number;
  /** Bytes successfully downloaded so far (a lower-bound). */
  bytes: number;
  /** Set when at least one verse failed; non-fatal — the rest carry on. */
  errors: number;
}

export interface PrefetchHandle {
  promise: Promise<PrefetchProgress>;
  /** Cancel an in-flight prefetch. The cache is left in whatever
   *  partial state it reached — same-name re-runs continue from
   *  there because cache.put is idempotent. */
  cancel(): void;
}

/**
 * Resolve every audio URL for a surah via the Qalaam API, then push
 * each into the audio cache. Concurrency-limited so we don't pin the
 * browser's per-origin connection budget.
 *
 * `apiBase` is the same-origin /api proxy URL.
 */
export function prefetchSurahAudio(
  apiBase: string,
  surah: number,
  reciterSlug: string,
  onProgress?: (p: PrefetchProgress) => void,
): PrefetchHandle {
  const verseCount = verseCountFor(surah);
  if (verseCount <= 0) {
    return {
      promise: Promise.resolve({ total: 0, completed: 0, bytes: 0, errors: 0 }),
      cancel: () => undefined,
    };
  }

  const controller = new AbortController();
  const verseKeys: string[] = Array.from(
    { length: verseCount },
    (_, i) => `${surah.toString()}:${(i + 1).toString()}`,
  );

  const promise = (async () => {
    const progress: PrefetchProgress = {
      total: verseCount,
      completed: 0,
      bytes: 0,
      errors: 0,
    };
    if (typeof caches === 'undefined') {
      // Cache API unavailable (very old browsers). Mark all as errors;
      // the SW would have caught them on play anyway.
      progress.errors = verseCount;
      onProgress?.(progress);
      return progress;
    }
    const cache = await caches.open(AUDIO_CACHE_NAME);

    let cursor = 0;
    async function worker(): Promise<void> {
      for (;;) {
        if (controller.signal.aborted) return;
        const idx = cursor;
        cursor += 1;
        if (idx >= verseKeys.length) return;
        const vk = verseKeys[idx];
        if (!vk) return;
        try {
          // Resolve the audio URL via the Qalaam API.
          const res = await fetch(
            `${apiBase}/v1/audio/by_verse/${encodeURIComponent(vk)}/${reciterSlug}`,
            { signal: controller.signal },
          );
          if (!res.ok) throw new Error(`audio resolver ${res.status.toString()}`);
          const body = (await res.json()) as { audioUrl?: string };
          const url = body.audioUrl;
          if (!url) throw new Error('audio resolver: empty url');

          // Skip if already in cache.
          const existing = await cache.match(url);
          if (existing) {
            progress.completed += 1;
            // Approximate bytes from cached response if possible.
            const len = existing.headers.get('content-length');
            if (len) progress.bytes += Number.parseInt(len, 10) || 0;
            onProgress?.({ ...progress });
            continue;
          }

          // Fetch + cache the audio bytes.
          const audioRes = await fetch(url, { signal: controller.signal });
          if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status.toString()}`);
          // Read content-length OR clone + count bytes.
          const len = audioRes.headers.get('content-length');
          if (len) progress.bytes += Number.parseInt(len, 10) || 0;
          await cache.put(url, audioRes.clone());
          progress.completed += 1;
          onProgress?.({ ...progress });
        } catch (err) {
          if ((err as { name?: string }).name === 'AbortError') return;
          progress.errors += 1;
          progress.completed += 1; // count toward total so progress reaches 100%
          onProgress?.({ ...progress });
        }
      }
    }

    const workers: Promise<void>[] = [];
    for (let i = 0; i < PREFETCH_CONCURRENCY; i += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);
    return progress;
  })();

  return {
    promise,
    cancel: () => {
      controller.abort();
    },
  };
}

/**
 * Storage estimate via the StorageManager API. Returns null when the
 * browser doesn't support it (some older Safaris).
 */
export interface StorageEstimateResult {
  usageBytes: number | null;
  quotaBytes: number | null;
  /** Just our audio cache — useful as a more-precise sub-figure. */
  audioCacheBytes: number;
  audioCacheCount: number;
}

export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (typeof navigator !== 'undefined') {
      const e = await navigator.storage.estimate();
      usageBytes = typeof e.usage === 'number' ? e.usage : null;
      quotaBytes = typeof e.quota === 'number' ? e.quota : null;
    }
  } catch {
    /* ignore */
  }

  let audioCacheBytes = 0;
  let audioCacheCount = 0;
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const keys = await cache.keys();
      audioCacheCount = keys.length;
      // For each cached entry, prefer the content-length header
      // since we cached responses with the upstream headers intact.
      // Sum is a lower bound; the actual on-disk footprint may be
      // marginally larger due to cache metadata overhead.
      for (const req of keys) {
        const res = await cache.match(req);
        if (!res) continue;
        const len = res.headers.get('content-length');
        if (len) audioCacheBytes += Number.parseInt(len, 10) || 0;
      }
    }
  } catch {
    /* ignore */
  }

  return { usageBytes, quotaBytes, audioCacheBytes, audioCacheCount };
}

/**
 * Wipe the audio cache. Useful for the "Clear cache" affordance in
 * settings. Returns the number of entries deleted.
 */
export async function clearAudioCache(): Promise<number> {
  try {
    if (typeof caches === 'undefined') return 0;
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    await Promise.all(keys.map((k) => cache.delete(k)));
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Quick "is the active surah cached for this reciter?" check. Used by
 * the OfflineSurahButton to render either "Save offline" or "✓ Saved".
 *
 * Heuristic: we count how many of the surah's verse audio URLs are in
 * the cache by hitting our own /v1/audio resolver to get the URL list,
 * then probing the cache with cache.match. Cheap (one fetch) for
 * surahs we've already shown the user, since the resolver responses
 * are themselves cached by the SW under qalaam-api-v1.
 */
export async function isSurahFullyCached(
  apiBase: string,
  surah: number,
  reciterSlug: string,
): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  const verseCount = verseCountFor(surah);
  if (verseCount <= 0) return false;
  const cache = await caches.open(AUDIO_CACHE_NAME);
  // Sample-probe the first + last verse — cheap and accurate enough
  // for a status pill. A user who deletes a single ayah from the
  // middle of a saved surah will see the pill stay green; the next
  // play will refetch that one verse via runtime caching.
  const samples = [`${surah.toString()}:1`, `${surah.toString()}:${verseCount.toString()}`];
  for (const vk of samples) {
    try {
      const res = await fetch(
        `${apiBase}/v1/audio/by_verse/${encodeURIComponent(vk)}/${reciterSlug}`,
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { audioUrl?: string };
      if (!body.audioUrl) return false;
      const cached = await cache.match(body.audioUrl);
      if (!cached) return false;
    } catch {
      return false;
    }
  }
  return true;
}
