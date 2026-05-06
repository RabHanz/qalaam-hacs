/**
 * Buckwalter ↔ Arabic conversion. Single source of truth — used by
 * /roots, /concordance/root/:root, MorphologyPane, /grammar.
 *
 * Reference: Tim Buckwalter's transliteration scheme (the same one
 * the Quranic Arabic Corpus, Tarteel's tooling, and quran.com
 * morphology data all use). Each ASCII char maps to a single Arabic
 * letter; non-ASCII chars pass through (so a hyphen-separated
 * `k-t-b` round-trips to the same display, just spaced).
 */
const BW_TO_AR: Record<string, string> = {
  "'": 'ء',
  '|': 'آ',
  '>': 'أ',
  '&': 'ؤ',
  '<': 'إ',
  '}': 'ئ',
  A: 'ا',
  b: 'ب',
  p: 'ة',
  t: 'ت',
  v: 'ث',
  j: 'ج',
  H: 'ح',
  x: 'خ',
  d: 'د',
  '*': 'ذ',
  r: 'ر',
  z: 'ز',
  s: 'س',
  $: 'ش',
  S: 'ص',
  D: 'ض',
  T: 'ط',
  Z: 'ظ',
  E: 'ع',
  g: 'غ',
  f: 'ف',
  q: 'ق',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  h: 'ه',
  w: 'و',
  Y: 'ى',
  y: 'ي',
};

/** Buckwalter root → Arabic letterforms separated by U+200C ZWNJ so
 * the calligraphy renders each radical as its own form (otherwise
 * `k+t+b` joins into a single shape). */
export function rootToArabic(bw: string): string {
  const cleaned = bw.replace(/[^A-Za-z']/g, '');
  return cleaned
    .split('')
    .map((c) => BW_TO_AR[c] ?? c)
    .join('‌'); // ZWNJ keeps each radical isolated
}

/** Strip non-Buckwalter chars (hyphens, spaces) — for canonical
 * lookup keys. */
export function canonicalRoot(input: string): string {
  return input.replace(/[^A-Za-z']/g, '');
}

/** First Arabic letter of a Buckwalter root — used to bucket roots
 * by initial radical for the alphabet index. */
export function rootInitialArabic(bw: string): string | null {
  const c = canonicalRoot(bw)[0];
  return c ? (BW_TO_AR[c] ?? null) : null;
}
