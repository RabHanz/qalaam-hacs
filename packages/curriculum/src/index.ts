/**
 * `@qalaam/curriculum` — public surface (4 levels per strategy §9.1).
 */
import { LEVEL_1_LESSONS } from './catalog/level1-alphabet.js';
import { LEVEL_2_LESSONS } from './catalog/level2-tajweed.js';
import { LEVEL_3_LESSONS } from './catalog/level3-recitation.js';
import { LEVEL_4_LESSONS } from './catalog/level4-mastery.js';
import type { CurriculumLevel, Lesson } from './types.js';

export type { CurriculumLevel, Lesson, LessonKind } from './types.js';

/** All lessons in canonical order across all four levels. */
export const LESSONS: readonly Lesson[] = [
  ...LEVEL_1_LESSONS,
  ...LEVEL_2_LESSONS,
  ...LEVEL_3_LESSONS,
  ...LEVEL_4_LESSONS,
];

/** Lessons within a level, in order. */
export function lessonsByLevel(level: CurriculumLevel): readonly Lesson[] {
  return LESSONS.filter((l) => l.level === level).sort((a, b) => a.order - b.order);
}

/** Look up a lesson by id, slug, or `level/slug` shortcut. */
export function lessonById(idOrSlug: string): Lesson {
  const found = LESSONS.find(
    (l) => l.id === idOrSlug || l.slug === idOrSlug || `${String(l.level)}/${l.slug}` === idOrSlug,
  );
  if (!found) throw new Error(`Unknown lesson id: ${idOrSlug}`);
  return found;
}

/** True if the user has completed every prerequisite. */
export function isUnlocked(lesson: Lesson, completedLessonIds: ReadonlySet<string>): boolean {
  return lesson.prerequisiteLessonIds.every((id) => completedLessonIds.has(id));
}

/** Total estimated minutes for a level (informational; UI shows "≈ X hours"). */
export function levelDurationMinutes(level: CurriculumLevel): number {
  return lessonsByLevel(level).reduce((acc, l) => acc + l.estimatedMinutes, 0);
}

/** Per-level metadata for UI labels. */
export const LEVEL_META: Record<CurriculumLevel, { title: string; description: string; isPro: boolean }> = {
  1: {
    title: 'Alphabet & Pronunciation',
    description: 'Letters, vowel marks, joining, basic word formation.',
    isPro: false,
  },
  2: {
    title: 'Tajweed Fundamentals',
    description:
      'Articulation points, letter qualities, the rules of Noon Sakinah, Meem Sakinah, Madd, Qalqalah, Lam, Ghunnah, Raa, and Waqf marks.',
    isPro: false,
  },
  3: {
    title: 'Connected Recitation',
    description:
      'Fluency drills, intermediate surahs (Mulk, Yāsīn, Ar-Raḥmān, Al-Kahf), waqf practice, an introduction to maqāmāt.',
    isPro: false,
  },
  4: {
    title: 'Advanced Mastery',
    description:
      'Qirāʾāt comparison (Hafs / Warsh / Qālūn / Dūrī / Shuʿba / Khalaf), Hifdh-engine-integrated juz mastery, ijāzah preparation.',
    isPro: true,
  },
};
