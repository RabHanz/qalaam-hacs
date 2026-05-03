import { describe, expect, it } from 'vitest';

import {
  LESSONS,
  LEVEL_META,
  isUnlocked,
  lessonById,
  lessonsByLevel,
  levelDurationMinutes,
} from '../src/index.js';

describe('@qalaam/curriculum (4-level catalog)', () => {
  it('Level 1 has 28 letters + 4 vowel marks = 32 lessons', () => {
    const level1 = lessonsByLevel(1);
    expect(level1).toHaveLength(32);
    expect(level1[0]?.slug).toBe('letter-alif');
    expect(level1[27]?.slug).toBe('letter-yaa');
    expect(level1[28]?.slug).toBe('vowel-fatha');
  });

  it('Level 2 has the tajweed-fundamentals catalog (≥ 35 lessons)', () => {
    const list = lessonsByLevel(2);
    expect(list.length).toBeGreaterThanOrEqual(35);
    expect(list[0]?.slug).toBe('makhraj-overview');
  });

  it('Level 3 has connected-recitation lessons (≥ 28)', () => {
    const list = lessonsByLevel(3);
    expect(list.length).toBeGreaterThanOrEqual(28);
    expect(list[0]?.slug).toBe('fluency-warmups');
  });

  it('Level 4 is Pro and has the qiraat + mastery track', () => {
    const list = lessonsByLevel(4);
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(LEVEL_META[4].isPro).toBe(true);
    expect(list.find((l) => l.slug === 'qiraat-hafs')).toBeDefined();
  });

  it('every lesson has a unique id', () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    expect(ids.size).toBe(LESSONS.length);
  });

  it('every prereq points to a lesson that exists', () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    for (const l of LESSONS) {
      for (const pre of l.prerequisiteLessonIds) {
        expect(ids.has(pre), `${l.id} references missing prereq ${pre}`).toBe(true);
      }
    }
  });

  it('lookup by id, slug, and level/slug all work', () => {
    expect(lessonById('l1-letter-alif').slug).toBe('letter-alif');
    expect(lessonById('letter-alif').id).toBe('l1-letter-alif');
    expect(lessonById('2/madd-asli').id).toBe('l2-madd-asli');
  });

  it('isUnlocked respects prerequisites', () => {
    const ba = lessonById('letter-baa');
    expect(isUnlocked(ba, new Set())).toBe(false);
    expect(isUnlocked(ba, new Set(['l1-letter-alif']))).toBe(true);
  });

  it('every level has a non-trivial duration', () => {
    expect(levelDurationMinutes(1)).toBeGreaterThanOrEqual(100);
    expect(levelDurationMinutes(2)).toBeGreaterThan(200);
    expect(levelDurationMinutes(3)).toBeGreaterThan(200);
    expect(levelDurationMinutes(4)).toBeGreaterThan(100);
  });
});
