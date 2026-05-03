/**
 * Public types. Mirror the @qalaam/types-ts Lesson schema fields we actually use.
 */

export type CurriculumLevel = 1 | 2 | 3 | 4;

export type LessonKind =
  | 'letter-introduction'
  | 'vowel-mark'
  | 'tajweed-rule'
  | 'ayah-practice'
  | 'surah-mastery'
  | 'concept';

export interface Lesson {
  readonly id: string;
  readonly slug: string;
  readonly level: CurriculumLevel;
  readonly order: number;
  readonly title: { en: string; ar?: string };
  readonly kind: LessonKind;
  readonly tajweedRule?: string;
  readonly verseRange?: { startVerseKey: string; endVerseKey: string };
  readonly estimatedMinutes: number;
  readonly prerequisiteLessonIds: readonly string[];
}
