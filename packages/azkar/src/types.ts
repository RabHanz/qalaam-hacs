/**
 * Public types for `@qalaam/azkar`.
 */

export type ZikrCategory =
  | 'morning'
  | 'evening'
  | 'post-salah'
  | 'sleep'
  | 'wake'
  | 'ruqyah'
  | 'general';

export interface Zikr {
  /** Stable slug-style identifier. */
  readonly id: string;
  readonly categories: readonly ZikrCategory[];
  /** Title (English; Arabic optional). */
  readonly title: { en: string; ar?: string };
  /** Arabic text — Uthmani script. */
  readonly arabic: string;
  /** Optional transliteration. */
  readonly transliteration?: string;
  /** English meaning. */
  readonly translationEn: string;
  /** How many times to recite. */
  readonly count: number;
  /** Source attribution (Hadith collection / Quran reference). */
  readonly source: string;
  /** Optional Quranic verse-key when the zikr is itself an ayah. */
  readonly verseKey?: string;
}
