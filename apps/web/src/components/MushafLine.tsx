'use client';

/**
 * MushafLine — single line of a mushaf page, auto-fit to container width.
 *
 * Why this exists: the QUL layout database tells us EXACTLY which words
 * belong on each printed mushaf line (matching the official KFGQPC
 * pagination). To render that faithfully without overflow we need the
 * font-size of each line to scale so its content exactly fills the
 * available width — that's how a real mushaf is typeset.
 *
 * Without the actual KFGQPC fonts (which natively substitute end-of-ayah
 * digits into rosette glyphs and apply tatweel-based justification), the
 * frontier Quran apps (Quran.com, Tarteel, Ayah) use a JS auto-fit
 * approach: measure the line, shrink font-size until it fits. We do the
 * same here.
 *
 * Verse-end markers (single Arabic-Indic-digit "words" from QUL) render
 * as inline gold rosettes (.ayah-rosette in globals.css). Tapping a
 * rosette → /study/:surah/:ayah for deep dive.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ReactNode } from 'react';

interface LayoutWord {
  readonly wordId: number;
  readonly wordIndex: number;
  readonly verseKey: string;
  readonly text: string;
}

interface Props {
  readonly words: readonly LayoutWord[];
  readonly lineNumber: number;
  /**
   * Maximum font-size in pixels. Mushaf pages target ~32px on desktop;
   * we cap at 38 and the autofit will shrink if needed.
   */
  readonly maxFontPx?: number;
  /**
   * Minimum font-size — we won't shrink below this even if the line
   * still overflows; instead the line falls back to wrap. Keeps the
   * page readable on cramped mobile widths.
   */
  readonly minFontPx?: number;
}

const ARABIC_DIGITS_RE = /^[٠-٩]+$/;
function isAyahEndMarker(text: string): boolean {
  return ARABIC_DIGITS_RE.test(text.trim());
}

// useLayoutEffect on the server logs a warning, so swap to plain useEffect
// during SSR. The autofit only matters on the client anyway.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function MushafLine({
  words,
  lineNumber,
  maxFontPx = 32,
  minFontPx = 13,
}: Props): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [fontPx, setFontPx] = useState<number>(maxFontPx);
  const [didFit, setDidFit] = useState(false);

  useIsoLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    let raf = 0;
    let cancelled = false;

    function fit(): void {
      if (!container || !inner || cancelled) return;
      // Use getBoundingClientRect for sub-pixel accurate container width.
      // Apply a 6px safety margin: web-font swaps + sub-pixel rounding +
      // box-shadow boundaries can push the visible content slightly
      // wider than the measured font-size implies. Better to undershoot
      // than to overflow.
      const rect = container.getBoundingClientRect();
      const available = rect.width - 6;
      if (available <= 0) {
        raf = requestAnimationFrame(fit);
        return;
      }
      // Single-measurement proportional scaling: set the inner span to a
      // KNOWN font-size, read its natural width, then compute the target
      // font-size as a linear scale. Arabic text (and Latin text in
      // general) scales width linearly with font-size at this resolution,
      // so one measurement is enough — no binary search needed.
      const probeSize = maxFontPx;
      inner.style.fontSize = `${probeSize.toString()}px`;
      // Force layout by reading scrollWidth; this is the natural
      // unconstrained width of the inline-block content.
      const naturalAtProbe = inner.scrollWidth;
      if (naturalAtProbe <= 0) {
        raf = requestAnimationFrame(fit);
        return;
      }
      const idealSize = (available / naturalAtProbe) * probeSize;
      const final = Math.max(minFontPx, Math.min(maxFontPx, idealSize));
      inner.style.fontSize = `${final.toString()}px`;
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

    // Re-run when web fonts finish loading (initial measurement uses
    // fallback font widths). Both fonts.ready (resolves once all
    // currently-pending fonts settle) AND fonts.load (forces the
    // specific Arabic font to load if it wasn't yet) so we re-fit
    // after the swap.
    const docFonts = (
      document as Document & {
        fonts?: {
          ready?: Promise<unknown>;
          load?: (font: string, text?: string) => Promise<unknown>;
        };
      }
    ).fonts;
    /* eslint-disable @typescript-eslint/no-unnecessary-condition,
                       @typescript-eslint/no-misused-promises
        -- @types/web declares Document.fonts as non-optional, but
           jsdom + older browsers leave it undefined; defensive checks
           must stay. */
    if (docFonts && docFonts.ready) {
      void docFonts.ready.then(() => {
        if (!cancelled) fit();
      });
    }
    if (docFonts && docFonts.load) {
      // Self-hosted Quran fonts only — KFGQPCNastaleeq for IndoPak,
      // UthmanicHafs for everything else. Both preloaded in <head>;
      // we touch them here so the layout fitter re-runs after the
      // font lands (in case the network was slow).
      for (const fam of ['"UthmanicHafs"', '"KFGQPCNastaleeq"']) {
        void docFonts
          .load(`1em ${fam}`)
          .then(() => {
            if (!cancelled) fit();
          })
          .catch(() => undefined);
      }
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition,
                    @typescript-eslint/no-misused-promises */
    // Belt-and-suspenders: re-fit after delays to catch any font swap
    // that escaped the events above (e.g. font-display: swap firing
    // outside fonts.ready in some browsers).
    const t1 = window.setTimeout(() => {
      if (!cancelled) fit();
    }, 500);
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
    // We deliberately keep deps minimal — `words` are immutable for a
    // given mounted instance because the parent uses `key={lineNumber}`.
  }, []);

  return (
    <div
      ref={containerRef}
      dir="rtl"
      lang="ar"
      className="w-full text-center"
      style={{ unicodeBidi: 'plaintext', overflow: 'hidden' }}
    >
      <span
        ref={innerRef}
        className="font-arabic text-ink-strong inline-block"
        style={{
          fontSize: `${fontPx.toString()}px`,
          lineHeight: 1.95,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          letterSpacing: '0',
          // Hide pre-fit content briefly to avoid an FOUC jump on slow
          // devices. The fit pass typically completes within one frame.
          opacity: didFit ? 1 : 0,
          transition: 'opacity 120ms ease-out',
        }}
      >
        {words.map((w, i) => {
          const sep = i < words.length - 1 ? ' ' : '';
          if (isAyahEndMarker(w.text)) {
            return (
              <span key={`${lineNumber.toString()}-${w.wordId.toString()}`}>
                <a
                  href={`/study/${w.verseKey.split(':')[0] ?? '1'}/${w.verseKey.split(':')[1] ?? '1'}`}
                  title={`Ayah ${w.verseKey} — ends here`}
                  aria-label={`End of ayah ${w.verseKey}`}
                  className="ayah-rosette inline-flex items-center justify-center"
                >
                  <span className="ayah-rosette-num font-arabic">{w.text}</span>
                </a>
                {sep}
              </span>
            );
          }
          return (
            <span key={`${lineNumber.toString()}-${w.wordId.toString()}`}>
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
}
