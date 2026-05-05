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

import { resolveApiBase } from '../lib/api-base.js';
import { SILENT_MARK_REGEX } from '../lib/arabic-render.js';
import { sanitizeHtml } from '../lib/sanitize-html.js';
import { applyTajweed, fetchTajweed, type TajweedAnnotation } from '../lib/tajweed.js';

import { ShareDialog } from './ShareDialog.js';

import type { ReactNode } from 'react';

interface AyahCardProps {
  readonly verseKey: string;
  readonly arabic: string;
  readonly translation: string | null;
  /** Optional phonetic transliteration text in the user's chosen
   *  edition (en.transliteration, tr.transliteration, ru.transliteration).
   *  Rendered between the Arabic and the translation in a distinct
   *  italic register so it reads as a phonetic bridge, not a gloss. */
  readonly transliteration?: string | null;
  readonly tafsirSlug?: string | null;
  /** Active translation slug — forwarded to ShareDialog so the card
   *  reflects what /read is currently showing. */
  readonly translationSlug?: string | null;
  /** Active transliteration slug. */
  readonly transliterationSlug?: string | null;
  readonly reciterSlug: string;
  /** Optional, ignored — always resolves to the same-origin /api proxy on
   *  the client. Kept so existing parents compile unchanged. */
  readonly apiBase?: string;
  /** Word index (0-based) currently being recited by the continuous
   *  player. When non-null, the matching word in this card is painted
   *  with the highlight color. */
  readonly highlightWordIndex?: number | null;
  /** Active layout slug — drives the script + font for the verse
   *  rendering so /read continuous mode honors the layout chip. */
  readonly layoutSlug?: string;
}

