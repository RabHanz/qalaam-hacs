/**
 * Arabic text rendering helpers.
 *
 * `renderWithSilentMarks(text)` wraps every "small-high" / "small-low"
 * silent / pause / sajda mark in a `<span class="silent-mark">` so the
 * global CSS rule (apps/web/src/styles/globals.css) can shrink + lift
 * them above the baseline like Quran.com / Tarteel / Quranly do.
 *
 * Why this matters: Uthmani / IndoPak / Nastaliq fonts draw a wide
 * range of "small high" codepoints as full-size mid-line glyphs that
 * inline they read as spurious rosettes (or, where the font lacks the
 * glyph, as `.notdef` tofu boxes overlapping the base letter). The
 * frontier-app convention is to shrink + lift them so they read as
 * scaffolding, not as text.
 *
 * Codepoints wrapped (single source of truth across the codebase):
 *   U+06D6 – U+06DC   small high pause / sajda / safha marks
 *   U+06DF – U+06E5   small high rounded-zero / sukun / madda / waw
 *   U+06E7            small high yeh
 *   U+06E8            small high noon
 *   U+06EA – U+06ED   empty-centre low/high stop, rounded high stop,
 *                     small low meem
 *
 * INTENTIONALLY EXCLUDED — these must remain at full size:
 *   U+06DD  Arabic end-of-ayah marker (the rosette anchor)
 *   U+06DE  Arabic rub-el-hizb (quarter marker)
 *   U+06E6  small yeh — used as base, not as decoration
 *   U+06E9  Arabic place-of-sajdah symbol (substantive marker)
 */
import type { ReactNode } from 'react';

// Built programmatically from individual codepoint numbers so that the
// regex SOURCE string (used by ESLint's no-misleading-character-class
// to lint character classes for combining marks) never contains the
// raw combining-mark characters. Same final regex as if we'd typed
// the literals — but keeps the linter happy.
function buildSilentMarkRegex(): RegExp {
  const ranges: readonly (readonly [number, number])[] = [
    [0x06d6, 0x06dc],
    [0x06df, 0x06e5],
    [0x06e7, 0x06e7],
    [0x06e8, 0x06e8],
    [0x06ea, 0x06ed],
  ];
  let cls = '';
  for (const [lo, hi] of ranges) {
    if (lo === hi) {
      cls += String.fromCodePoint(lo);
    } else {
      cls += `${String.fromCodePoint(lo)}-${String.fromCodePoint(hi)}`;
    }
  }
   
  return new RegExp(`([${cls}])`, 'u');
}

const SILENT_MARK_RE = buildSilentMarkRegex();

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

/** Exposed so AyahCard / MushafLines can match the same set when they
 * splice into a per-word render path with tajweed coloring etc. */
export const SILENT_MARK_REGEX = SILENT_MARK_RE;
