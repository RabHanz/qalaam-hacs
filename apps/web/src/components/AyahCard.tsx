'use client';

/**
 * AyahCard — Quranly-style ayah card. Mobile-first.
 *
 * Layout (375px viewport upward):
 *
 *   ┌──────────────────────────────────────┐
 *   │  ٢٥٥  · 2:255                         │
 *   │                                       │
 *   │            Arabic verse here          │  (RTL, plaintext bidi, no justify)
 *   │                                       │
 *   │  English translation here             │  (LTR, sans, smaller, muted)
 *   │                                       │
 *   │  ▶ Listen   ▤ WBW   ⌘ Tafsir   …      │  (chip row, wrap on mobile)
 *   └──────────────────────────────────────┘
 *
 * Translator attribution is rendered ONCE at the top of /read/[surah]
 * (next to the translation chip-bar), NOT per verse. Per-verse repetition
 * is visual noise the user explicitly called out.
 *
 * Listen button: the audio URL is pre-fetched as soon as the reciter is
 * known (in an effect), so the click handler stays inside the user-gesture
 * window — `audio.play()` gets called synchronously, no async race.
 *
 * Tafsir chip: live when the backend's qalaam_v1_tafsirs has a row for
 * this verse + slug; falls back gracefully when not.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

interface AyahCardProps {
  readonly verseKey: string;
  readonly arabic: string;
  readonly translation: string | null;
  readonly tafsirSlug?: string | null;
  readonly reciterSlug: string;
  /** Optional, ignored — always resolves to the same-origin /api proxy on
   *  the client. Kept so existing parents compile unchanged. */
  readonly apiBase?: string;
  /** Word index (0-based) currently being recited by the continuous
   *  player. When non-null, the matching word in this card is painted
   *  with the highlight color. */
  readonly highlightWordIndex?: number | null;
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

