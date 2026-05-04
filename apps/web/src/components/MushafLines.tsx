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
}

const ARABIC_DIGITS_RE = /^[٠-٩]+$/;
function isAyahEndMarker(text: string): boolean {
  return ARABIC_DIGITS_RE.test(text.trim());
}

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
function fontStackFor(_layoutSlug: string): string {
  return '"UthmanicHafs", "Amiri Quran", "Noto Naskh Arabic", "Amiri", serif';
}

export function MushafLines({
  lines,
  layoutSlug,
  sharedSize = true,
  maxFontPx = 28,
  minFontPx = 13,
}: Props): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [fontPx, setFontPx] = useState<number>(maxFontPx);
  const [didFit, setDidFit] = useState(false);

  // Reset measurement state whenever the lines or layout changes — both
  // affect natural widths and therefore the optimal font-size.
  useEffect(() => {
    setDidFit(false);
  }, [lines, layoutSlug]);

  useIsoLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    let cancelled = false;

    function fit(): void {
      if (!container || cancelled) return;
      const rect = container.getBoundingClientRect();
      const available = rect.width - 6; // safety margin
      if (available <= 0) {
        raf = requestAnimationFrame(fit);
        return;
      }

      const probeSize = maxFontPx;
      let widestNatural = 0;

      // Measure each line's natural width at probeSize. We set ALL line
      // spans to probeSize first, then read scrollWidth from each. This
      // batches the writes before the reads so the browser only does
      // one layout pass.
      const spans = lineRefs.current.filter((s): s is HTMLSpanElement => s !== null);
      for (const span of spans) {
        span.style.fontSize = `${probeSize.toString()}px`;
      }
      for (const span of spans) {
        const w = span.scrollWidth;
        if (w > widestNatural) widestNatural = w;
      }

      if (widestNatural <= 0) {
        raf = requestAnimationFrame(fit);
        return;
      }

      // Linear scaling: font-size scales width linearly at this scale.
      const idealSize = (available / widestNatural) * probeSize;
      const final = Math.max(minFontPx, Math.min(maxFontPx, idealSize));

      // Apply the SHARED font-size to all lines.
      for (const span of spans) {
        span.style.fontSize = `${final.toString()}px`;
      }
      setFontPx(final);
      setDidFit(true);
    }

    fit();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => fit());
      ro.observe(container);
    }

    const docFonts = (document as Document & {
      fonts?: { ready?: Promise<unknown>; load?: (font: string) => Promise<unknown> };
    }).fonts;
    docFonts?.ready?.then(() => {
      if (!cancelled) fit();
    });
    // Force-load the active layout's font(s); re-fit after each lands.
    const stack = fontStackFor(layoutSlug);
    const families = stack
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter((s) => s && !['serif', 'sans-serif', 'system-ui'].includes(s));
    for (const fam of families) {
      void docFonts
        ?.load?.(`1em "${fam}"`)
        .then(() => {
          if (!cancelled) fit();
        })
        .catch(() => undefined);
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, layoutSlug, sharedSize]);

  // Per-layout treatment class. Picks up tajweed colors for v4 + a
  // density tweak for v1 so the user sees a real difference between
  // chips even when the proprietary KFGQPC fonts aren't installed.
  const layoutClass =
    layoutSlug === 'kfgqpc_v4'
      ? 'mushaf-layout-tajweed'
      : layoutSlug === 'kfgqpc_v1'
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
                className="text-center text-leaf text-base sm:text-lg smallcaps tracking-widest border-y border-hairline py-2"
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
                className="text-center text-ink-strong"
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
              style={{ unicodeBidi: 'plaintext', overflow: 'hidden' }}
            >
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
                }}
              >
                {line.words.map((w, i) => {
                  const sep = i < line.words.length - 1 ? ' ' : '';
                  if (isAyahEndMarker(w.text)) {
                    // Prefix the digit with U+06DD ARABIC END OF AYAH.
                    // UthmanicHafs's OpenType substitution turns this
                    // pair into the authentic rosette glyph natively —
                    // no CSS ring, no bolt-on. This is exactly how
                    // Quran.com and Tarteel do it.
                    const rosetteText = `۝${w.text}`;
                    return (
                      <span key={`${line.lineNumber.toString()}-${w.wordId.toString()}`}>
                        <a
                          href={`/study/${w.verseKey.split(':')[0] ?? '1'}/${w.verseKey.split(':')[1] ?? '1'}`}
                          title={`Ayah ${w.verseKey} — ends here`}
                          aria-label={`End of ayah ${w.verseKey}`}
                          className="ayah-end hover:text-leaf"
                        >
                          {rosetteText}
                        </a>
                        {sep}
                      </span>
                    );
                  }
                  return (
                    <span key={`${line.lineNumber.toString()}-${w.wordId.toString()}`}>
                      <a
                        href={`/study/${w.verseKey.split(':')[0] ?? '1'}/${w.verseKey.split(':')[1] ?? '1'}`}
                        className="hover:text-leaf"
                        title={w.verseKey}
                      >
                        {w.text}
                      </a>
                      {sep}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function arabicDigitN(n: number): string {
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
}
