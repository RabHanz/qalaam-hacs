'use client';

/**
 * ContinueCard — "Pick up where you left off". Reads the canonical
 * playback-store snapshot on mount; renders nothing if the user has
 * no last-played verse (so a brand-new account doesn't see a dead
 * "Continue from 1:1" affordance — that's what the marketing CTA is
 * for).
 *
 * Renders inside the right rail of TodaySurface. Compact card with
 * just the bare essentials: surah + ayah + a single "resume" link.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { parseVerseKey, readPlaybackSnapshot } from '../../lib/playback-store.js';

import type { ReactNode } from 'react';

interface Surah {
  surah: number;
  nameArabic: string;
  nameEnglish: string;
}

interface Props {
  readonly surahs: readonly Surah[];
}

export function ContinueCard({ surahs }: Props): ReactNode {
  const [verseKey, setVerseKey] = useState<string | null>(null);
  const [reciter, setReciter] = useState<string | null>(null);

  useEffect(() => {
    const snap = readPlaybackSnapshot();
    setVerseKey(snap.verseKey);
    setReciter(snap.reciterSlug);
  }, []);

  if (!verseKey) return null;
  const parsed = parseVerseKey(verseKey);
  if (!parsed) return null;
  const [s, a] = parsed;
  const surah = surahs.find((x) => x.surah === s);

  return (
    <Link
      href={`/read/${s.toString()}?continue=1#${verseKey}`}
      className="paper-card hover:border-leaf/40 group block p-5 transition-colors sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="smallcaps text-leaf text-[10px] tracking-widest">Continue · أَكْمِل</p>
        <p className="text-ink-muted font-mono text-[11px] tabular-nums">{verseKey}</p>
      </div>

      <p className="font-display text-ink-strong group-hover:text-leaf-700 mt-3 text-xl font-light leading-tight tracking-tight transition-colors sm:text-2xl">
        {surah ? `Sūrat ${surah.nameEnglish}` : `Surah ${s.toString()}`}
      </p>

      {surah ? (
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-ink-muted mt-1 text-lg sm:text-xl"
          style={{ unicodeBidi: 'plaintext', lineHeight: 1.4 }}
        >
          {surah.nameArabic}
        </p>
      ) : null}

      <p className="text-ink-muted mt-3 text-xs leading-relaxed">
        Verse {a.toString()}
        {reciter ? (
          <>
            <span className="mx-1.5 opacity-60">·</span>
            with {reciter}
          </>
        ) : null}
      </p>
      <p className="smallcaps text-leaf mt-4 inline-flex items-center gap-1.5 text-[11px] tracking-widest">
        Resume
        <span aria-hidden className="rtl-flip transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </p>
    </Link>
  );
}