function SpinnerIcon(): ReactNode {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
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
  tafsirSlug,
  reciterSlug,
  highlightWordIndex,
}: AyahCardProps): ReactNode {
  const apiBase = resolveApiBase();
  const [playing, setPlaying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [wbwOpen, setWbwOpen] = useState(false);
  const [wbw, setWbw] = useState<readonly WbwToken[] | null>(null);
  const [wbwLoading, setWbwLoading] = useState(false);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsir, setTafsir] = useState<{ text: string; lang: string; scholar: string | null; loading: boolean } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Intent flag: user clicked Listen but URL was not ready yet. When the
  // src lands (canplay event), we honor the pending intent and start
  // playback. This survives the iOS Safari autoplay policy because the
  // .play() call STILL chains from the user's click via the ref-bound
  // promise, even though it happens asynchronously.
  const playIntentRef = useRef(false);

  const ayah = Number.parseInt(verseKey.split(':')[1] ?? '0', 10);

  // Reset audio when (verseKey, reciter) changes. We DO NOT pre-fetch —
  // fetching audio URLs for all 286 ayahs of Surah 2 on mount is wasteful
  // and would saturate the browser's per-origin connection pool. Lazy
  // fetch on first click. Most users never tap Listen on every ayah.
  useEffect(() => {
    setAudioUrl(null);
    setPlaying(false);
    setAudioLoading(false);
    playIntentRef.current = false;
  }, [verseKey, reciterSlug]);

  // Pause when another player claims audio focus (continuous reader,
  // MiniPlayer on /listen, sibling ayah cards).
  useEffect(() => {
    function onClaim(e: Event): void {
      const detail = (e as CustomEvent<{ source: string }>).detail;
      if (detail.source === `ayah:${verseKey}`) return;
      const a = audioRef.current;
      if (a && !a.paused) {
        a.pause();
      }
    }
    window.addEventListener('qalaam:audio-claim', onClaim);
    return () => window.removeEventListener('qalaam:audio-claim', onClaim);
  }, [verseKey]);

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
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    // Claim audio focus — any continuous player or other ayah card
    // that's playing will pause when it sees this event.
    window.dispatchEvent(
      new CustomEvent('qalaam:audio-claim', { detail: { source: `ayah:${verseKey}` } }),
    );
    if (audioUrl) {
      // We already have the URL — play right now (synchronous gesture chain)
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(
          () => setPlaying(true),
          () => setPlaying(false),
        );
      } else {
        setPlaying(true);
      }
      return;
    }
    // First click: lazy-fetch URL, then play when canplay fires.
    setAudioLoading(true);
    playIntentRef.current = true;
    try {
      const res = await fetch(
        `${apiBase}/v1/audio/by_verse/${encodeURIComponent(verseKey)}/${reciterSlug}`,
      );
      if (!res.ok) {
        setAudioLoading(false);
        playIntentRef.current = false;
        return;
      }
      const body = (await res.json()) as { audioUrl: string };
      setAudioUrl(body.audioUrl);
      // Don't call play() here — onCanPlay handler does it once the
      // browser actually has data. This avoids the "play() failed because
      // no audio data" rejection.
    } catch {
      setAudioLoading(false);
      playIntentRef.current = false;
    }
  }

  function handleCanPlay(): void {
    setAudioLoading(false);
    if (!playIntentRef.current) return;
    playIntentRef.current = false;
    const a = audioRef.current;
    if (!a) return;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      setPlaying(true);
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

  async function toggleTafsir(): Promise<void> {
    if (!tafsirSlug) return;
    if (tafsirOpen) {
      setTafsirOpen(false);
      return;
    }
    setTafsirOpen(true);
    if (tafsir?.text) return;
    setTafsir({ text: '', lang: 'en', scholar: null, loading: true });
    try {
      const res = await fetch(
        `${apiBase}/v1/tafsirs/${tafsirSlug}/by_verse/${encodeURIComponent(verseKey)}`,
      );
      if (!res.ok) {
        setTafsir({ text: '', lang: 'en', scholar: null, loading: false });
        return;
      }
      const body = (await res.json()) as { text: string; language?: string; scholar?: string | null };
      setTafsir({
        text: body.text ?? '',
        lang: body.language ?? 'en',
        scholar: body.scholar ?? null,
        loading: false,
      });
    } catch {
      setTafsir({ text: '', lang: 'en', scholar: null, loading: false });
    }
  }

  function copyShareLink(): void {
    try {
      const url = `${window.location.origin}/read/${verseKey.split(':')[0] ?? '1'}#${verseKey}`;
      void navigator.clipboard?.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      id={verseKey}
      className="paper-card-raised relative overflow-hidden p-4 sm:p-7 md:p-10 reveal scroll-mt-24"
    >
      {/* Ayah header row */}
      <header className="flex items-center justify-between gap-2 mb-4">
        <span className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-hairline text-leaf font-arabic text-sm tabular-nums shrink-0">
          {arabicNumeral(ayah)}
        </span>
        <span className="smallcaps text-ink-muted text-[10px] sm:text-xs tracking-widest tabular-nums">
          {verseKey}
        </span>
      </header>

      {/* Arabic verse — no justify, no kashida; clamp keeps it inside 375px.
          When the continuous player passes a highlightWordIndex, split
          the text on whitespace and paint the matching word. */}
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic text-ink-strong text-center leading-[1.95] sm:leading-[2.05] mb-5 sm:mb-7 break-words"
        style={{
          fontSize: 'clamp(1.35rem, 0.95rem + 1.4vw, 2.1rem)',
          unicodeBidi: 'plaintext',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: '100%',
          overflowWrap: 'break-word',
        }}
        aria-label={`Verse ${verseKey}`}
      >
        {highlightWordIndex !== undefined && highlightWordIndex !== null ? (
          arabic.split(/\s+/).map((word, i, arr) => (
            <span
              key={i}
              className={i === highlightWordIndex ? 'recite-highlight' : undefined}
            >
              {word}
              {i < arr.length - 1 ? ' ' : ''}
            </span>
          ))
        ) : (
          arabic
        )}
      </p>

      {/* Translation — distinctly LTR, sans, smaller, muted-ish to read as gloss.
          Left-aligned (Tailwind text-start) so English prose breaks naturally. */}
      {translation ? (
        <p
          dir="ltr"
          lang="en"
          className="mt-1 mb-6 max-w-prose mx-auto text-[15px] sm:text-base leading-relaxed text-ink/85 text-start"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {translation}
        </p>
      ) : null}

      {/* WBW expansion */}
      {wbwOpen ? (
        <div className="mt-2 mb-2 border-t border-hairline pt-5">
          <p className="smallcaps text-leaf text-[11px] tracking-widest mb-3">Word by word</p>
          {wbwLoading ? (
            <p className="text-sm text-ink-muted italic">Loading…</p>
          ) : wbw && wbw.length > 0 ? (
            <ol
              dir="rtl"
              className="flex flex-wrap-reverse gap-x-3 gap-y-4 justify-center"
              style={{ unicodeBidi: 'plaintext' }}
            >
              {wbw.map((w) => (
                <li key={`${w.verseKey}-${w.wordIndex.toString()}`} className="text-center">
                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-xl sm:text-2xl text-ink-strong"
                    style={{ unicodeBidi: 'plaintext', fontWeight: 600, lineHeight: 1.5 }}
                  >
                    {w.textArabic}
                  </p>
                  {w.translation ? (
                    <p
                      dir="ltr"
                      lang="en"
                      className="text-[10px] text-ink-muted mt-0.5 max-w-[5.5rem] mx-auto leading-snug"
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

      {/* Tafsir expansion */}
      {tafsirOpen ? (
        <div className="mt-2 mb-2 border-t border-hairline pt-5">
          <p className="smallcaps text-leaf text-[11px] tracking-widest mb-3">
            Tafsir{tafsir?.scholar ? ` · ${tafsir.scholar}` : ''}
          </p>
          {tafsir?.loading ? (
            <p className="text-sm text-ink-muted italic">Loading…</p>
          ) : tafsir?.text ? (
            tafsir.lang === 'ar' ? (
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-base sm:text-lg text-ink leading-loose max-w-prose mx-auto"
                style={{ unicodeBidi: 'plaintext', fontWeight: 500 }}
              >
                {tafsir.text}
              </p>
            ) : (
              <p
                dir="ltr"
                lang={tafsir.lang || 'en'}
                className="text-sm sm:text-base text-ink leading-relaxed max-w-prose mx-auto"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {tafsir.text}
              </p>
            )
          ) : (
            <p className="text-sm text-ink-muted italic">
              Tafsir not available for this ayah yet.
            </p>
          )}
        </div>
      ) : null}

      {/* Mounted audio element — required for reliable playback. */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        onCanPlay={handleCanPlay}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {/* Action chip row — wraps on mobile, no horizontal scroll */}
      <nav
        aria-label={`Actions for ${verseKey}`}
        className="mt-3 flex flex-wrap gap-1.5 sm:gap-2"
      >
        <ChipButton
          onClick={() => void togglePlay()}
          active={playing || audioLoading}
          icon={audioLoading ? <SpinnerIcon /> : <PlayIcon playing={playing} />}
          label={audioLoading ? 'Loading' : playing ? 'Pause' : 'Listen'}
          flagAccent={playing}
        />
        <ChipButton
          onClick={() => void toggleWbw()}
          active={wbwOpen}
          icon={<WbwIcon />}
          label="Word"
        />
        <ChipButton
          onClick={() => void toggleTafsir()}
          active={tafsirOpen}
          disabled={!tafsirSlug}
          icon={<TafsirIcon />}
          label="Tafsir"
        />
        <ChipButton
          onClick={toggleBookmark}
          active={bookmarked}
          flagAccent={bookmarked}
          icon={<BookmarkIcon filled={bookmarked} />}
          label={bookmarked ? 'Saved' : 'Save'}
        />
        <ChipButton
          onClick={copyShareLink}
          active={shareCopied}
          icon={<ShareIcon />}
          label={shareCopied ? 'Copied' : 'Share'}
        />
      </nav>
    </article>
  );
}

interface ChipButtonProps {
  readonly onClick: () => void;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly flagAccent?: boolean;
  readonly icon: ReactNode;
  readonly label: string;
}

function ChipButton({
  onClick,
  active = false,
  disabled = false,
  flagAccent = false,
  icon,
  label,
}: ChipButtonProps): ReactNode {
  const base =
    'inline-flex items-center gap-1.5 rounded-full border min-h-[36px] px-3 py-1.5 text-[11px] sm:text-xs smallcaps tracking-wider transition-colors';
  let cls = `${base} border-hairline text-ink hover:bg-paper-100`;
  if (disabled) cls = `${base} border-hairline text-ink-muted opacity-50 cursor-not-allowed`;
  else if (flagAccent && active) cls = `${base} bg-leaf text-paper border-leaf`;
  else if (active) cls = `${base} bg-paper-200 text-ink border-paper-200`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cls}
    >
      {icon}
      {label}
    </button>
  );
}
