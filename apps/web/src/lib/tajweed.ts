/**
 * Annotation-driven tajweed colorizer.
 *
 * Source data: cpfair/quran-tajweed (MIT) — 60,057 character-range
 * annotations across 6,236 ayahs in 18 rule types. Served by
 * GET /v1/tajweed/:verseKey. Frontend caches the response per ayah
 * and applies CSS classes from the .tajweed-* palette to the matched
 * character ranges in the verse text.
 *
 * This replaces the older regex approximation — the rules below are
 * authoritative for Hafs Uthmani recitation.
 */

export type TajweedRule =
  | 'ghunnah'
  | 'qalqalah'
  | 'hamzat_wasl'
  | 'lam_shamsiyyah'
  | 'silent'
  | 'madd_2'
  | 'madd_246'
  | 'madd_6'
  | 'madd_munfasil'
  | 'madd_muttasil'
  | 'ikhfa'
  | 'ikhfa_shafawi'
  | 'idghaam_ghunnah'
  | 'idghaam_no_ghunnah'
  | 'idghaam_shafawi'
  | 'idghaam_mutajanisayn'
  | 'idghaam_mutaqaribayn'
  | 'iqlab';

export interface TajweedAnnotation {
  readonly start: number;
  readonly end: number;
  readonly rule: TajweedRule;
}

export interface TajweedSegment {
  readonly text: string;
  readonly rule?: TajweedRule;
}

/**
 * Apply non-overlapping tajweed annotations to a verse's text and
 * return a list of {text, rule?} segments suitable for React rendering.
 *
 * Annotations from the upstream source are character-range pairs
 * (start, end) into the FULL ayah text. Ranges may be adjacent. We
 * walk the text, emitting un-annotated chunks between matches and
 * annotated chunks for each match.
 */
export function applyTajweed(
  text: string,
  annotations: readonly TajweedAnnotation[],
): readonly TajweedSegment[] {
  if (annotations.length === 0) return [{ text }];
  const sorted = [...annotations].sort((a, b) => a.start - b.start);
  const out: TajweedSegment[] = [];
  let cursor = 0;
  for (const a of sorted) {
    if (a.start < cursor) continue; // skip overlaps (defensive)
    if (a.start > cursor) {
      out.push({ text: text.slice(cursor, a.start) });
    }
    out.push({ text: text.slice(a.start, a.end), rule: a.rule });
    cursor = a.end;
  }
  if (cursor < text.length) {
    out.push({ text: text.slice(cursor) });
  }
  return out;
}

/**
 * Map a (verseKey → annotations[]) cache built up as the user reads.
 * Lives in module scope so it survives component remounts.
 */
const cache = new Map<string, readonly TajweedAnnotation[]>();

export function getCachedTajweed(verseKey: string): readonly TajweedAnnotation[] | undefined {
  return cache.get(verseKey);
}

export async function fetchTajweed(
  apiBase: string,
  verseKey: string,
): Promise<readonly TajweedAnnotation[]> {
  const cached = cache.get(verseKey);
  if (cached) return cached;
  try {
    const res = await fetch(`${apiBase}/v1/tajweed/${encodeURIComponent(verseKey)}`);
    if (!res.ok) {
      cache.set(verseKey, []);
      return [];
    }
    const body = (await res.json()) as { annotations: readonly TajweedAnnotation[] };
    cache.set(verseKey, body.annotations);
    return body.annotations;
  } catch {
    cache.set(verseKey, []);
    return [];
  }
}
