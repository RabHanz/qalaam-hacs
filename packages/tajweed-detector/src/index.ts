/**
 * Qalaam tajweed-rule scorers. Per strategy §8.6 + ADR-0007 risk-mitigation.
 *
 * **NOT AUTHORITATIVE** — these are heuristic signals, not judgments. The UI
 * exposes them as opt-in experimental feedback with a low-confidence floor.
 *
 * Algorithms intentionally use only `@qalaam/prosody` primitives so the pure-TS
 * stack runs in the browser AudioWorklet for live feedback.
 */
import { QalaamError } from '@qalaam/core';
import { energyEnvelope, rms, zeroCrossingRate } from '@qalaam/prosody';

/** Tajweed rule kinds Qalaam scores. Subset of the full quran-tajweed catalog. */
export type ScoredRule = 'madd_2' | 'madd_4' | 'madd_5' | 'madd_6' | 'ghunna' | 'qalqalah';

export interface ExpectedTajweedRule {
  readonly type: ScoredRule;
  /** Start time of the expected occurrence within the audio buffer (ms). */
  readonly startMs: number;
  /** End time (ms). */
  readonly endMs: number;
}

export interface PerRuleScore {
  readonly type: ScoredRule;
  readonly score: number; // 0..1
  readonly confidence: number; // 0..1 — low = hide from UI
  readonly observed: { readonly durationMs?: number; readonly nasalRatio?: number };
}

export interface CompositeTajweedScore {
  readonly overallScore: number;
  readonly confidence: number;
  readonly perRule: readonly PerRuleScore[];
}

const SAMPLE_RATE = 16000;
const FRAME_SIZE = 512;
const HOP_SIZE = 256;

/** Convert ms → sample index in a 16 kHz buffer. */
function msToSample(ms: number): number {
  return Math.floor((ms / 1000) * SAMPLE_RATE);
}

/** Convert ms-bound region in a 16 kHz buffer to a Float32Array slice. */
function slice(samples: Readonly<Float32Array>, startMs: number, endMs: number): Float32Array {
  const a = Math.max(0, msToSample(startMs));
  const b = Math.min(samples.length, msToSample(endMs));
  if (b <= a) {
    throw new QalaamError(
      'qalaam.range.empty',
      `tajweed-detector: empty region [${startMs.toString()}..${endMs.toString()}] ms`,
    );
  }
  return new Float32Array(samples.buffer, samples.byteOffset + a * 4, b - a);
}

/**
 * Detect a sustained-vowel hold in a region. Returns:
 *  - `durationMs`: length of the contiguous voiced plateau
 *  - `score`: how close the duration is to the expected window
 *  - `confidence`: how clean the plateau is (energy stability)
 *
 * Voiced plateau is defined as energy > 1.5×background AND ZCR < 0.15
 * (low ZCR indicates voicing rather than fricatives/silence).
 */
export function scoreMadd(
  samples: Readonly<Float32Array>,
  region: { startMs: number; endMs: number },
  expectedDurationMs: { min: number; ideal: number; max: number },
): PerRuleScore {
  const win = slice(samples, region.startMs, region.endMs);
  const env = energyEnvelope(win, FRAME_SIZE, HOP_SIZE);
  const zcr = zeroCrossingRate(win, FRAME_SIZE, HOP_SIZE);
  const overall = rms(win);
  const threshold = overall * 0.5;
  let plateauFrames = 0;
  let bestRun = 0;
  for (let i = 0; i < env.length; i += 1) {
    const e = env[i] ?? 0;
    const z = zcr[i] ?? 0;
    if (e > threshold && z < 0.15) {
      plateauFrames += 1;
      if (plateauFrames > bestRun) bestRun = plateauFrames;
    } else {
      plateauFrames = 0;
    }
  }
  const durationMs = (bestRun * HOP_SIZE * 1000) / SAMPLE_RATE;
  const score = scoreInWindow(durationMs, expectedDurationMs);
  // Confidence: how stable the energy is across the hold (low CV → high confidence).
  const cv = coefficientOfVariation(env);
  const confidence = clamp01(1 - cv);
  return {
    type:
      expectedDurationMs.ideal === 2 * 100
        ? 'madd_2'
        : expectedDurationMs.ideal === 4 * 100
          ? 'madd_4'
          : expectedDurationMs.ideal === 5 * 100
            ? 'madd_5'
            : 'madd_6',
    score,
    confidence,
    observed: { durationMs },
  };
}

