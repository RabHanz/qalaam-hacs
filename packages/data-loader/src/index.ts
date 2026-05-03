/**
 * `@qalaam/data-loader` — local data substrate.
 *
 * Per ADR-0002: QUL SQLite is canonical; cpfair/quran-align fills reciter gaps;
 * quran/quran-tajweed provides per-character rule annotations.
 *
 * Designed for offline-first operation. The online QF fallback lives in
 * `@qalaam/api-client-ts`.
 */
export * from './qul/index.js';
export * from './quran-align/index.js';
export * from './quran-tajweed/index.js';
