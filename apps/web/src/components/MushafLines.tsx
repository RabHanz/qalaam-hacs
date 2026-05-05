'use client';

/**
 * MushafLines — renders a sequence of mushaf-page lines with a SHARED
 * font-size (the largest size at which the widest line still fits the
 * available width).
 *
 * Why one shared size: in a real KFGQPC mushaf, every line of a page
 * uses the same display size. Lines that have fewer words are justified
 * via tatweel/letter-spacing — NOT by enlarging the font. Our approach
 * reproduces that consistency: measure the natural widths of all lines
 * at a probe font-size, take the WIDEST natural width, compute the scale
 * factor that brings it to the page width, apply that single font-size
 * to every line. Shorter lines simply have whitespace around them.
 *
 * This is the approach used by Quran.com, Tarteel, and Ayah-by-Ayah —
 * a single font-size per page is what reads as "mushaf" rather than
 * "variable web typography".
 *
 * Layout-specific font-family is exposed via the `--mushaf-font` CSS
 * variable so the three layouts (madani_15 / kfgqpc_v1 / kfgqpc_v4)
 * render with visibly different glyphs even before we ship the actual
 * KFGQPC font files.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';
import { SILENT_MARK_REGEX } from '../lib/arabic-render.js';
import { applyTajweed, fetchTajweed, type TajweedAnnotation } from '../lib/tajweed.js';

import type { ReactNode } from 'react';

interface LayoutWord {
  readonly wordId: number;
  readonly wordIndex: number;
  readonly verseKey: string;
  readonly text: string;
}

interface LayoutLine {
  readonly lineNumber: number;
  readonly lineType: 'ayah' | 'surah_name' | 'basmallah';
  readonly alignment: string;
  readonly firstWordId: number | null;
  readonly lastWordId: number | null;
  readonly surah: number | null;
  readonly words: readonly LayoutWord[];
}

interface Props {
  readonly lines: readonly LayoutLine[];
  readonly layoutSlug: string;
  /**
   * If true (default), all lines share a single computed font-size.
   * If false, each line autofits independently — useful in single-ayah
   * mushaf style where there's only 1-3 lines and consistency-with-page
   * isn't a concern.
   */
  readonly sharedSize?: boolean;
  readonly maxFontPx?: number;
  readonly minFontPx?: number;
  /** Active-recitation highlight (continuous player). The matching
   *  word in this verse is painted. */
  readonly highlight?: { verseKey: string; wordIndex: number } | null;
}