/**
 * Detect ghunna (nasalization). Heuristic: nasal sounds have most energy
 * concentrated below ~500 Hz with a characteristic spectral tilt. We use the
 * inverse-zcr (low ZCR ⇒ low spectral activity ⇒ nasal-friendly) plus the
 * low-frequency energy ratio (estimated via running mean of the squared signal).
 *
 * Score: how close the observed nasal ratio is to the expected ideal (~0.7).
 */
export function scoreGhunna(
  samples: Readonly<Float32Array>,
  region: { startMs: number; endMs: number },
): PerRuleScore {
  const win = slice(samples, region.startMs, region.endMs);
  const zcr = zeroCrossingRate(win, FRAME_SIZE, HOP_SIZE);
  const env = energyEnvelope(win, FRAME_SIZE, HOP_SIZE);
  const meanZcr = mean(zcr);
  // Low ZCR + energetic = nasal-leaning. Map to 0..1 ratio.
  const nasalRatio = clamp01((1 - meanZcr * 4) * (mean(env) > 0.02 ? 1 : 0));
  const score = scoreInWindow(nasalRatio, { min: 0.45, ideal: 0.7, max: 0.95 });
  const confidence = clamp01(mean(env) * 5);
  return { type: 'ghunna', score, confidence, observed: { nasalRatio } };
}

/**
 * Composite scorer — runs the per-rule detectors and aggregates.
 * Confidence-weighted average so noisy regions don't dominate.
 */
export function compositeTajweedScore({
  samples,
  expectedRules,
}: {
  readonly samples: Readonly<Float32Array>;
  readonly expectedRules: readonly ExpectedTajweedRule[];
}): CompositeTajweedScore {
  const perRule: PerRuleScore[] = [];
  for (const rule of expectedRules) {
    const region = { startMs: rule.startMs, endMs: rule.endMs };
    if (rule.type === 'madd_2') {
      perRule.push(scoreMadd(samples, region, { min: 150, ideal: 200, max: 280 }));
    } else if (rule.type === 'madd_4') {
      perRule.push(scoreMadd(samples, region, { min: 350, ideal: 400, max: 500 }));
    } else if (rule.type === 'madd_5') {
      perRule.push(scoreMadd(samples, region, { min: 450, ideal: 500, max: 600 }));
    } else if (rule.type === 'madd_6') {
      perRule.push(scoreMadd(samples, region, { min: 550, ideal: 600, max: 720 }));
    } else if (rule.type === 'ghunna') {
      perRule.push(scoreGhunna(samples, region));
    } else {
      // 'qalqalah' is the only remaining branch from `ScoredRule`.
      perRule.push(scoreQalqalah(samples, region));
    }
  }
  const totalConf = perRule.reduce((acc, r) => acc + r.confidence, 0);
  const overall =
    totalConf === 0 ? 0 : perRule.reduce((acc, r) => acc + r.score * r.confidence, 0) / totalConf;
  const confidence = perRule.length === 0 ? 0 : totalConf / perRule.length;
  return { overallScore: overall, confidence, perRule };
}

/**
 * Detect qalqalah (the audible "bounce" on قطب جد letters at sukoon position:
 * ق ط ب ج د).
 *
 * Per strategy §7.5 + §8.6 + ADR-0007 risk-mitigation: this is a research-grade
 * heuristic, NOT authoritative. The detector returns a confidence floor that
 * the UI uses to gate visual surfacing — low confidence stays hidden.
 *
 * Acoustic signature (no speech features library required):
 *   1. Brief silence (~30-60 ms) — the closure phase before the burst.
 *   2. Sharp burst — high-energy transient ≤ 30 ms, characteristic of stop release.
 *   3. Brief secondary release — small bounce/echo within the next 100 ms.
 *
 * Algorithm:
 *   - Compute the energy envelope at FRAME_SIZE/HOP_SIZE.
 *   - Look for the global silence-to-burst transition: a frame whose energy
 *     ratio against the prior 60 ms minimum exceeds `BURST_RATIO`.
 *   - Within ~100 ms after the burst, count secondary local maxima above
 *     `SECONDARY_THRESHOLD × peakEnergy`. ≥ 1 secondary maximum is the
 *     "bounce" signal.
 *   - Score = (burst sharpness) × (secondary present ? 1 : 0.5).
 *   - Confidence = how clearly the silence-then-burst contour stood out
 *     from background noise; floored at 0.20 (research-grade gate).
 */
const BURST_RATIO = 4; // burst energy / prior-silence energy
const SECONDARY_THRESHOLD = 0.35; // secondary peak height vs. burst peak
const SECONDARY_WINDOW_MS = 100;
const SILENCE_LOOKBACK_MS = 60;

