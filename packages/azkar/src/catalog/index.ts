/**
 * Aggregator: combines all hand-curated, hadith-graded sub-catalogs.
 *
 * Curation principle (per CLAUDE.md "build for the foundation, not the demo"):
 * we ship only `quran`, `sahih`, or `hasan`-graded narrations. Da'if entries
 * exist in scholarship but are NOT shipped here — once an app puts a zikr in
 * front of a user, they recite it without checking; the app inherits the duty
 * of curation.
 */
import type { Zikr } from '../types.js';
import { QURAN_CORE } from './quran-core.js';
import { MORNING_EVENING } from './morning-evening.js';
import { POST_SALAH } from './post-salah.js';
import { SLEEP_WAKE } from './sleep-wake.js';
import { SITUATIONAL } from './situational.js';
import { GENERAL } from './general.js';

/**
 * Backwards-compat alias — the original `seed.ts` exposed `SEED_AZKAR`.
 * Prefer `HISN_AL_MUSLIM` going forward.
 */
export const SEED_AZKAR: readonly Zikr[] = [
  ...QURAN_CORE,
  ...MORNING_EVENING,
  ...POST_SALAH,
  ...SLEEP_WAKE,
  ...SITUATIONAL,
  ...GENERAL,
];

/** Canonical Hisn al-Muslim aggregate (post-curation). */
export const HISN_AL_MUSLIM = SEED_AZKAR;
