/**
 * Arabic text rendering helpers.
 *
 * `renderWithSilentMarks(text)` wraps every truly-DECORATIVE pause /
 * sajda mark in a `<span class="silent-mark">` so the global CSS rule
 * (apps/web/src/styles/globals.css) can shrink + lift them above the
 * baseline — the way Quran.com / Tarteel / Quranly do.
 *
 * CRITICAL: this regex covers ONLY decorative scaffolding (waqf,
 * sajda, iqlab indicators). It does NOT include substantive Uthmani
 * orthography (sukun, madda, replacement waw) — those MUST stay at
 * full size or the reading is broken. An earlier version greedily
 * shrank U+06E1 sukun + U+06E4 madda + U+06E5 waw, which is what the
 * user kept reporting as "obnoxious markers" — actually the markers
 * weren't obnoxious, they were correctly-large *substantive*
 * orthography that we were wrongly trying to hide.
 *
 * Codepoints wrapped (DECORATIVE — shrunk):
 *   U+06D6 – U+06DC   small high pause / sajda / safha marks
 *                     (sad-lam-yeh, qaf-lam-yeh, meem-initial,
 *                      lam-alef, jeem, three-dots, seen)
 *   U+06DF            small high rounded zero (saktah-zero waqf)
 *   U+06E0            small high upright rectangular zero (saktah)
 *   U+06E2            small high meem isolated form (iqlab)
 *   U+06E3            small low seen (decorative gloss)
 *   U+06E7            small high yeh (decorative)
 *   U+06E8            small high noon (decorative)
 *   U+06EA – U+06EC   empty-centre low/high stops, rounded high stop
 *   U+06ED            small low meem (iqlab indicator)
 *
 * INTENTIONALLY EXCLUDED — substantive orthography (full size):
 *   U+06DD  Arabic end-of-ayah marker (the rosette anchor)
 *   U+06DE  Arabic rub-el-hizb (quarter marker — substantive)
 *   U+06E1  small high dotless head of khah — Uthmani sukun
 *           ("no vowel here" — substantive). Quran.com keeps full size.
 *   U+06E4  small high madda — vowel elongation. Substantive.
 *   U+06E5  small waw — replacement waw. Substantive.
 *   U+06E6  small yeh — base letter, not decoration.
 *   U+06E9  Arabic place-of-sajdah symbol (substantive).
 */
import type { ReactNode } from 'react';

// Built programmatically from numeric codepoints so the regex SOURCE
// string never contains literal combining marks → eslint's
// no-misleading-character-class is satisfied without a noisy disable.
function buildSilentMarkRegex(): RegExp {
  const ranges: readonly (readonly [number, number])[] = [
    [0x06d6, 0x06dc], // pause / sajda / safha marks
    [0x06df, 0x06e0], // saktah waqf zeros (NOT 06E1 sukun)
    [0x06e2, 0x06e3], // small high meem-iso, small low seen
    [0x06e7, 0x06e8], // small high yeh, small high noon
    [0x06ea, 0x06ed], // empty-centre stops, rounded high stop, small low meem
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

// Codepoints that should render BELOW the baseline (small-LOW marks),
// not above. These need positive translateY (push down), opposite of
// the small-high marks. Critical: U+06ED (small low meem) on words
// like ٱنتِقَامٍۭ — when given the same `translateY(-1em)` as small-high
// marks, it floats up onto the م letter and causes the visual overlap
// the user kept reporting. Treating it as a low-mark fixes that.
//   U+06E3  small low seen  (low-position diacritic)
//   U+06EA  empty-centre low stop
//   U+06ED  small low meem  (iqlab indicator — ALWAYS low position)
const LOW_MARKS = new Set([0x06e3, 0x06ea, 0x06ed]);

function classForMark(codepoint: number): string {
  return LOW_MARKS.has(codepoint) ? 'silent-mark silent-mark-low' : 'silent-mark';
}

/**
 * Render Arabic text as a fragment, wrapping every decorative mark
 * codepoint in `<span class="silent-mark">` so the global CSS rule
 * shrinks them. Low-position marks (U+06ED etc.) get an extra
 * `silent-mark-low` modifier so they render below the baseline
 * instead of being lifted up.
 *
 * Pass-through for non-Arabic strings.
 */
export function renderWithSilentMarks(text: string, keyPrefix = 'sm'): ReactNode {
  if (!text) return null;
  const parts = text.split(SILENT_MARK_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) => {
    if (SILENT_MARK_RE.test(p)) {
      const cp = p.codePointAt(0) ?? 0;
      return (
        <span key={`${keyPrefix}-${i.toString()}`} className={classForMark(cp)}>
          {p}
        </span>
      );
    }
    return <span key={`${keyPrefix}-t${i.toString()}`}>{p}</span>;
  });
}

/** Exposed so AyahCard / MushafLines can match the same set when they
 * splice into a per-word render path with tajweed coloring etc. */
export const SILENT_MARK_REGEX = SILENT_MARK_RE;
