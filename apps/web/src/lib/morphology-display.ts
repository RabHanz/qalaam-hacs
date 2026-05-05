/**
 * Morphology display helpers — single source of truth for surfacing
 * Quranic Arabic Corpus tokens, used by both `/study` (live tap-to-
 * expand reader) and `/share-card` (static screenshot). The tables
 * below ARE the canonical mapping; never duplicate or fabricate.
 *
 * Per memory `feedback_quranic_authenticity.md` (2026-05-05):
 *   - Always render the COMBINED word (concat of every token's form)
 *     as one joined glyph cluster, never just the stem.
 *   - Always render ONE chip PER TOKEN with the correct posClass.
 *   - Always surface the i'rab features (NOM, ACC, GEN, MS, FS,
 *     MOOD_IND, MOOD_SUB, MOOD_JUS, etc.) from features_json — case,
 *     gender, number, and mood are the load-bearing fields a serious
 *     learner needs.
 *   - Lemma + root must be visible; root must link to the concordance.
 *
 * Source tables are intentionally exhaustive — keep them in sync with
 * Kais Dukes' Quranic Arabic Corpus tag set (45 POS tags + ~24 feature
 * abbreviations). When QUL extends the corpus, extend here.
 */

export interface MorphologyToken {
  readonly tokenIndex: number;
  readonly tag: string;
  readonly form: string;
  readonly formBuckwalter: string;
  readonly lemma: string | null;
  readonly root: string | null;
  readonly isPrefix: boolean;
  readonly isStem: boolean;
  readonly isSuffix: boolean;
  readonly features: Record<string, unknown>;
}

export interface MorphologyWord {
  readonly wordIndex: number;
  readonly tokens: readonly MorphologyToken[];
}

/**
 * POS tag → human-readable English label. Comprehensive coverage of
 * the Kais Dukes 45-tag set as documented at corpus.quran.com.
 */
export const POS_LABEL: Record<string, string> = {
  // Nominals
  N: 'Noun',
  PN: 'Proper noun',
  ADJ: 'Adjective',
  // Verbal
  V: 'Verb',
  IMPV: 'Imperative',
  // Function words / particles
  P: 'Preposition',
  CONJ: 'Conjunction',
  SUB: 'Subordinator',
  REM: 'Resumption particle',
  CIRC: 'Circumstantial',
  RES: 'Restriction',
  EXP: 'Explanation',
  COND: 'Conditional',
  // Pronouns
  PRON: 'Pronoun',
  REL: 'Relative pronoun',
  DEM: 'Demonstrative',
  // Determiners + negation
  DET: 'Determiner',
  NEG: 'Negation',
  EXH: 'Exhortation',
  // Vocative + emphatic
  VOC: 'Vocative',
  EMPH: 'Emphatic',
  // Special
  INL: 'Quranic initials',
  ACC: 'Accusative particle',
  AVR: 'Aversion particle',
  CAUS: 'Causal particle',
  AMD: 'Amendment',
  COM: 'Comitative',
  EQ: 'Equality',
  INC: 'Inceptive',
  INT: 'Interrogative',
  PRP: 'Purpose',
  PRO: 'Prohibition',
  RET: 'Retraction',
  SUP: 'Supplemental',
  T: 'Time adverb',
  LOC: 'Location adverb',
  FUT: 'Future particle',
  ANS: 'Answer particle',
  CERT: 'Certainty',
  PREV: 'Preventive',
  INTG: 'Interrogative',
};

/**
 * POS tag → semantic color class group. Verbs warm (red/orange),
 * nouns cool (teal/blue), particles muted neutral. Matches the
 * Tarteel / Quran.com convention loosely.
 */
export function posClass(tag: string): string {
  if (tag === 'V' || tag === 'IMPV') return 'pos-verb';
  if (tag === 'N' || tag === 'PN') return 'pos-noun';
  if (tag === 'ADJ') return 'pos-adj';
  if (tag === 'PRON' || tag === 'REL' || tag === 'DEM') return 'pos-pronoun';
  if (tag === 'P' || tag === 'CONJ' || tag === 'SUB' || tag === 'REM' || tag === 'CIRC') {
    return 'pos-particle';
  }
  if (tag === 'DET') return 'pos-det';
  if (tag === 'NEG' || tag === 'PRO') return 'pos-neg';
  return 'pos-other';
}

/**
 * I'rab feature-key → human-readable label. Surfaces case, gender,
 * number, definiteness, mood, voice, tense — the load-bearing fields
 * a serious learner needs to read i'rab correctly.
 */
export const FEATURE_LABEL: Record<string, string> = {
  // Case
  NOM: 'nominative · مرفوع',
  ACC: 'accusative · منصوب',
  GEN: 'genitive · مجرور',
  // Gender + number
  M: 'masculine',
  F: 'feminine',
  MS: 'masc · sing',
  FS: 'fem · sing',
  MD: 'masc · dual',
  FD: 'fem · dual',
  MP: 'masc · plural',
  FP: 'fem · plural',
  // Verbal mood + voice + form
  MOOD_IND: 'indicative · مرفوع',
  MOOD_SUB: 'subjunctive · منصوب',
  MOOD_JUS: 'jussive · مجزوم',
  ACT: 'active voice',
  PASS: 'passive voice',
  // Person
  '1ST': '1st person',
  '2ND': '2nd person',
  '3RD': '3rd person',
  // Definiteness
  DEF: 'definite (al-)',
  INDEF: 'indefinite',
  // Verb tense / aspect
  PERF: 'perfect tense',
  IMPF: 'imperfect tense',
  IMPV: 'imperative',
};

/**
 * Convert a feature key+value pair into a chip label. Boolean-true
 * features render their key directly; non-boolean values render
 * `KEY:value`. Falls back to known FEATURE_LABEL when present.
 */
export function featureChipLabel(key: string, value: unknown): string {
  if (FEATURE_LABEL[key]) return FEATURE_LABEL[key];
  if (typeof value === 'boolean') return key;
  return `${key}:${String(value)}`;
}

/**
 * Filter the noisy feature-json keys that aren't user-facing
 * (STEM/PREFIX/SUFFIX flags + redundant POS/LEM/ROOT echoes). Returns
 * the [key, value] pairs in display order.
 */
export function displayableFeatures(
  features: Record<string, unknown>,
): readonly [string, unknown][] {
  const HIDDEN = new Set(['STEM', 'PREFIX', 'SUFFIX', 'POS', 'LEM', 'ROOT']);
  return Object.entries(features).filter(([k]) => !HIDDEN.has(k));
}

/**
 * Decode Buckwalter lemma marker — strip the `{` (alif-wasl) prefix
 * for display so "{ll~ah" reads as "Allah".
 */
export function lemmaDisplay(lemma: string): string {
  return lemma.replace(/^\{/, '').replace(/[~`]/g, '');
}

/**
 * Buckwalter root → human-readable Arabic. Used when surfacing roots
 * inline in the grammar grid so the reader can see the Arabic root
 * (e.g. `rHm` → `ر ح م`) alongside the Latin transliteration.
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
export function rootBuckwalterToArabic(bw: string): string {
  return bw
    .split('')
    .map((c) => BW_TO_AR[c] ?? c)
    .join(' ');
}

/** Token role short-label for the chip subhead (prefix/stem/suffix). */
export function tokenRoleLabel(t: MorphologyToken): string | null {
  if (t.isPrefix) return 'prefix';
  if (t.isStem) return 'stem';
  if (t.isSuffix) return 'suffix';
  return null;
}
