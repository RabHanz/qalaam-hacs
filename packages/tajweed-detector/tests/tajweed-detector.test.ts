import { describe, expect, it } from 'vitest';

import { compositeTajweedScore, scoreGhunna, scoreMadd } from '../src/index.js';

function buildSamples(durationSec: number, fillFn: (i: number) => number): Float32Array {
  const n = Math.floor(16000 * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = fillFn(i);
  return out;
}

const sustainedVowel = (durationSec = 0.4): Float32Array =>
  buildSamples(durationSec, (i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / 16000));

const silence = (durationSec = 0.3): Float32Array => buildSamples(durationSec, () => 0);

const noise = (durationSec = 0.3): Float32Array =>
  buildSamples(durationSec, () => (Math.random() - 0.5) * 0.6);

describe('scoreMadd', () => {
  it('detects a sustained 200ms vowel as Madd 2', () => {
    const samples = new Float32Array(0.4 * 16000);
    samples.set(sustainedVowel(0.2), 0);
    const r = scoreMadd(samples, { startMs: 0, endMs: 250 }, { min: 150, ideal: 200, max: 280 });
    expect(r.type).toBe('madd_2');
    expect(r.observed.durationMs).toBeGreaterThan(100);
  });

  it('low score for silence', () => {
    const samples = silence(0.3);
    const r = scoreMadd(samples, { startMs: 0, endMs: 250 }, { min: 150, ideal: 200, max: 280 });
    expect(r.score).toBeLessThan(0.5);
  });
});

describe('scoreGhunna', () => {
  it('produces a score and confidence in [0,1] for sustained signal', () => {
    const r = scoreGhunna(sustainedVowel(0.2), { startMs: 0, endMs: 200 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('low confidence for silence', () => {
    const r = scoreGhunna(silence(0.3), { startMs: 0, endMs: 200 });
    expect(r.confidence).toBeLessThan(0.3);
  });
});

describe('compositeTajweedScore', () => {
  it('aggregates perRule with confidence-weighted average', () => {
    const samples = new Float32Array(0.6 * 16000);
    samples.set(sustainedVowel(0.2), 0);
    samples.set(sustainedVowel(0.2), Math.floor(0.3 * 16000));
    const r = compositeTajweedScore({
      samples,
      expectedRules: [
        { type: 'madd_2', startMs: 0, endMs: 250 },
        { type: 'ghunna', startMs: 300, endMs: 500 },
      ],
    });
    expect(r.perRule).toHaveLength(2);
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.overallScore).toBeLessThanOrEqual(1);
  });

  it('qalqalah always returns low-confidence neutral score (research-grade)', () => {
    const r = compositeTajweedScore({
      samples: noise(0.3),
      expectedRules: [{ type: 'qalqalah', startMs: 0, endMs: 200 }],
    });
    expect(r.perRule[0]?.confidence).toBeLessThanOrEqual(0.2);
    expect(r.perRule[0]?.score).toBeCloseTo(0.5, 1);
  });

  it('handles empty rule list cleanly', () => {
    const r = compositeTajweedScore({ samples: silence(), expectedRules: [] });
    expect(r.overallScore).toBe(0);
    expect(r.perRule).toHaveLength(0);
  });
});
