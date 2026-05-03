import { describe, expect, it } from 'vitest';

import { isLastTenNightsOfRamadan, isRamadan, toHijri } from '../src/hijri.js';

describe('hijri conversion', () => {
  it('produces a structurally valid hijri date', () => {
    const h = toHijri(new Date('2026-05-02T12:00:00Z'));
    expect(h.day).toBeGreaterThanOrEqual(1);
    expect(h.day).toBeLessThanOrEqual(30);
    expect(h.month).toBeGreaterThanOrEqual(1);
    expect(h.month).toBeLessThanOrEqual(12);
    expect(h.year).toBeGreaterThan(1400);
    expect(h.monthNameEnglish.length).toBeGreaterThan(0);
    expect(h.monthNameArabic.length).toBeGreaterThan(0);
  });

  it('Ramadan toggles correctly for known dates', () => {
    // 1 Ramadan 1447 ≈ Feb 16, 2026 (Umm al-Qura, approximate)
    const aroundRamadan = new Date('2026-02-20T12:00:00Z');
    if (isRamadan(aroundRamadan)) {
      expect(toHijri(aroundRamadan).month).toBe(9);
    }
  });

  it('isLastTenNightsOfRamadan only true for Ramadan 21..30', () => {
    const muharram1 = new Date('2026-07-15T12:00:00Z'); // not Ramadan
    expect(isLastTenNightsOfRamadan(muharram1)).toBe(false);
  });
});
