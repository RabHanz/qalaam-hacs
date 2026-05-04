'use client';

/**
 * MushafPagePlayer — wraps ContinuousReaderPlayer for the standalone
 * /mushaf/[layout]/[page] surface. Builds the verses list from the
 * page's lines, fetches reciters list on mount, and spawns the same
 * sticky-bottom continuous player that lives on /read.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { resolveApiBase } from '../lib/api-base.js';
import { ContinuousReaderPlayer } from './ContinuousReaderPlayer.js';

interface PageLine {
  readonly lineType: 'ayah' | 'surah_name' | 'basmallah';
  readonly words: readonly { verseKey: string }[];
}

interface ReciterApi {
  readonly slug: string;
  readonly name: { en: string; ar: string };
}

interface Props {
  readonly lines: readonly PageLine[];
  /** Surah of the FIRST ayah on this page (used for cross-surah chain). */
  readonly initialSurah: number;
}

export function MushafPagePlayer({ lines, initialSurah }: Props): ReactNode {
  const [reciter, setReciter] = useState<string>('sudais');
  const [reciters, setReciters] = useState<readonly ReciterApi[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/v1/reciters`);
        if (!res.ok) return;
        const body = (await res.json()) as { reciters: ReciterApi[] };
        if (!cancelled) setReciters(body.reciters);
        try {
          const stored = window.localStorage.getItem('qalaam-reciter');
          if (stored && body.reciters.some((r) => r.slug === stored)) {
            if (!cancelled) setReciter(stored);
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unique verse keys appearing on this mushaf page, in source order.
  const seenVK = new Set<string>();
  const verses: { verseKey: string }[] = [];
  for (const line of lines) {
    if (line.lineType !== 'ayah') continue;
    for (const w of line.words) {
      if (!seenVK.has(w.verseKey)) {
        seenVK.add(w.verseKey);
        verses.push({ verseKey: w.verseKey });
      }
    }
  }

  // Highlight callback is a no-op here (we don't have word-level
  // tappable markup to paint inside the mushaf page yet — the
  // mushaf-word anchors do exist but cross-component highlight
  // wiring would need extra refactor).
  return (
    <ContinuousReaderPlayer
      verses={verses}
      reciterSlug={reciter}
      reciterName={reciters.find((r) => r.slug === reciter)?.name.en}
      onHighlight={() => undefined}
      currentSurah={initialSurah}
    />
  );
}
