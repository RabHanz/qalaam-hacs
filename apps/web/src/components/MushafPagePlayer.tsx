'use client';

/**
 * MushafPagePlayer — wraps ContinuousReaderPlayer for the standalone
 * /mushaf/[layout]/[page] surface. Builds the verses list from the
 * page's lines, fetches reciters list on mount, and spawns the same
 * sticky-bottom continuous player that lives on /read.
 */
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import { ContinuousReaderPlayer } from './ContinuousReaderPlayer.js';

import type { ReactNode } from 'react';

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
    const cancel = { v: false };
    void (async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/v1/reciters`);
        if (!res.ok) return;
        const body = (await res.json()) as { reciters: ReciterApi[] };
        if (!cancel.v) setReciters(body.reciters);
        try {
          const stored = window.localStorage.getItem('qalaam-reciter');
          if (stored && body.reciters.some((r) => r.slug === stored)) {
            if (!cancel.v) setReciter(stored);
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel.v = true;
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

  // Track last verse pushed to /v1/now-playing so we don't spam the
  // backend with identical state on every word callback.
  const lastVerseRef = useState<{ vk: string | null }>({ vk: null })[0];

  // Speaker ID for the web app — single logical speaker per origin.
  // Future: per-tab UUID for multi-tab Listen Mode.
  const SPEAKER_ID = 'web';

  function pushNowPlaying(verseKey: string, isPlaying: boolean): void {
    if (lastVerseRef.vk === verseKey && isPlaying) return;
    lastVerseRef.vk = verseKey;
    void fetch(`${resolveApiBase()}/v1/now-playing/${SPEAKER_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speaker_id: SPEAKER_ID,
        verse_key: verseKey,
        reciter_slug: reciter,
        position_ms: 0,
        is_playing: isPlaying,
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => {
      /* fire-and-forget — backend may be down on standalone web */
    });
  }

  // Broadcast active-word events on the window bus so any client
  // sibling (notably <MushafLines/> rendered server-side as a sibling
  // of this player) can paint the active word in gold without us
  // needing to convert the page into a client component.
  return (
    <ContinuousReaderPlayer
      verses={verses}
      reciterSlug={reciter}
      reciterName={reciters.find((r) => r.slug === reciter)?.name.en}
      onHighlight={(h) => {
        window.dispatchEvent(new CustomEvent('qalaam:current-word', { detail: h }));
        // Verse changed → push to backend so HA panel + sensors see it.
        if (h?.verseKey) pushNowPlaying(h.verseKey, true);
      }}
      currentSurah={initialSurah}
    />
  );
}
