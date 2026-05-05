'use client';

/**
 * ImageMushafCanvas — renders the original KFGQPC page render with
 * absolute-positioned word rectangles laid on top.
 *
 * Coordinate system: rectangles come back from the backend in the
 * source image's pixel coordinates (e.g. {x: 534, y: 542, w: 53, h: 61}).
 * We render the image with a known intrinsic width and overlay the
 * rectangles as percentage offsets so the layout scales 1:1 with the
 * image at any container width.
 *
 * Interactions:
 *   - hover/touch a word → leaf-gold ring
 *   - tap a word → /study/:s/:a (deep-link into the study surface)
 *   - keyboard: tab through verse-first; Enter/Space activates
 */
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

import type { ReactNode } from 'react';

interface WordRect {
  readonly surah: number;
  readonly ayah: number;
  readonly word: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Props {
  readonly imageUrl: string;
  readonly words: readonly WordRect[];
  readonly page: number;
}

// Source image's intrinsic dimensions for QUL mushaf-layout-12. We
// detect on load and cache so subsequent pages reuse the same scale.
// Defaults match the most common KFGQPC source render so the first
// paint already lays rectangles correctly before the image loads.
const DEFAULT_IMG_WIDTH = 920;
const DEFAULT_IMG_HEIGHT = 1370;

export function ImageMushafCanvas({ imageUrl, words, page }: Props): ReactNode {
  const [intrinsic, setIntrinsic] = useState<{ w: number; h: number }>({
    w: DEFAULT_IMG_WIDTH,
    h: DEFAULT_IMG_HEIGHT,
  });
  const [hover, setHover] = useState<{ s: number; a: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Group rectangles by ayah so hover lights up the WHOLE ayah, not
  // just the single word — which is what serious memorizers want.
  const ayahGroups = useMemo(() => {
    const m = new Map<string, WordRect[]>();
    for (const w of words) {
      const k = `${w.surah.toString()}:${w.ayah.toString()}`;
      const list = m.get(k) ?? [];
      list.push(w);
      m.set(k, list);
    }
    return m;
  }, [words]);

  return (
    <figure
      className="bg-paper-100 border-hairline relative mx-auto overflow-hidden rounded-md border shadow-sm"
      style={{ aspectRatio: `${intrinsic.w.toString()} / ${intrinsic.h.toString()}` }}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt={`Mushaf page ${page.toString()}`}
        className="block h-auto w-full"
        draggable={false}
        loading="eager"
        onLoad={(e) => {
          const t = e.currentTarget;
          if (t.naturalWidth > 0 && t.naturalHeight > 0) {
            setIntrinsic({ w: t.naturalWidth, h: t.naturalHeight });
          }
        }}
      />

      {/* Word rectangles. position:absolute with percentage offsets so
          the overlay scales 1:1 with the image. pointer-events: none on
          the wrapper, opt-in per-link so hovering an ayah doesn't bleed
          across to neighboring words. */}
      <div className="pointer-events-none absolute inset-0">
        {words.map((wr) => {
          const k = `${wr.surah.toString()}:${wr.ayah.toString()}`;
          const isHover = hover !== null && hover.s === wr.surah && hover.a === wr.ayah;
          // Percentage layout — survives any container width / DPR.
          const left = (wr.x / intrinsic.w) * 100;
          const top = (wr.y / intrinsic.h) * 100;
          const width = (wr.w / intrinsic.w) * 100;
          const height = (wr.h / intrinsic.h) * 100;
          const grouped = ayahGroups.get(k);
          // Only the FIRST word of an ayah gets the focusable Link —
          // otherwise tab order would have to step through every word.
          const isFirstOfAyah = grouped?.[0] === wr;
          const href = `/study/${wr.surah.toString()}/${wr.ayah.toString()}`;
          return (
            <Link
              key={`${wr.surah.toString()}-${wr.ayah.toString()}-${wr.word.toString()}`}
              href={href}
              prefetch={false}
              tabIndex={isFirstOfAyah ? 0 : -1}
              aria-label={isFirstOfAyah ? `Verse ${k}` : undefined}
              onMouseEnter={() => {
                setHover({ s: wr.surah, a: wr.ayah });
              }}
              onMouseLeave={() => {
                setHover(null);
              }}
              onTouchStart={() => {
                setHover({ s: wr.surah, a: wr.ayah });
              }}
              className={`focus:ring-leaf pointer-events-auto absolute rounded-[3px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                isHover
                  ? 'bg-leaf/15 ring-leaf/60 shadow-[0_0_12px_rgba(176,131,54,0.25)] ring-1'
                  : 'hover:bg-leaf/8'
              }`}
              style={{
                left: `${left.toString()}%`,
                top: `${top.toString()}%`,
                width: `${width.toString()}%`,
                height: `${height.toString()}%`,
              }}
            />
          );
        })}
      </div>

      {/* Floating verse-key hint while hovering. Mobile shows it as a
          chip pinned to the bottom-center so the user always knows
          what they're about to tap. */}
      {hover ? (
        <figcaption
          aria-live="polite"
          className="bg-leaf text-paper smallcaps pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 select-none rounded-full px-3 py-1 text-xs tracking-widest shadow-md"
        >
          {hover.s.toString()}:{hover.a.toString()} · tap to study
        </figcaption>
      ) : null}
    </figure>
  );
}
