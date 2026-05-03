/**
 * Pure-TS prosody primitives. No WebAssembly, no Python — runs in any V8 + DOM.
 *
 * Per strategy §8.5: feature set mirrors librosa's primitives; sophistication
 * comes from how the teach-back UI uses them.
 */
import { QalaamError } from '@qalaam/core';

/** Root-mean-square energy of a sample window. Values in [0, 1] for normalized PCM. */
export function rms(samples: Readonly<Float32Array>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/** Per-frame energy envelope. Returns one RMS value per frame. */
export function energyEnvelope(
  samples: Readonly<Float32Array>,
  frameSize = 1024,
  hopSize = 512,
): Float32Array {
  if (frameSize <= 0 || hopSize <= 0) {
    throw new QalaamError('qalaam.range.empty', 'frameSize and hopSize must be positive');
  }
  const frames = Math.max(0, Math.floor((samples.length - frameSize) / hopSize) + 1);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    out[i] = rms(samples.subarray(i * hopSize, i * hopSize + frameSize));
  }
  return out;
}

/** Zero-crossing rate per frame — cheap voicedness proxy. */
export function zeroCrossingRate(
  samples: Readonly<Float32Array>,
  frameSize = 1024,
  hopSize = 512,
): Float32Array {
  const frames = Math.max(0, Math.floor((samples.length - frameSize) / hopSize) + 1);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let crossings = 0;
    const start = i * hopSize;
    for (let j = start + 1; j < start + frameSize; j += 1) {
      if (((samples[j - 1] ?? 0) >= 0) !== ((samples[j] ?? 0) >= 0)) {
        crossings += 1;
      }
    }
    out[i] = crossings / frameSize;
  }
  return out;
}

interface PitchOpts {
  readonly minHz?: number;
  readonly maxHz?: number;
}

/**
 * Estimate F0 (fundamental frequency) per frame via autocorrelation.
 *
 * Returns 0 for unvoiced frames. Tuned for adult Arabic recitation range
 * (default 80-400 Hz). For a child voice, pass `maxHz: 600`.
 */
export function pitchAutocorr(
  samples: Readonly<Float32Array>,
  sampleRate: number,
  opts: PitchOpts & { frameSize?: number; hopSize?: number } = {},
): Float32Array {
  const minHz = opts.minHz ?? 80;
  const maxHz = opts.maxHz ?? 400;
  const frameSize = opts.frameSize ?? 1024;
  const hopSize = opts.hopSize ?? 512;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);
  const frames = Math.max(0, Math.floor((samples.length - frameSize) / hopSize) + 1);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f += 1) {
    const start = f * hopSize;
    const win = samples.subarray(start, start + frameSize);
    let bestLag = 0;
    let bestVal = 0;
    for (let lag = minLag; lag <= maxLag && lag < frameSize; lag += 1) {
      let acc = 0;
      for (let i = 0; i + lag < frameSize; i += 1) {
        acc += (win[i] ?? 0) * (win[i + lag] ?? 0);
      }
      if (acc > bestVal) {
        bestVal = acc;
        bestLag = lag;
      }
    }
    out[f] = bestLag > 0 ? sampleRate / bestLag : 0;
  }
  return out;
}

/**
 * Dynamic time warping distance between two equally-shaped sequences (typically
 * F0 contours). O(n*m) memory; cap n,m ≤ 2048 for the live UI path.
 */
export function dtwDistance(
  a: Readonly<Float32Array>,
  b: Readonly<Float32Array>,
  options: { readonly distance?: (x: number, y: number) => number } = {},
): number {
  const dist = options.distance ?? ((x: number, y: number) => Math.abs(x - y));
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;
  // Rolling two-row DP for memory efficiency.
  const prev = new Float64Array(m + 1).fill(Infinity);
  const curr = new Float64Array(m + 1).fill(Infinity);
  prev[0] = 0;
  for (let i = 1; i <= n; i += 1) {
    curr[0] = Infinity;
    for (let j = 1; j <= m; j += 1) {
      const cost = dist(a[i - 1] ?? 0, b[j - 1] ?? 0);
      const minPrev = Math.min(prev[j] ?? Infinity, curr[j - 1] ?? Infinity, prev[j - 1] ?? Infinity);
      curr[j] = cost + minPrev;
    }
    prev.set(curr);
  }
  return prev[m] ?? Infinity;
}

export interface ProsodyComparison {
  readonly score: number; // 0..1
  readonly pitchAlignment: number; // 0..1
  readonly energyCorrelation: number; // -1..1
}

/**
 * Composite score 0..1 used by the teach-back UI.
 * Sophistication intentionally minimal — driven by the matrix from §8.5.
 */
export function prosodyScore({
  userPitch,
  targetPitch,
  userEnergy,
  targetEnergy,
}: {
  readonly userPitch: Readonly<Float32Array>;
  readonly targetPitch: Readonly<Float32Array>;
  readonly userEnergy: Readonly<Float32Array>;
  readonly targetEnergy: Readonly<Float32Array>;
}): ProsodyComparison {
  const dtw = dtwDistance(userPitch, targetPitch);
  const dtwNorm = dtw / Math.max(1, userPitch.length);
  const pitchAlignment = Math.max(0, 1 - dtwNorm / 100);
  const energyCorrelation = pearsonCorrelation(userEnergy, targetEnergy);
  // Composite: weight pitch (rhythm/melody) more than energy (loudness).
  const score = Math.max(0, Math.min(1, 0.7 * pitchAlignment + 0.3 * (energyCorrelation + 1) / 2));
  return { score, pitchAlignment, energyCorrelation };
}

function pearsonCorrelation(a: Readonly<Float32Array>, b: Readonly<Float32Array>): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += a[i] ?? 0;
    sumB += b[i] ?? 0;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i += 1) {
    const dA = (a[i] ?? 0) - meanA;
    const dB = (b[i] ?? 0) - meanB;
    num += dA * dB;
    denomA += dA * dA;
    denomB += dB * dB;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : num / denom;
}
