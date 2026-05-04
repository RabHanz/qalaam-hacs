/* eslint-disable */
import { describe, expect, it } from 'vitest';

import { compositeTajweedScore, scoreGhunna, scoreMadd, scoreQalqalah } from '../src/index.js';

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

  it('qalqalah on smoothly-voiced samples returns low score (no burst detected)', () => {
    const r = compositeTajweedScore({
      samples: sustainedVowel(0.4),
      expectedRules: [{ type: 'qalqalah', startMs: 0, endMs: 350 }],
    });
    expect(r.perRule[0]?.type).toBe('qalqalah');
    expect(r.perRule[0]?.score).toBeLessThanOrEqual(0.5);
    // Confidence floor at 0.20 — research-grade gate, never above this
    // when no clean burst was found.
    expect(r.perRule[0]?.confidence).toBeLessThanOrEqual(0.5);
  });

  it('qalqalah on silence→burst returns elevated score', () => {
    // Construct a synthetic qalqalah-like signature: 80ms silence, then a
    // brief energetic burst, then a small secondary bump.
    const totalSec = 0.4;
    const samples = new Float32Array(Math.floor(16000 * totalSec));
    // Burst at ~80ms, lasting ~25ms
    const burstStart = Math.floor(0.08 * 16000);
    const burstEnd = Math.floor(0.105 * 16000);
    for (let i = burstStart; i < burstEnd; i += 1) {
      samples[i] = 0.9 * Math.sin((2 * Math.PI * 800 * i) / 16000);
    }
    // Secondary bump at ~150ms, lasting ~15ms
    const secStart = Math.floor(0.15 * 16000);
    const secEnd = Math.floor(0.165 * 16000);
    for (let i = secStart; i < secEnd; i += 1) {
      samples[i] = 0.4 * Math.sin((2 * Math.PI * 700 * i) / 16000);
    }
    const r = scoreQalqalah(samples, { startMs: 0, endMs: 350 });
    expect(r.type).toBe('qalqalah');
    expect(r.score).toBeGreaterThan(0.4);
    expect(r.confidence).toBeGreaterThanOrEqual(0.2);
  });

  it('handles empty rule list cleanly', () => {
    const r = compositeTajweedScore({ samples: silence(), expectedRules: [] });
    expect(r.overallScore).toBe(0);
    expect(r.perRule).toHaveLength(0);
  });
});
