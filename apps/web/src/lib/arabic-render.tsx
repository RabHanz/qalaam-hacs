/**
 * Arabic text rendering helpers.
 *
 * `renderWithSilentMarks(text)` wraps every "small-high" silent /
 * pause / sajda mark in a `<span class="silent-mark">` so the global
 * CSS rule (apps/web/src/styles/globals.css) can shrink + lift them
 * above the baseline like Quran.com / Tarteel / Quranly do.
 *
 * Why this matters: the UthmanicHafs font draws codepoints
 * U+06D6–U+06DC, U+06DF, and U+06E0–U+06E5 as **full-size mid-line
 * glyphs** that look like spurious rosettes inline. Frontier Quran
 * apps render them as discreet superscript dots. We mirror that.
 *
 * The end-of-ayah marker U+06DD is intentionally NOT in the strip
 * — it's the actual ayah-number anchor and should remain large.
 */
import type { ReactNode } from 'react';

// U+06D6 (small high ligature sad-lam-yeh) … U+06DC (small high seen)
// + U+06DF (small high rounded zero) + U+06E0–U+06E5 (small high
// markers). These are the pause / sajda / silent-letter markers that
// Uthmani fonts draw at full size.
const SILENT_MARK_RE = /([ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥ])/;

/**
 * Render Arabic text as a fragment, wrapping every silent-mark
 * codepoint in `<span class="silent-mark">` so the global CSS rule
 * lifts + shrinks them. Pass-through for non-Arabic strings.
 */
export function renderWithSilentMarks(text: string, keyPrefix = 'sm'): ReactNode {
  if (!text) return null;
  const parts = text.split(SILENT_MARK_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    SILENT_MARK_RE.test(p) ? (
      <span key={`${keyPrefix}-${i.toString()}`} className="silent-mark">
        {p}
      </span>
    ) : (
      <span key={`${keyPrefix}-t${i.toString()}`}>{p}</span>
    ),
  );
}
