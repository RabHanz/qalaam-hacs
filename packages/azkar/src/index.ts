/**
 * `@qalaam/azkar` — categorized azkar lookup + scheduling helpers.
 *
 * Catalog is hadith-graded (only `quran`, `sahih`, `hasan` ship). See
 * `./catalog/index.ts` for the curation principle.
 */
import { HISN_AL_MUSLIM, SEED_AZKAR } from './catalog/index.js';
import type { HadithGrading, Zikr, ZikrCategory } from './types.js';

export type { HadithGrading, Zikr, ZikrCategory };

/** All azkar bundled with this version of `@qalaam/azkar`. */
export const AZKAR: readonly Zikr[] = HISN_AL_MUSLIM;

// Re-exports for callers that want the hand-curated bundles directly.
export { HISN_AL_MUSLIM, SEED_AZKAR };

/** Azkar in a specific category, deterministic order (catalog order). */
export function azkarByCategory(category: ZikrCategory): readonly Zikr[] {
  return AZKAR.filter((z) => z.categories.includes(category));
}

/** Look up by id; throws if unknown. */
export function azkarById(id: string): Zikr {
  const found = AZKAR.find((z) => z.id === id);
  if (!found) throw new Error(`Unknown zikr id: ${id}`);
  return found;
}

/**
 * Total estimated minutes to recite a category at a moderate pace
 * (roughly 6 seconds per arabic word, multiplied by the count).
 * Used by the smart-home scheduler to budget the morning/evening slot.
 */
export function estimatedMinutes(category: ZikrCategory): number {
  const list = azkarByCategory(category);
  const seconds = list.reduce((acc, z) => {
    const words = z.arabic.split(/\s+/).length * z.count;
    return acc + words * 6;
  }, 0);
  return Math.ceil(seconds / 60);
}

/** Sanity helper: confirms the catalog is grading-clean (only sahih/hasan/quran). */
export function ungradedAzkar(): readonly Zikr[] {
  const allowed = new Set<HadithGrading>(['quran', 'sahih', 'hasan']);
  return AZKAR.filter((z) => !allowed.has(z.grading));
}
