import { describe, expect, it } from 'vitest';

import { KAABA, qiblaBearing } from '../src/qibla.js';

describe('qiblaBearing', () => {
  it('London → roughly 119° (SE-ish)', () => {
    const b = qiblaBearing({ lat: 51.5074, lng: -0.1278 });
    expect(b).toBeGreaterThan(115);
    expect(b).toBeLessThan(125);
  });

  it('New York → roughly 58° (NE-ish)', () => {
    const b = qiblaBearing({ lat: 40.7128, lng: -74.006 });
    expect(b).toBeGreaterThan(54);
    expect(b).toBeLessThan(64);
  });

  it('At Kaaba, bearing is well-defined', () => {
    const b = qiblaBearing({ lat: KAABA.lat + 0.001, lng: KAABA.lng });
    expect(Number.isFinite(b)).toBe(true);
  });
});