// (verse-end detection moved into renderLineText)

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Mushaf font stack. We use UthmanicHafs as primary — it's the official
 * KFGQPC Hafs Unicode font from Quran Foundation, with built-in
 * OpenType substitution that turns U+06DD + Arabic-Indic digit into
 * an authentic verse-end rosette glyph. No CSS bolt-on needed.
 *
 * Layout differentiation: the three layouts share UthmanicHafs as the
 * glyph source but differ in:
 *   - Line breaks (madani_15 / kfgqpc_v1 / kfgqpc_v4 each use distinct
 *     QUL layout pagination — verses break at different points per
 *     layout's printed mushaf)
 *   - Tajweed coloring overlay (v4 only — see .mushaf-layout-tajweed)
 *
 * Per-page glyph fonts (v1/v2/v4 page-by-page WOFF2) require QUL's
 * code_v1/code_v2 PUA codepoints in the data — our backend ingests
 * the readable Uthmani text, so glyph fonts wouldn't render. When we
 * re-ingest with code_v2 we can swap to per-page fonts.
 */
function fontStackFor(layoutSlug: string): string {
  switch (layoutSlug) {
    case 'kfgqpc_v1':
    case 'indopak':
      // IndoPak Nastaleeq → Noto Nastaliq Urdu (the authentic Nastaleeq
      // calligraphic style used in Sub-Continental mushafs). Falls back
      // to Scheherazade New / Noto Naskh Arabic if Nastaliq fails.
      return '"Noto Nastaliq Urdu", "Scheherazade New", "Noto Naskh Arabic", "Amiri", serif';
    case 'kfgqpc_v4':
    case 'madani_15':
    default:
      return '"UthmanicHafs", "Amiri Quran", "Noto Naskh Arabic", "Amiri", serif';
  }
}

export function MushafLines({
  lines,
  layoutSlug,
  sharedSize = true,
  maxFontPx = 28,
  minFontPx = 13,
  highlight,
}: Props): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [fontPx, setFontPx] = useState<number>(maxFontPx);
  const [didFit, setDidFit] = useState(false);
  const [tajweedByVerse, setTajweedByVerse] = useState<Map<string, readonly TajweedAnnotation[]>>(
    new Map(),
  );

  // Reset measurement state whenever the lines or layout changes — both
  // affect natural widths and therefore the optimal font-size.
  useEffect(() => {
    setDidFit(false);
  }, [lines, layoutSlug]);

  // For the tajweed layout, fetch annotations for every distinct verse
  // currently rendered. The cache in lib/tajweed.ts persists across
  // re-renders so we don't re-fetch on every paint.
  useEffect(() => {
    if (layoutSlug !== 'kfgqpc_v4' && layoutSlug !== 'tajweed') return;
    const apiBase = resolveApiBase();
    const verseKeys = new Set<string>();
    for (const line of lines) {
      if (line.lineType !== 'ayah') continue;
      for (const w of line.words) verseKeys.add(w.verseKey);
    }
    let cancelled = false;
    void (async () => {
      const next = new Map<string, readonly TajweedAnnotation[]>();
      await Promise.all(
        Array.from(verseKeys).map(async (vk) => {
          const ann = await fetchTajweed(apiBase, vk);
          next.set(vk, ann);
        }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by the cleanup closure on unmount.
      if (!cancelled) setTajweedByVerse(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines, layoutSlug]);

  // Build per-verse word-offset map: for each verse, maps word_index →
  // start char position of that word in the verse's joined text.
  // Used to convert ayah-level tajweed offsets to word-level slice
  // boundaries.
  const verseWordOffsets = (() => {
    if (layoutSlug !== 'kfgqpc_v4' && layoutSlug !== 'tajweed')
      return new Map<string, Map<number, number>>();
    // Group words by verse, ordered by word_index, and accumulate
    // offsets. Words are space-joined when forming the canonical
    // ayah text (matches how cpfair/quran-tajweed's source aligns).
    const byVerse = new Map<string, { wordIndex: number; text: string }[]>();
    for (const line of lines) {
      for (const w of line.words) {
        const arr = byVerse.get(w.verseKey) ?? [];
        arr.push({ wordIndex: w.wordIndex, text: w.text });
        byVerse.set(w.verseKey, arr);
      }
    }
    const out = new Map<string, Map<number, number>>();
    for (const [vk, words] of byVerse.entries()) {
      words.sort((a, b) => a.wordIndex - b.wordIndex);
      const offsets = new Map<number, number>();
      let cursor = 0;
      for (const w of words) {
        offsets.set(w.wordIndex, cursor);
        cursor += w.text.length + 1; // +1 for the space separator
      }
      out.set(vk, offsets);
    }
    return out;
  })();

  useIsoLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    let cancelled = false;

    function fit(): void {
      if (!container || cancelled) return;
      const rect = container.getBoundingClientRect();
      // 16px safety margin (was 6) — covers font-swap drift, sub-pixel
      // rounding, and nested-span margin growth under tajweed coloring.
      const available = rect.width - 16;
      if (available <= 0) {
        raf = requestAnimationFrame(fit);
        return;
      }

      const probeSize = maxFontPx;
      let widestNatural = 0;

      // Reset transform from previous run before measuring naturally.
      const spans = lineRefs.current.filter((s): s is HTMLSpanElement => s !== null);
      for (const span of spans) {
        span.style.transform = '';
        span.style.fontSize = `${probeSize.toString()}px`;
      }
      // One layout pass: read scrollWidth from each.
      for (const span of spans) {
        const w = span.scrollWidth;
        if (w > widestNatural) widestNatural = w;
      }

      if (widestNatural <= 0) {
        raf = requestAnimationFrame(fit);
        return;
      }

      // Linear scaling: font-size scales width linearly at this scale.
      // Apply 0.985 down-shift to undershoot — guarantees no overflow
      // even when the web font swaps from fallback to UthmanicHafs after
      // the measurement.
      const idealSize = (available / widestNatural) * probeSize * 0.985;
      const final = Math.max(minFontPx, Math.min(maxFontPx, idealSize));

      for (const span of spans) {
        span.style.fontSize = `${final.toString()}px`;
      }

      // Defense in depth: AFTER applying font-size, check each line. If
      // any line still overflows due to font-swap or sub-pixel drift,
      // apply transform: scaleX to that specific line so it visually
      // fits without further reflow. This is the same trick Quran.com
      // uses for the rare line that doesn't fit at the chosen size.
      requestAnimationFrame(() => {
        if (cancelled) return;
        for (const span of spans) {
          const w = span.scrollWidth;
          const parentW = span.parentElement?.clientWidth ?? available;
          if (w > parentW + 0.5) {
            const sx = parentW / w;
            span.style.transform = `scaleX(${sx.toString()})`;
            span.style.transformOrigin = 'center';
          }
        }
      });

      setFontPx(final);
      setDidFit(true);
    }

    fit();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        fit();
      });
      ro.observe(container);
    }

    /* eslint-disable @typescript-eslint/no-unnecessary-condition,
                       @typescript-eslint/no-misused-promises
        -- document.fonts is in @types/web with non-optional ready / load,
           but jsdom + older browsers leave it undefined; we keep the
           defensive optional chains. */
    const docFonts = (
      document as Document & {
        fonts?: { ready?: Promise<unknown>; load?: (font: string) => Promise<unknown> };
      }
    ).fonts;
    if (docFonts && docFonts.ready) {
      void docFonts.ready.then(() => {
        if (!cancelled) fit();
      });
    }
    // Force-load the active layout's font(s); re-fit after each lands.
    const stack = fontStackFor(layoutSlug);
    const families = stack
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter((s) => s && !['serif', 'sans-serif', 'system-ui'].includes(s));
    for (const fam of families) {
      if (docFonts && docFonts.load) {
        void docFonts
          .load(`1em "${fam}"`)
          .then(() => {
            if (!cancelled) fit();
          })
          .catch(() => undefined);
      }
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition,
                    @typescript-eslint/no-misused-promises */

    const t1 = window.setTimeout(() => {
      if (!cancelled) fit();
    }, 600);
    const t2 = window.setTimeout(() => {
      if (!cancelled) fit();
    }, 1500);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro?.disconnect();
    };
  }, [lines, layoutSlug, sharedSize]);

  // Per-layout treatment class. Picks up tajweed colors for v4 + a
  // density tweak for v1 so the user sees a real difference between
  // chips even when the proprietary KFGQPC fonts aren't installed.
  const layoutClass =
    layoutSlug === 'kfgqpc_v4' || layoutSlug === 'tajweed'
      ? 'mushaf-layout-tajweed'
      : layoutSlug === 'kfgqpc_v1' || layoutSlug === 'indopak'
        ? 'mushaf-layout-v1'
        : 'mushaf-layout-v2';

  return (
    <div
      ref={containerRef}
      className={`w-full ${layoutClass}`}
      style={{
        ['--mushaf-font' as string]: fontStackFor(layoutSlug),
      }}
    >
      <div
        className="space-y-3 sm:space-y-4"
        style={{ opacity: didFit ? 1 : 0, transition: 'opacity 140ms ease-out' }}
      >
        {lines.map((line, idx) => {
          if (line.lineType === 'surah_name') {
            return (
              <p
                key={line.lineNumber}
                className="text-leaf smallcaps border-hairline border-y py-2 text-center text-base tracking-widest sm:text-lg"
              >
                Sūrat {line.surah !== null ? arabicDigitN(line.surah) : ''}
              </p>
            );
          }
          if (line.lineType === 'basmallah') {
            return (
              <p
                key={line.lineNumber}
                dir="rtl"
                lang="ar"
                className="text-ink-strong text-center"
                style={{
                  fontFamily: 'var(--mushaf-font)',
                  fontSize: `${(fontPx * 1.05).toString()}px`,
                  lineHeight: 1.95,
                  unicodeBidi: 'plaintext',
                  fontWeight: 600,
                }}
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </p>
            );
          }
          return (
            <div
              key={line.lineNumber}
              dir="rtl"
              lang="ar"
              className="w-full text-center"
              style={{ overflow: 'hidden' }}
            >
              {/* QUL's vetted rendering approach: ONE concatenated
                  text run per line. Wrapping each word in its own
                  inline element broke RTL bidi (the digit is class AN,
                  fragmenting the line into LTR + RTL runs that the
                  algorithm reordered). With one text node, the
                  browser's standard bidi handles word + digit ordering
                  correctly for Arabic. Verse-end digits are derived
                  from verseKey so IndoPak's combining-mark cluster
                  doesn't reach the renderer. Tajweed layer is a
                  separate <span> overlay drawn on top of segments
                  matching the cpfair/quran-tajweed annotations. */}
              <span
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                className="text-ink-strong inline-block"
                style={{
                  fontFamily: 'var(--mushaf-font)',
                  fontSize: `${fontPx.toString()}px`,
                  lineHeight: 1.95,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0',
                  direction: 'rtl',
                }}
              >
                {renderLineText(
                  line,
                  layoutSlug,
                  tajweedByVerse,
                  verseWordOffsets,
                  highlight ?? null,
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function arabicDigitN(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
}

/**
 * Render a mushaf line as a single text run with optional tajweed
 * coloring. Words are joined into ONE string so the browser's bidi
 * algorithm treats them as a continuous Arabic paragraph (no per-word
 * inline-block fragmentation that would let digits split the run).
 *
 * Verse-end markers are replaced with the verse's Arabic-Indic digit
 * (derived from verseKey, not the source text — IndoPak's combining-
 * mark verse-end clusters are non-printable in Naskh fonts).
 *
 * For the v4 (Tajweed) layout, each word that overlaps a tajweed
 * annotation is split into colored <span> segments before the words
 * are joined.
 */
function renderLineText(
  line: LayoutLine,
  layoutSlug: string,
  tajweedByVerse: Map<string, readonly TajweedAnnotation[]>,
  verseWordOffsets: Map<string, Map<number, number>>,
  highlight: { verseKey: string; wordIndex: number } | null,
): ReactNode {
  const ARABIC_DIGITS_RE = /^[٠-٩]+$/;
  const INDOPAK_END_RE = /^[ۖ-ۭ]+$/;
  function isEnd(t: string): boolean {
    const x = t.trim();
    return ARABIC_DIGITS_RE.test(x) || INDOPAK_END_RE.test(x);
  }
  function ayahDigit(verseKey: string): string {
    const a = verseKey.split(':')[1] ?? '';
    return a
      .split('')
      .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
      .join('');
  }

  const out: ReactNode[] = [];
  for (let i = 0; i < line.words.length; i += 1) {
    const w = line.words[i];
    if (!w) continue;
    const sep = i < line.words.length - 1 ? ' ' : '';
    if (isEnd(w.text)) {
      // Render verse-end as a separate <span> with UthmanicHafs so the
      // rosette glyph renders even when the layout font (Nastaliq /
      // Naskh) has no rosette. Wrapped as a clickable anchor for jump-
      // to-verse on tap.
      // Render the rosette in its own bidi-isolated inline-block so
      // the Nastaliq parent font can't bleed into the UthmanicHafs
      // override and the rosette stays a single unit in the line.
      out.push(
        <a
          key={`${w.wordId.toString()}-end`}
          href={`/study/${w.verseKey.split(':')[0] ?? '1'}/${w.verseKey.split(':')[1] ?? '1'}`}
          title={`Ayah ${w.verseKey} — ends here`}
          aria-label={`End of ayah ${w.verseKey}`}
          className="ayah-end hover:text-leaf"
          style={
            {
              fontFamily: '"UthmanicHafs", "Amiri Quran", "Noto Naskh Arabic", serif',
              // Plain inline (not inline-block) keeps the bidi flow
              // intact. !important via inline overrides the parent
              // Nastaliq stack so the rosette glyph from UthmanicHafs
              // can resolve.
            } as React.CSSProperties
          }
        >
          {ayahDigit(w.verseKey)}
        </a>,
      );
      if (sep) out.push(' ');
      continue;
    }

    // Wrap each word in a plain INLINE anchor (NOT inline-block, NOT
    // bdi/isolate) so it stays in the parent's bidi context — no
    // reordering — while remaining tappable for word-by-word study.
    // Anchor goes to /study/:surah/:ayah/word-:idx.
    const sn = w.verseKey.split(':')[0] ?? '1';
    const an = w.verseKey.split(':')[1] ?? '1';
    const wordChildren: ReactNode[] = [];

    // Apply tajweed coloring within this word for v4 layout
    let segs: { text: string; rule?: TajweedAnnotation['rule'] }[] = [{ text: w.text }];
    if (layoutSlug === 'kfgqpc_v4' || layoutSlug === 'tajweed') {
      const verseAnn = tajweedByVerse.get(w.verseKey) ?? [];
      const wordStart = verseWordOffsets.get(w.verseKey)?.get(w.wordIndex) ?? 0;
      const wordEnd = wordStart + w.text.length;
      const localAnn: TajweedAnnotation[] = [];
      for (const a of verseAnn) {
        if (a.end <= wordStart || a.start >= wordEnd) continue;
        localAnn.push({
          start: Math.max(0, a.start - wordStart),
          end: Math.min(w.text.length, a.end - wordStart),
          rule: a.rule,
        });
      }
      if (localAnn.length > 0) {
        segs = applyTajweed(w.text, localAnn) as typeof segs;
      }
    }

    // Within each segment, also split out small-high / small-low
    // silent / pause / sajda / madda marks so they render as discreet
    // superscripts. Comprehensive coverage to match the shared helper
    // in lib/arabic-render.tsx — keeps Uthmani / IndoPak / Nastaliq
    // layouts consistent.
    const SILENT_MARK_RE = SILENT_MARK_REGEX;
    for (let si = 0; si < segs.length; si += 1) {
      const s = segs[si];
      if (!s) continue;
      const parts = s.text.split(SILENT_MARK_RE);
      for (let pi = 0; pi < parts.length; pi += 1) {
        const p = parts[pi];
        if (!p) continue;
        if (SILENT_MARK_RE.test(p)) {
          wordChildren.push(
            <span
              key={`${w.wordId.toString()}-s${si.toString()}m${pi.toString()}`}
              className={`silent-mark${s.rule ? ` tajweed-${s.rule}` : ''}`}
            >
              {p}
            </span>,
          );
        } else if (s.rule) {
          wordChildren.push(
            <span
              key={`${w.wordId.toString()}-s${si.toString()}p${pi.toString()}`}
              className={`tajweed-${s.rule}`}
            >
              {p}
            </span>,
          );
        } else {
          wordChildren.push(p);
        }
      }
    }

    const isHighlighted =
      highlight !== null &&
      highlight.verseKey === w.verseKey &&
      highlight.wordIndex === w.wordIndex;
    out.push(
      <a
        key={w.wordId.toString()}
        href={`/study/${sn}/${an}#w${w.wordIndex.toString()}`}
        title={`${w.verseKey} · word ${(w.wordIndex + 1).toString()}`}
        className={`mushaf-word${isHighlighted ? 'recite-highlight' : ''}`}
      >
        {wordChildren}
      </a>,
    );
    if (sep) out.push(' ');
  }
  return <>{out}</>;
}