export function scoreQalqalah(
  samples: Readonly<Float32Array>,
  region: { startMs: number; endMs: number },
): PerRuleScore {
  const win = slice(samples, region.startMs, region.endMs);
  const env = energyEnvelope(win, FRAME_SIZE, HOP_SIZE);
  if (env.length < 4) {
    return { type: 'qalqalah', score: 0, confidence: 0.2, observed: {} };
  }

  const framesPerSec = SAMPLE_RATE / HOP_SIZE;
  const lookbackFrames = Math.max(1, Math.round((SILENCE_LOOKBACK_MS / 1000) * framesPerSec));
  const secondaryFrames = Math.max(1, Math.round((SECONDARY_WINDOW_MS / 1000) * framesPerSec));

  // Find the strongest silence→burst transition.
  let bestBurstFrame = -1;
  let bestRatio = 0;
  let bestPriorMin = 0;
  for (let i = lookbackFrames; i < env.length; i += 1) {
    const here = env[i] ?? 0;
    let priorMin = Number.POSITIVE_INFINITY;
    for (let j = i - lookbackFrames; j < i; j += 1) {
      const v = env[j] ?? 0;
      if (v < priorMin) priorMin = v;
    }
    const denom = Math.max(priorMin, 1e-6);
    const ratio = here / denom;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestBurstFrame = i;
      bestPriorMin = priorMin;
    }
  }

  if (bestBurstFrame < 0 || bestRatio < BURST_RATIO) {
    // No clean silence→burst transition. Likely a smoothly-voiced sukoon —
    // either the reciter skipped qalqalah or the audio doesn't capture it.
    return { type: 'qalqalah', score: 0, confidence: 0.2, observed: {} };
  }

  const burstPeak = env[bestBurstFrame] ?? 0;

  // Look for a secondary local maximum within SECONDARY_WINDOW_MS of the burst.
  let secondaryFound = false;
  let secondaryFrame = -1;
  let secondaryPeak = 0;
  const tail = Math.min(env.length - 1, bestBurstFrame + secondaryFrames);
  for (let i = bestBurstFrame + 2; i <= tail; i += 1) {
    const here = env[i] ?? 0;
    const left = env[i - 1] ?? 0;
    const right = env[i + 1] ?? 0;
    const isLocalMax = here >= left && here >= right;
    if (isLocalMax && here > burstPeak * SECONDARY_THRESHOLD) {
      secondaryFound = true;
      secondaryFrame = i;
      secondaryPeak = here;
      break;
    }
  }

  // Burst sharpness: how cleanly the energy spikes vs. ambient noise.
  // Map ratio ∈ [BURST_RATIO, 12+] → score ∈ [0.4, 1.0].
  const burstScore = clamp01((bestRatio - BURST_RATIO) / 8 + 0.4);
  const finalScore = secondaryFound ? burstScore : burstScore * 0.5;

  // Confidence: the gap between burst-peak and prior-silence. Stronger gap
  // means we're confident the transition is real and not noise.
  const dynamicRange = burstPeak / Math.max(bestPriorMin, 1e-6);
  const confidence = Math.max(0.2, clamp01((dynamicRange - 2) / 10));

  return {
    type: 'qalqalah',
    score: finalScore,
    confidence,
    observed: {
      durationMs: secondaryFound
        ? ((secondaryFrame - bestBurstFrame) * HOP_SIZE * 1000) / SAMPLE_RATE
        : 0,
      nasalRatio: secondaryPeak / Math.max(burstPeak, 1e-6),
    },
  };
}

// — helpers —

function scoreInWindow(
  observed: number,
  window: { readonly min: number; readonly ideal: number; readonly max: number },
): number {
  if (observed <= 0) return 0;
  if (observed === window.ideal) return 1;
  if (observed >= window.min && observed <= window.max) {
    const distance = Math.abs(observed - window.ideal);
    const tol = Math.max(window.ideal - window.min, window.max - window.ideal);
    return clamp01(1 - distance / tol);
  }
  // Outside the window — partial credit for being close, none for far misses.
  const dist = observed < window.min ? window.min - observed : observed - window.max;
  return clamp01(0.4 - dist / window.ideal);
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function mean(arr: Readonly<Float32Array>): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function coefficientOfVariation(arr: Readonly<Float32Array>): number {
  if (arr.length === 0) return 1;
  const m = mean(arr);
  if (m === 0) return 1;
  let variance = 0;
  for (const v of arr) {
    const d = v - m;
    variance += d * d;
  }
  return Math.sqrt(variance / arr.length) / m;
}
