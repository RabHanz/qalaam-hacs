'use client';

/**
 * AyahCard — the heart of the new Quranly-style /read flow.
 *
 * One card per ayah. Layout (mobile-first):
 *
 *   [ ٤٥٥ ]               (ayah-number tile, top-left)
 *   ⵖⵖⵖⵖ Arabic verse ⵖⵖⵖ        (RTL, Quranic typography, no justify)
 *   English translation underneath  (LTR, smaller, muted-ish but readable)
 *   ─── Action row ───
 *   ▶ Listen   • WBW   • Tafsir   • Bookmark   • Share
 *
 * Interactions:
 *   - Listen: fires audio for this ayah (uses /v1/audio/by_verse/:vk/:reciter)
 *   - WBW: expands a row of word/gloss tokens below the verse
 *   - Tafsir: expands a tafsir paragraph below (currently disabled until
 *     tafsir DB is ingested — shows a "coming with v0.5 tafsir ingest" hint)
 *   - Bookmark: localStorage for now, syncs in v0.5
 *   - Share: copies a deep-link to clipboard
 *
 * RTL discipline: Arabic always wrapped with dir="rtl" + unicodeBidi:plaintext.
 * NEVER text-align:justify on Arabic verse text — it inserts kashida/spacing
 * artifacts that the user called "forced/horrendous."
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface AyahCardProps {
  readonly verseKey: string;
  readonly arabic: string;
  readonly translation: string | null;
  readonly translationSlug?: string | null;
  readonly translatorAttribution?: string | null;
  readonly reciterSlug: string;
  readonly apiBase: string;
}

function arabicNumeral(n: number): string {
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
}

function PlayIcon({ playing }: { playing: boolean }): ReactNode {
  return playing ? (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function WbwIcon(): ReactNode {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
      <line x1="4" y1="12" x2="14" y2="12" strokeLinecap="round" />
      <line x1="4" y1="17" x2="17" y2="17" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }): ReactNode {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M6 4h12v18l-6-4-6 4z" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon(): ReactNode {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <line x1="8" y1="11" x2="16" y2="7" strokeLinecap="round" />
      <line x1="8" y1="13" x2="16" y2="17" strokeLinecap="round" />
    </svg>
  );
}

function TafsirIcon(): ReactNode {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M5 4h11l3 3v13H5z" strokeLinejoin="round" />
      <line x1="9" y1="10" x2="15" y2="10" strokeLinecap="round" />
      <line x1="9" y1="14" x2="15" y2="14" strokeLinecap="round" />
    </svg>
  );
}

interface WbwToken {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly textArabic: string;
  readonly translation: string | null;
}

export function AyahCard({
  verseKey,
  arabic,
  translation,
  translatorAttribution,
  reciterSlug,
  apiBase,
}: AyahCardProps): ReactNode {
  const [playing, setPlaying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [wbwOpen, setWbwOpen] = useState(false);
  const [wbw, setWbw] = useState<readonly WbwToken[] | null>(null);
  const [wbwLoading, setWbwLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioId = useId();

  const [_, ayahStr] = verseKey.split(':') as [string, string];
  const ayah = Number.parseInt(ayahStr, 10);

  // Restore bookmark state
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('qalaam-bookmarks');
      if (raw) {
        const set = new Set(JSON.parse(raw) as string[]);
        setBookmarked(set.has(verseKey));
      }
    } catch {
      /* ignore */
    }
  }, [verseKey]);

  function toggleBookmark(): void {
    try {
      const raw = window.localStorage.getItem('qalaam-bookmarks');
      const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      if (set.has(verseKey)) set.delete(verseKey);
      else set.add(verseKey);
      window.localStorage.setItem('qalaam-bookmarks', JSON.stringify(Array.from(set)));
      setBookmarked(set.has(verseKey));
    } catch {
      /* ignore */
    }
  }

  async function togglePlay(): Promise<void> {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!audioRef.current) {
      try {
        const res = await fetch(`${apiBase}/v1/audio/by_verse/${encodeURIComponent(verseKey)}/${reciterSlug}`);
        if (!res.ok) return;
        const body = (await res.json()) as { audioUrl: string };
        const a = new Audio(body.audioUrl);
        a.addEventListener('ended', () => {
          setPlaying(false);
        });
        audioRef.current = a;
      } catch {
        return;
      }
    }
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  async function toggleWbw(): Promise<void> {
    if (wbwOpen) {
      setWbwOpen(false);
      return;
    }
    setWbwOpen(true);
    if (wbw) return;
    setWbwLoading(true);
    try {
      const res = await fetch(`${apiBase}/v1/wbw/${encodeURIComponent(verseKey)}`);
      if (!res.ok) {
        setWbwLoading(false);
        return;
      }
      const body = (await res.json()) as { data: { words: WbwToken[] } };
      setWbw(body.data.words);
    } catch {
      /* ignore */
    } finally {
      setWbwLoading(false);
    }
  }

  function copyShareLink(): void {
    try {
      const url = `${window.location.origin}/read/${verseKey.split(':')[0] ?? '1'}#${verseKey}`;
      void navigator.clipboard?.writeText(url);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      id={verseKey}
      className="paper-card-raised relative px-5 py-7 sm:px-8 sm:py-9 md:px-12 md:py-12 reveal scroll-mt-24"
    >
      {/* Ayah number tile, top-left (top-right in RTL pages) */}
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6 flex items-center gap-2">
        <span className="rosette inline-flex items-center justify-center text-leaf font-arabic text-sm tabular-nums">
          {arabicNumeral(ayah)}
        </span>
        <span className="smallcaps text-ink-muted text-xs tracking-widest">
          {verseKey}
        </span>
      </div>

      {/* Arabic verse — mushaf-faithful (no justify, no kashida stretch) */}
      <p
        dir="rtl"
        className="font-arabic text-ink-strong text-center leading-[2.0] sm:leading-[2.1] mt-12 sm:mt-14 mb-8"
        style={{
          fontSize: 'clamp(1.6rem, 1.2rem + 1.6vw, 2.4rem)',
          unicodeBidi: 'plaintext',
          fontWeight: 600,
          textAlign: 'center',
          wordSpacing: '0.05em',
        }}
        aria-label={`Verse ${verseKey}`}
      >
        {arabic}
      </p>

      {/* Translation underneath — only if a translation is available + selected */}
      {translation ? (
        <div className="mt-2 mb-6 max-w-prose mx-auto">
          <p className="text-base sm:text-lg text-ink leading-relaxed text-center">
            {translation}
          </p>
          {translatorAttribution ? (
            <p className="smallcaps text-ink-muted text-[11px] mt-3 text-center tracking-widest">
              — {translatorAttribution}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* WBW expansion */}
      {wbwOpen ? (
        <div className="mt-4 border-t border-hairline pt-6">
          <p className="smallcaps text-leaf text-xs mb-4">Word by word</p>
          {wbwLoading ? (
            <p className="text-sm text-ink-muted italic">Loading…</p>
          ) : wbw && wbw.length > 0 ? (
            <ol
              dir="rtl"
              className="flex flex-wrap-reverse gap-3 sm:gap-4 justify-center"
              style={{ unicodeBidi: 'plaintext' }}
            >
              {wbw.map((w) => (
                <li key={`${w.verseKey}-${w.wordIndex.toString()}`} className="text-center">
                  <p
                    dir="rtl"
                    className="font-arabic text-2xl sm:text-3xl text-ink-strong"
                    style={{ unicodeBidi: 'plaintext', fontWeight: 600, lineHeight: 1.4 }}
                  >
                    {w.textArabic}
                  </p>
                  {w.translation ? (
                    <p
                      dir="ltr"
                      className="text-[11px] text-ink-muted mt-1 max-w-[6rem] mx-auto leading-snug"
                    >
                      {w.translation}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-muted italic">No word splits available for this ayah.</p>
          )}
        </div>
      ) : null}

      {/* Action row — chips. Mobile-first, scroll-x on small screens. */}
      <nav
        aria-label={`Actions for ${verseKey}`}
        className="mt-2 -mx-2 sm:mx-0 px-2 overflow-x-auto sm:overflow-visible"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-max sm:min-w-0">
          <button
            type="button"
            onClick={() => void togglePlay()}
            aria-pressed={playing}
            aria-controls={audioId}
            className={`inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-xs smallcaps tracking-wider transition-colors ${
              playing ? 'bg-leaf text-paper border-leaf' : 'text-ink hover:bg-paper-100'
            }`}
          >
            <PlayIcon playing={playing} />
            {playing ? 'Pause' : 'Listen'}
          </button>
          <button
            type="button"
            onClick={() => void toggleWbw()}
            aria-pressed={wbwOpen}
            className={`inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-xs smallcaps tracking-wider transition-colors ${
              wbwOpen ? 'bg-paper-200 text-ink' : 'text-ink hover:bg-paper-100'
            }`}
          >
            <WbwIcon />
            Word by word
          </button>
          <button
            type="button"
            disabled
            title="Tafsir ingest arrives in v0.5"
            className="inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-xs smallcaps tracking-wider text-ink-muted opacity-50 cursor-not-allowed"
          >
            <TafsirIcon />
            Tafsir
          </button>
          <button
            type="button"
            onClick={toggleBookmark}
            aria-pressed={bookmarked}
            className={`inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-xs smallcaps tracking-wider transition-colors ${
              bookmarked ? 'text-leaf border-leaf' : 'text-ink hover:bg-paper-100'
            }`}
          >
            <BookmarkIcon filled={bookmarked} />
            {bookmarked ? 'Saved' : 'Bookmark'}
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            className="inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-xs smallcaps tracking-wider text-ink hover:bg-paper-100 transition-colors"
          >
            <ShareIcon />
            Share
          </button>
        </div>
      </nav>

      <audio id={audioId} ref={audioRef} preload="none" />
    </article>
  );
}
