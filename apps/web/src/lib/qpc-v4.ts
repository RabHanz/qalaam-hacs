/**
 * KFGQPC V4 PUA-encoded verse fetcher (parallel to lib/tajweed.ts).
 *
 * Backend: GET /v1/qpc-text/:verseKey?layout=v4 returns the canonical
 * KFGQPC V4 1441H Madinah text encoded as PUA codepoints
 * (U+FC41-U+FC64) with a per-verse `pageNumber` and `fontFamily`
 * (`QPCv4Page<N>`). Each of the 604 mushaf pages has its own COLR/CPAL
 * color font with that page's tajweed colors baked into the glyph
 * tables — rendering with the correct page-specific font reproduces
 * the printed Madinah V4 mushaf bit-for-bit, no CSS overlay required.
 *
 * Module-level cache survives remounts so MushafPage / AyahCard /
 * ShareCard / etc. don't each refetch the same verse.
 */

export interface QpcV4Word {
  readonly wordIndex: number;
  readonly text: string;
}

export interface QpcV4Verse {
  readonly pageNumber: number | null;
  readonly fontFamily: string | null;
  readonly words: readonly QpcV4Word[];
}

const cache = new Map<string, QpcV4Verse>();
const inflight = new Map<string, Promise<QpcV4Verse>>();

const EMPTY: QpcV4Verse = { pageNumber: null, fontFamily: null, words: [] };

export function getCachedQpcV4(verseKey: string): QpcV4Verse | undefined {
  return cache.get(verseKey);
}

/**
 * Fetch the V4 PUA encoding for a verse. Returns an empty Verse on any
 * error so callers can fall back to the CSS-overlay tajweed path
 * without exception handling at every site.
 */
export async function fetchQpcV4(apiBase: string, verseKey: string): Promise<QpcV4Verse> {
  const cached = cache.get(verseKey);
  if (cached) return cached;
  const pending = inflight.get(verseKey);
  if (pending) return pending;
  const p = (async (): Promise<QpcV4Verse> => {
    try {
      const res = await fetch(`${apiBase}/v1/qpc-text/${encodeURIComponent(verseKey)}?layout=v4`);
      if (!res.ok) {
        cache.set(verseKey, EMPTY);
        return EMPTY;
      }
      const body = (await res.json()) as QpcV4Verse;
      const out: QpcV4Verse = {
        pageNumber: body.pageNumber,
        fontFamily: body.fontFamily,
        words: body.words,
      };
      cache.set(verseKey, out);
      return out;
    } catch {
      cache.set(verseKey, EMPTY);
      return EMPTY;
    } finally {
      inflight.delete(verseKey);
    }
  })();
  inflight.set(verseKey, p);
  return p;
}

/**
 * `kfgqpc_v4` and the legacy `tajweed` slug both render with the V4
 * COLR pipeline. Helper so every consumer agrees on the predicate.
 */
export function isTajweedLayout(layoutSlug: string | undefined): boolean {
  return layoutSlug === 'kfgqpc_v4' || layoutSlug === 'tajweed';
}