function arabicNumeral(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
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
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
      <line x1="4" y1="12" x2="14" y2="12" strokeLinecap="round" />
      <line x1="4" y1="17" x2="17" y2="17" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M6 4h12v18l-6-4-6 4z" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon(): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
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
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

function TafsirIcon(): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
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
  transliteration,
  tafsirSlug,
  translationSlug,
  transliterationSlug,
  reciterSlug,
  highlightWordIndex,
  layoutSlug,
}: AyahCardProps): ReactNode {
  const fontFamily =
    layoutSlug === 'kfgqpc_v1' || layoutSlug === 'indopak'
      ? // AlQuranIndoPak is the official QUL/Quran-Foundation IndoPak
        // font — self-hosted at /fonts/quran-indopak/. 411 glyphs, full
        // coverage of every codepoint we render. No fallback needed.
        '"AlQuranIndoPak"'
      : // UthmanicHafs is the official KFGQPC Hafs Uthmani font from
        // Quran Foundation, self-hosted. Full Unicode + GSUB coverage.
        '"UthmanicHafs"';
  const apiBase = resolveApiBase();
  const [playing, setPlaying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [wbwOpen, setWbwOpen] = useState(false);
  const [wbw, setWbw] = useState<readonly WbwToken[] | null>(null);
  const [wbwLoading, setWbwLoading] = useState(false);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsir, setTafsir] = useState<{
    text: string;
    lang: string;
    scholar: string | null;
    loading: boolean;
  } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Tajweed annotations — only fetched when the layout slug indicates
  // tajweed coloring (kfgqpc_v4 / tajweed). Other layouts skip the
  // fetch entirely. Used by the CSS-overlay tajweed fallback path.
  const tajweedActive = layoutSlug === 'kfgqpc_v4' || layoutSlug === 'tajweed';
  const [tajweedAnno, setTajweedAnno] = useState<readonly TajweedAnnotation[] | null>(null);
  useEffect(() => {
    if (!tajweedActive) {
      setTajweedAnno(null);
      return;
    }
    const cancelled = { v: false };
    void (async () => {
      const apiBase = resolveApiBase();
      const list = await fetchTajweed(apiBase, verseKey);
      if (!cancelled.v) setTajweedAnno(list);
    })();
    return () => {
      cancelled.v = true;
    };
  }, [tajweedActive, verseKey]);

  // V4 PUA-encoded text + page-specific font. When this loads we render
  // with the canonical KFGQPC V4 Tajweed COLR/CPAL color font (tajweed
  // colors baked into the font, no CSS overlay). Falls back to the
  // CSS-overlay `tajweedAnno` path if the fetch fails or returns no
  // page mapping (e.g. hypothetical future re-ingest gaps).
  interface QpcV4Verse {
    pageNumber: number | null;
    fontFamily: string | null;
    words: readonly { wordIndex: number; text: string }[];
  }
  const [qpcV4, setQpcV4] = useState<QpcV4Verse | null>(null);
  useEffect(() => {
    if (!tajweedActive) {
      setQpcV4(null);
      return;
    }
    const cancelled = { v: false };
    void (async () => {
      try {
        const apiBase = resolveApiBase();
        const res = await fetch(`${apiBase}/v1/qpc-text/${encodeURIComponent(verseKey)}?layout=v4`);
        if (!res.ok) return;
        const body = (await res.json()) as QpcV4Verse;
        if (!cancelled.v) setQpcV4(body);
      } catch {
        /* falls back to CSS-overlay path */
      }
    })();
    return () => {
      cancelled.v = true;
    };
  }, [tajweedActive, verseKey]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Word-highlight state — populated while THIS ayah's Listen button
  // is playing. Independent of the highlightWordIndex prop (which is
  // driven by the global continuous player).
  const [selfHighlightIdx, setSelfHighlightIdx] = useState<number | null>(null);
  const segmentsRef = useRef<{ wordIndex: number; startMs: number; endMs: number }[]>([]);
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

  // Pause when another player claims audio focus.
  useEffect(() => {
    function onClaim(e: Event): void {
      const detail = (e as CustomEvent<{ source: string }>).detail;
      if (detail.source === `ayah:${verseKey}`) return;
      const a = audioRef.current;
      if (a && !a.paused) {
        a.pause();
      }
      setSelfHighlightIdx(null);
    }
    window.addEventListener('qalaam:audio-claim', onClaim);
    return () => {
      window.removeEventListener('qalaam:audio-claim', onClaim);
    };
  }, [verseKey]);

  // Pre-load segments when reciter or verse changes so word-highlight
  // is ready to fire as soon as the user taps Listen.
  useEffect(() => {
    const cancelled = { v: false };
    void (async () => {
      try {
        const r = await fetch(
          `${apiBase}/v1/recitations/${reciterSlug}/segments/${encodeURIComponent(verseKey)}`,
        );
        if (!r.ok || cancelled.v) return;
        const body = (await r.json()) as {
          data?: { wordIndex: number; startMs: number; endMs: number }[];
        };
        segmentsRef.current = body.data ?? [];
      } catch {
        segmentsRef.current = [];
      }
    })();
    return () => {
      cancelled.v = true;
    };
  }, [verseKey, reciterSlug, apiBase]);

  // Drive word-highlight via rAF while THIS ayah is playing. Mirrors
  // the continuous player's highlight algorithm but scoped to one
  // ayah, and writes to local state (not the global onHighlight).
  useEffect(() => {
    if (!playing) {
      setSelfHighlightIdx(null);
      return;
    }
    let raf = 0;
    function tick(): void {
      const a = audioRef.current;
      const segs = segmentsRef.current;
      if (a && segs.length > 0) {
        const tMs = a.currentTime * 1000;
        const lookahead = tMs + 80;
        let active: { wordIndex: number; startMs: number; endMs: number } | null = null;
        for (const s of segs) {
          if (lookahead >= s.startMs && lookahead <= s.endMs) {
            active = s;
            break;
          }
        }
        const last = segs[segs.length - 1];
        if (!active && last && tMs > last.endMs) {
          // Past the last segment — paint the verse-end / final word.
          setSelfHighlightIdx(last.wordIndex);
          raf = requestAnimationFrame(tick);
          return;
        }
        if (!active) {
          // Between segments — keep last passed.
          let mostRecent: { wordIndex: number; startMs: number; endMs: number } | null = null;
          for (const s of segs) if (s.endMs < lookahead) mostRecent = s;
          if (mostRecent) setSelfHighlightIdx(mostRecent.wordIndex - 1);
        } else {
          setSelfHighlightIdx(active.wordIndex - 1);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [playing]);

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
    // Remember this as the user's "last played" verse for the
    // surah, so the continuous player resumes from here next time.
    try {
      const surah = verseKey.split(':')[0] ?? '';
      const raw = window.localStorage.getItem('qalaam-last-played-verse');
      const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[surah] = verseKey;
      window.localStorage.setItem('qalaam-last-played-verse', JSON.stringify(map));
    } catch {
      /* ignore */
    }
    if (audioUrl) {
      // We already have the URL — play right now (synchronous gesture chain).
      // Older audio engines returned undefined; modern browsers return a
      // Promise. We void the promise to keep eslint happy and handle states
      // through the onPlay/onPause/onEnded handlers.
      void Promise.resolve(a.play()).then(
        () => {
          setPlaying(true);
        },
        () => {
          setPlaying(false);
        },
      );
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
    void Promise.resolve(a.play()).then(
      () => {
        setPlaying(true);
      },
      () => {
        setPlaying(false);
      },
    );
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
      const body = (await res.json()) as {
        text?: string;
        language?: string;
        scholar?: string | null;
      };
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

  // Share is now handled by the ShareDialog mounted at the bottom of
  // this component (see <ShareDialog open={shareOpen} ... />). The
  // chip toggles the modal which holds variant tabs, preview, and
  // native-share / download / copy actions.

  return (
    <article
      id={verseKey}
      className="paper-card-raised reveal relative scroll-mt-24 overflow-hidden p-4 sm:p-7 md:p-10"
    >
      {/* Ayah header row */}
      <header className="mb-4 flex items-center justify-between gap-2">
        <span className="border-hairline text-leaf font-arabic inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm tabular-nums sm:h-9 sm:w-9">
          {arabicNumeral(ayah)}
        </span>
        <span className="smallcaps text-ink-muted text-[10px] tabular-nums tracking-widest sm:text-xs">
          {verseKey}
        </span>
      </header>

      {/* Arabic verse — no justify, no kashida; clamp keeps it inside 375px.
          When the continuous player passes a highlightWordIndex, split
          the text on whitespace and paint the matching word. */}
      <p
        dir="rtl"
        lang="ar"
        className="text-ink-strong mb-5 break-words text-center leading-[1.95] sm:mb-7 sm:leading-[2.05]"
        style={{
          fontFamily,
          fontSize: 'clamp(1.35rem, 0.95rem + 1.4vw, 2.1rem)',
          unicodeBidi: 'plaintext',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: '100%',
          overflowWrap: 'break-word',
        }}
        aria-label={`Verse ${verseKey}`}
      >
        {(() => {
          // PRIORITY 1: KFGQPC V4 Tajweed canonical render — PUA-encoded
          // text rendered with the matching per-page COLR/CPAL color
          // font. Tajweed colours are BAKED INTO THE FONT'S COLOR
          // TABLES, not applied via CSS spans — bit-for-bit identical
          // to the printed KFGQPC V4 1441H mushaf. No CSS-overlay
          // approximation. Sourced from QUL #47 + Quran Foundation's
          // 604 per-page woff2 fonts.
          if (tajweedActive && qpcV4?.fontFamily && qpcV4.words.length > 0) {
            const idx = selfHighlightIdx ?? highlightWordIndex ?? null;
            const fontFamily = qpcV4.fontFamily;
            const words = qpcV4.words;
            return words.map((w, i) => {
              const isActive = idx !== null && i === idx;
              const sep = i < words.length - 1 ? ' ' : '';
              return (
                <span
                  key={`qpc-v4-${w.wordIndex.toString()}`}
                  className={isActive ? 'recite-highlight' : undefined}
                  style={{
                    fontFamily: `"${fontFamily}"`,
                    // The COLR/CPAL color font carries its own coloring;
                    // we pass color: inherit only as a fallback for the
                    // very brief frame before the page font lands.
                    color: 'inherit',
                  }}
                >
                  {w.text}
                  {sep}
                </span>
              );
            });
          }
          // PRIORITY 2 (fallback): CSS-overlay tajweed — when V4 PUA
          // data isn't available (e.g. fetch failed, page-mapping gap),
          // fall back to per-word annotation coloring on UthmanicHafs
          // Unicode text. Renders as colored char-segments PER WORD so
          // each word remains its own joining context. Splitting
          // letters across spans breaks Arabic glyph-joining.
          if (tajweedActive && tajweedAnno && tajweedAnno.length > 0) {
            const tWords = arabic.split(/(\s+)/); // keep whitespace tokens
            const out: ReactNode[] = [];
            let charCursor = 0;
            // Track the WORD index (excluding whitespace tokens) so the
            // continuous player's recite-highlight can match the same
            // word index used by the default render path. Without this,
            // /read/Tajweed (and IndoPak via this branch) had no word
            // highlight during playback — a regression after I added
            // silent-mark wrapping here.
            const idx = selfHighlightIdx ?? highlightWordIndex ?? null;
            let activeWordIndex = -1;
            // Same low-mark detection used in the default render path —
            // U+06E3 small low seen, U+06EA empty-centre low stop, U+06ED
            // small low meem all sit BELOW the baseline, not above. The
            // .silent-mark-low CSS modifier inverts the translateY so
            // they don't float onto the letter above (the "م overlap"
            // bug on words like ٱنتِقَامٍۭ).
            const LOW_MARKS = new Set([0x06e3, 0x06ea, 0x06ed]);
            const ZERO_MARKS = new Set([0x06df, 0x06e0]);
            const wrapWithMarks = (
              text: string,
              ruleClass: string | undefined,
              keyBase: string,
            ): ReactNode[] => {
              const parts = text.split(SILENT_MARK_REGEX);
              return parts.map((p, pi) => {
                if (SILENT_MARK_REGEX.test(p)) {
                  const cp = p.codePointAt(0) ?? 0;
                  const variantCls = LOW_MARKS.has(cp)
                    ? ' silent-mark-low'
                    : ZERO_MARKS.has(cp)
                      ? ' silent-mark-zero'
                      : '';
                  // Tajweed rule color also paints the silent mark — keeps
                  // it visually consistent with the surrounding segment.
                  const ruleCls = ruleClass ? ` ${ruleClass}` : '';
                  return (
                    <span
                      key={`${keyBase}-sm${pi.toString()}`}
                      className={`silent-mark${variantCls}${ruleCls}`}
                    >
                      {p}
                    </span>
                  );
                }
                if (p.length === 0) return null;
                return ruleClass ? (
                  <span key={`${keyBase}-t${pi.toString()}`} className={ruleClass}>
                    {p}
                  </span>
                ) : (
                  <span key={`${keyBase}-t${pi.toString()}`}>{p}</span>
                );
              });
            };
            for (let wi = 0; wi < tWords.length; wi++) {
              const word = tWords[wi] ?? '';
              if (word.length === 0) continue;
              if (/^\s+$/.test(word)) {
                out.push(word);
                charCursor += word.length;
                continue;
              }
              activeWordIndex += 1;
              const isActive = idx !== null && activeWordIndex === idx;
              const highlightCls = isActive ? ' recite-highlight' : '';
              const wStart = charCursor;
              const wEnd = wStart + word.length;
              // Local annotations clipped to this word's range
              const local = tajweedAnno
                .filter((a) => a.end > wStart && a.start < wEnd)
                .map((a) => ({
                  start: Math.max(0, a.start - wStart),
                  end: Math.min(word.length, a.end - wStart),
                  rule: a.rule,
                }));
              if (local.length === 0) {
                // No tajweed coloring on this word — still wrap silent
                // marks so they render as discreet superscripts /
                // sub-baseline dots per the .silent-mark CSS rule.
                out.push(
                  <span key={`tw-${wi.toString()}`} className={highlightCls.trim() || undefined}>
                    {wrapWithMarks(word, undefined, `tw-${wi.toString()}`)}
                  </span>,
                );
              } else {
                const segs = applyTajweed(word, local);
                out.push(
                  <span
                    key={`tw-${wi.toString()}`}
                    className={highlightCls.trim() || undefined}
                    style={{ display: 'inline' }}
                  >
                    {segs.map((seg, si) => (
                      <span key={`tw-${wi.toString()}-s${si.toString()}`}>
                        {wrapWithMarks(
                          seg.text,
                          seg.rule ? `tajweed-${seg.rule}` : undefined,
                          `tw-${wi.toString()}-s${si.toString()}`,
                        )}
                      </span>
                    ))}
                  </span>,
                );
              }
              charCursor = wEnd;
            }
            return out;
          }
          // Default: split into words; render each as a span (so the
          // active one can pick up recite-highlight). The TRAILING word
          // is the verse-end digit (e.g. "١") — render it as a proper
          // rosette anchor in UthmanicHafs (matches the mushaf rendering).
          //
          // Silent-mark handling — UthmanicHafs / IndoPak / Nastaliq
          // draw the small-high pause / sajda / madda / silent-letter
          // marks (U+06D6–U+06DC, U+06DF–U+06E5, U+06E7–U+06E8,
          // U+06EA–U+06ED) as full-size mid-line glyphs that read as
          // spurious rosettes inline (or, where the font lacks a glyph
          // — common on IndoPak — as `.notdef` tofu boxes overlapping
          // base letters like م). The frontier-app convention
          // (Quran.com, Tarteel, Quranly) is to render these as
          // discreet superscript marks. We split each word on those
          // codepoints, wrap matches in <span class="silent-mark"> so
          // globals.css shrinks them and lifts them above the baseline.
          // Single source of truth: lib/arabic-render.tsx
          //   SILENT_MARK_REGEX (excludes U+06DD ayah rosette,
          //   U+06DE rub-el-hizb, U+06E6 small yeh, U+06E9 sajdah).
          const idx = selfHighlightIdx ?? highlightWordIndex ?? null;
          const words = arabic.split(/\s+/);
          const ARABIC_DIGITS_RE = /^[٠-٩]+$/;
          const SILENT_MARK_RE = SILENT_MARK_REGEX;
          return words.map((word, i, arr) => {
            const isLast = i === arr.length - 1;
            const isDigit = ARABIC_DIGITS_RE.test(word);
            const highlighted = idx !== null && i === idx;
            const className = highlighted ? 'recite-highlight' : undefined;
            if (isLast && isDigit) {
              return (
                <span
                  key={i}
                  className={`ayah-end ${className ?? ''}`}
                  style={{ fontFamily: '"UthmanicHafs"' }}
                  title={`Ayah ${verseKey} — ends here`}
                  aria-label={`End of ayah ${verseKey}`}
                >
                  {word}
                </span>
              );
            }
            // Split each word on silent-mark codepoints + wrap them
            // so the .silent-mark CSS rule shrinks + lifts (high) /
            // pushes down (low) per the codepoint's typographic class.
            // Codepoints in LOW_MARKS (U+06E3, U+06EA, U+06ED) get the
            // `silent-mark-low` modifier so they sit BELOW the baseline
            // — fixes the "م overlap" on words like ٱنتِقَامٍۭ.
            const parts = word.split(SILENT_MARK_RE);
            const LOW_MARKS = new Set([0x06e3, 0x06ea, 0x06ed]);
            const ZERO_MARKS = new Set([0x06df, 0x06e0]);
            return (
              <span key={i} className={className}>
                {parts.map((p, pi) => {
                  if (SILENT_MARK_RE.test(p)) {
                    const cp = p.codePointAt(0) ?? 0;
                    const variant = LOW_MARKS.has(cp)
                      ? ' silent-mark-low'
                      : ZERO_MARKS.has(cp)
                        ? ' silent-mark-zero'
                        : '';
                    return (
                      <span
                        key={`${i.toString()}-sm-${pi.toString()}`}
                        className={`silent-mark${variant}`}
                      >
                        {p}
                      </span>
                    );
                  }
                  return <span key={`${i.toString()}-t-${pi.toString()}`}>{p}</span>;
                })}
                {!isLast ? ' ' : ''}
              </span>
            );
          });
        })()}
      </p>

      {/* Phonetic transliteration — italic, smaller, leaf-tinted so it
          reads as the bridge between the Arabic above and the gloss below.
          Centered to mirror the Arabic block; left-aligned would visually
          divorce it from the verse it's transliterating. */}
      {transliteration ? (
        <p
          dir="ltr"
          lang="en"
          className="text-leaf/80 mx-auto mb-3 mt-3 max-w-prose text-center text-sm italic leading-relaxed tracking-wide sm:text-[15px]"
          style={{ fontFamily: 'var(--font-display, var(--font-body))' }}
        >
          {transliteration}
        </p>
      ) : null}

      {/* Translation — distinctly LTR, sans, smaller, muted-ish to read as gloss.
          Left-aligned (Tailwind text-start) so English prose breaks naturally. */}
      {translation ? (
        <p
          dir="ltr"
          lang="en"
          className="text-ink/85 mx-auto mb-6 mt-1 max-w-prose text-start text-[15px] leading-relaxed sm:text-base"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {translation}
        </p>
      ) : null}

      {/* WBW expansion */}
      {wbwOpen ? (
        <div className="border-hairline mb-2 mt-2 border-t pt-5">
          <p className="smallcaps text-leaf mb-3 text-[11px] tracking-widest">Word by word</p>
          {wbwLoading ? (
            <p className="text-ink-muted text-sm italic">Loading…</p>
          ) : wbw && wbw.length > 0 ? (
            <ol
              dir="rtl"
              className="flex flex-wrap justify-center gap-x-3 gap-y-4"
              style={{ unicodeBidi: 'plaintext' }}
            >
              {wbw.map((w) => (
                <li key={`${w.verseKey}-${w.wordIndex.toString()}`} className="text-center">
                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-ink-strong text-xl sm:text-2xl"
                    style={{ unicodeBidi: 'plaintext', fontWeight: 600, lineHeight: 1.5 }}
                  >
                    {w.textArabic}
                  </p>
                  {w.translation ? (
                    <p
                      dir="ltr"
                      lang="en"
                      className="text-ink-muted mx-auto mt-0.5 max-w-[5.5rem] text-[10px] leading-snug"
                    >
                      {w.translation}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-muted text-sm italic">No word splits available for this ayah.</p>
          )}
        </div>
      ) : null}

      {/* Tafsir expansion */}
      {tafsirOpen ? (
        <div className="border-hairline mb-2 mt-2 border-t pt-5">
          <p className="smallcaps text-leaf mb-3 text-[11px] tracking-widest">
            Tafsir{tafsir?.scholar ? ` · ${tafsir.scholar}` : ''}
          </p>
          {tafsir?.loading ? (
            <p className="text-ink-muted text-sm italic">Loading…</p>
          ) : tafsir?.text ? (
            tafsir.lang === 'ar' ? (
              <div
                dir="rtl"
                lang="ar"
                className="font-arabic tafsir-prose text-ink mx-auto max-w-prose text-base leading-loose sm:text-lg"
                style={{ unicodeBidi: 'plaintext', fontWeight: 500 }}
                // Tafsir text from QUL contains scholar-grade markup
                // (`<span class="qpc-hafs">…</span>` for embedded ayah
                // quotes, `<p>`, `<sup>` for footnotes). Sanitize
                // through an allowlist before rendering — see
                // ../lib/sanitize-html.ts.
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(tafsir.text) }}
              />
            ) : (
              <div
                dir="ltr"
                lang={tafsir.lang || 'en'}
                className="text-ink tafsir-prose mx-auto max-w-prose text-sm leading-relaxed sm:text-base"
                style={{ fontFamily: 'var(--font-body)' }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(tafsir.text) }}
              />
            )
          ) : (
            <p className="text-ink-muted text-sm italic">Tafsir not available for this ayah yet.</p>
          )}
        </div>
      ) : null}

      {/* Mounted audio element — required for reliable playback. */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        onCanPlay={handleCanPlay}
        onEnded={() => {
          setPlaying(false);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onPlay={() => {
          setPlaying(true);
        }}
      />

      {/* Action chip row — wraps on mobile, no horizontal scroll */}
      <nav aria-label={`Actions for ${verseKey}`} className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
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
          onClick={() => {
            setShareOpen(true);
          }}
          active={shareOpen}
          icon={<ShareIcon />}
          label="Share"
        />
        <a
          href={`/listen/compare/${encodeURIComponent(verseKey)}`}
          title="Compare this verse across multiple reciters"
          className="border-hairline smallcaps text-ink-muted hover:text-leaf hover:border-leaf/40 inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] tracking-widest"
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            <path
              d="M5 9c2 0 2 6 5 6s2-12 5-12 2 12 5 12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Compare
        </a>
      </nav>
      <ShareDialog
        verseKey={verseKey}
        layoutSlug={layoutSlug}
        translationSlug={translationSlug ?? undefined}
        transliterationSlug={transliterationSlug ?? undefined}
        tafsirSlug={tafsirSlug ?? undefined}
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
        }}
      />
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
