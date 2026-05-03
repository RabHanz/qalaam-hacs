/**
 * Public types for `@qalaam/azkar`.
 *
 * Hadith grading is mandatory for non-Quran adhkar. We ship `sahih` (authentic)
 * and `hasan` (good) only — `da'if` (weak) narrations are excluded from the
 * default catalog rather than shipped with a warning, because once shipped users
 * recite them without checking the grade. (See `Docs/STRATEGY_AND_ROADMAP.md`
 * §21 — adab non-negotiables.)
 */

export type ZikrCategory =
  | 'morning'
  | 'evening'
  | 'post-salah'
  | 'sleep'
  | 'wake'
  | 'ruqyah'
  | 'general'
  // Situational — Hisn al-Muslim "yawm wa laylah" set:
  | 'entering-home'
  | 'leaving-home'
  | 'before-eating'
  | 'after-eating'
  | 'entering-bathroom'
  | 'leaving-bathroom'
  | 'wudu'
  | 'travel'
  | 'mounting-vehicle'
  | 'distress'
  | 'rain'
  | 'gathering-end';

/**
 * Hadith authenticity grading.
 * `quran` is used when the zikr is itself a Quran verse (no hadith grading needed).
 */
export type HadithGrading = 'quran' | 'sahih' | 'hasan';

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
  /** Hadith authenticity grade. Required to ship. */
  readonly grading: HadithGrading;
  /** Optional notes when grading needs nuance (e.g., "Bukhari 6306, declared sahih by Albani"). */
  readonly gradingNotes?: string;
  /** Optional Quranic verse-key when the zikr is itself an ayah. */
  readonly verseKey?: string;
}
