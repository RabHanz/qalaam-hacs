import { describe, expect, it } from 'vitest';

import { schemaIds, validate } from '../src/index.js';

describe('@qalaam/schema — round-trip validation', () => {
  it('loads every schema with a stable $id', () => {
    expect(Object.keys(schemaIds).length).toBeGreaterThan(0);
    for (const [key, id] of Object.entries(schemaIds)) {
      expect(typeof id).toBe('string');
      expect(id).toContain('qalaam.app/schemas/');
      expect(id.endsWith(`${key}.schema.json`)).toBe(true);
    }
  });

  it('validates Al-Fatiha v1 against Verse', () => {
    const verseKeyId = 'https://qalaam.app/schemas/quran/Verse.schema.json';
    const fatiha1 = {
      verseKey: '1:1',
      surah: 1,
      ayah: 1,
      juz: 1,
      hizb: 1,
      rubElHizb: 1,
      ruku: 1,
      manzil: 1,
      pageMadani15: 1,
      textUthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      wordCount: 4,
      isSajdah: false,
    };
    const result = validate(verseKeyId, fatiha1);
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid verseKey', () => {
    const verseKeyId = 'https://qalaam.app/schemas/quran/Verse.schema.json';
    const broken = {
      verseKey: '999:9999',
      surah: 999,
      ayah: 9999,
      textUthmani: 'x',
    };
    const result = validate(verseKeyId, broken);
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });

  it('validates a MistakeEvent without audio fields (privacy boundary)', () => {
    const mistakeId = 'https://qalaam.app/schemas/hifdh/MistakeEvent.schema.json';
    const ev = {
      id: '00000000-0000-4000-8000-000000000001',
      portionId: '00000000-0000-4000-8000-000000000002',
      verseKey: '2:255',
      wordIndex: 5,
      errorType: 'mutashabihat-swap',
      swappedToVerseKey: '3:2',
      reciterId: 'mishary-alafasy',
      timestamp: '2026-05-02T10:30:00.000Z',
      userOverridden: false,
    };
    const result = validate(mistakeId, ev);
    expect(result.valid).toBe(true);
  });
});
