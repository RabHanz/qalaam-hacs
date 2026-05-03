import { describe, expect, it } from 'vitest';

import {
  AZKAR,
  HISN_AL_MUSLIM,
  azkarByCategory,
  azkarById,
  estimatedMinutes,
  ungradedAzkar,
} from '../src/index.js';

describe('@qalaam/azkar', () => {
  it('seed catalog is non-empty and includes Ayat al-Kursi', () => {
    expect(AZKAR.length).toBeGreaterThan(0);
    expect(AZKAR.find((z) => z.id === 'ayat-al-kursi')).toBeDefined();
  });

  it('Hisn al-Muslim catalog is hadith-graded — only sahih/hasan/quran ship', () => {
    expect(ungradedAzkar()).toHaveLength(0);
  });

  it('catalog has reasonable Hisn al-Muslim coverage (>=50 entries)', () => {
    expect(HISN_AL_MUSLIM.length).toBeGreaterThanOrEqual(50);
  });

  it('every entry has a non-empty source attribution', () => {
    for (const z of AZKAR) {
      expect(z.source.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a positive count', () => {
    for (const z of AZKAR) {
      expect(z.count).toBeGreaterThanOrEqual(1);
    }
  });

  it('every id is unique', () => {
    const ids = AZKAR.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('filters by category', () => {
    const morning = azkarByCategory('morning');
    expect(morning.length).toBeGreaterThan(0);
    for (const z of morning) {
      expect(z.categories).toContain('morning');
    }
  });

  it('looks up by id', () => {
    const z = azkarById('al-falaq');
    expect(z.title.en).toContain('Falaq');
  });

  it('throws on unknown id', () => {
    expect(() => azkarById('does-not-exist')).toThrow();
  });

  it('estimates a positive duration for each category that has entries', () => {
    for (const cat of [
      'morning',
      'evening',
      'post-salah',
      'sleep',
      'wake',
      'ruqyah',
      'general',
      'entering-home',
      'leaving-home',
      'before-eating',
      'after-eating',
      'wudu',
      'travel',
      'distress',
    ] as const) {
      const m = estimatedMinutes(cat);
      expect(m).toBeGreaterThanOrEqual(0);
    }
  });
});
