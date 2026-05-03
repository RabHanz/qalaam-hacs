import { describe, expect, it } from 'vitest';

import { dtwDistance, energyEnvelope, pitchAutocorr, prosodyScore, rms, zeroCrossingRate } from '../src/index.js';

function sine(freqHz: number, durationSec: number, sampleRate = 16000): Float32Array {
  const n = Math.floor(sampleRate * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  return out;
}

describe('prosody primitives', () => {
  it('rms of silence is 0', () => {
    expect(rms(new Float32Array(1024))).toBe(0);
  });

  it('rms of a sine is ~ 0.7071 (1/√2)', () => {
    const r = rms(sine(440, 0.1));
    expect(r).toBeCloseTo(Math.SQRT1_2, 1);
  });

  it('energyEnvelope produces one frame per hop', () => {
    const env = energyEnvelope(sine(440, 1.0), 1024, 512);
    expect(env.length).toBeGreaterThan(20);
  });

  it('zeroCrossingRate of silence is 0', () => {
    const z = zeroCrossingRate(new Float32Array(2048));
    for (const v of z) expect(v).toBe(0);
  });

  it('pitchAutocorr recovers a clean sine within ~10%', () => {
    const samples = sine(220, 0.5, 16000);
    const f0 = pitchAutocorr(samples, 16000, { minHz: 100, maxHz: 400 });
    const voiced = [...f0].filter((x) => x > 0);
    const mean = voiced.reduce((a, b) => a + b, 0) / Math.max(1, voiced.length);
    expect(Math.abs(mean - 220) / 220).toBeLessThan(0.1);
  });

  it('dtwDistance of a sequence to itself is 0', () => {
    const a = new Float32Array([1, 2, 3, 4, 5]);
    expect(dtwDistance(a, a)).toBe(0);
  });

  it('dtwDistance is symmetric', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 4]);
    expect(dtwDistance(a, b)).toBeCloseTo(dtwDistance(b, a), 6);
  });

  it('prosodyScore is 1 for identical signals', () => {
    const pitch = new Float32Array([100, 110, 120, 110, 100]);
    const energy = new Float32Array([0.5, 0.6, 0.7, 0.6, 0.5]);
    const r = prosodyScore({ userPitch: pitch, targetPitch: pitch, userEnergy: energy, targetEnergy: energy });
    expect(r.score).toBeCloseTo(1, 1);
  });
});
