/**
 * `@qalaam/azkar` — categorized azkar lookup + scheduling helpers.
 */
import { SEED_AZKAR } from './catalog/seed.js';
import type { Zikr, ZikrCategory } from './types.js';

export type { Zikr, ZikrCategory };

/** All azkar bundled with v0.1. */
export const AZKAR: readonly Zikr[] = SEED_AZKAR;

/** Azkar in a specific category, deterministic order. */
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
 * (roughly 6 seconds per arabic word, plus 2 seconds per translation read).
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
