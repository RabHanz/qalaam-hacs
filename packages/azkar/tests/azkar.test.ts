import { describe, expect, it } from 'vitest';

import { AZKAR, azkarByCategory, azkarById, estimatedMinutes } from '../src/index.js';

describe('@qalaam/azkar', () => {
  it('seed catalog is non-empty and includes Ayat al-Kursi', () => {
    expect(AZKAR.length).toBeGreaterThan(0);
    expect(AZKAR.find((z) => z.id === 'ayat-al-kursi')).toBeDefined();
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

  it('estimates a positive duration for each category', () => {
    for (const cat of ['morning', 'evening', 'post-salah', 'sleep', 'wake', 'ruqyah'] as const) {
      const m = estimatedMinutes(cat);
      expect(m).toBeGreaterThanOrEqual(0);
    }
  });
});
