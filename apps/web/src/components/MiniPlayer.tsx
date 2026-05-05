'use client';

/**
 * MiniPlayer — sticky bottom audio player. Controlled component.
 *
 * Parent owns `reciterSlug` + `verseKey` + `onVerseKeyChange` so this stays
 * in sync with the surrounding /listen surface (reciter cards + surah list).
 *
 * Single <audio> element. URL refetched whenever (verseKey, reciterSlug) changes.
 * Auto-advance hops to the next ayah on `ended`.
 *
 * Mobile-first: 64px tall on mobile (one row of controls + a separate row
 * for the scrubber), 72px on desktop. Big touch targets (min 44px).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

interface ReciterItem {
  readonly slug: string;
  readonly name: { en: string; ar: string };
}

interface MiniPlayerProps {
  /** Optional, ignored — always uses the same-origin /api proxy. */
  readonly apiBase?: string;
  readonly reciters: readonly ReciterItem[];
  readonly reciterSlug: string;
  readonly verseKey: string;
  readonly onVerseKeyChange: (next: string) => void;
}

function arabicNumeral(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
}

function format(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString()}:${s.toString().padStart(2, '0')}`;
}

export function MiniPlayer({
  reciters,
  reciterSlug,
  verseKey,
  onVerseKeyChange,
}: MiniPlayerProps): ReactNode {
  const apiBase = resolveApiBase();
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldResumeRef = useRef(false);

  const reciterMeta = reciters.find((r) => r.slug === reciterSlug);
  const segmentsRef = useRef<{ wordIndex: number; startMs: number; endMs: number }[]>([]);
  const lastHlRef = useRef<{ verseKey: string; wordIndex: number } | null>(null);

  // Broadcast highlight while playing — any listener (AyahCard, etc.)
  // can subscribe to qalaam:highlight and paint the matching word.
  useEffect(() => {
    if (!playing) {
      window.dispatchEvent(new CustomEvent('qalaam:highlight', { detail: null }));
      return;
    }
    let raf = 0;
    function tick(): void {
      const a = audioRef.current;
      const segs = segmentsRef.current;
      if (a && segs.length > 0) {
        const tMs = a.currentTime * 1000 + 80;
        let active: { wordIndex: number; startMs: number; endMs: number } | null = null;
        for (const s of segs) {
          if (tMs >= s.startMs && tMs <= s.endMs) {
            active = s;
            break;
          }
        }
        const last = segs[segs.length - 1];
        let wordIndex = -1;
        if (!active && last && tMs > last.endMs) wordIndex = last.wordIndex;
        else if (active) wordIndex = active.wordIndex - 1;
        if (wordIndex >= 0) {
          const next = { verseKey, wordIndex };
          const prev = lastHlRef.current;
          if (prev?.verseKey !== next.verseKey || prev.wordIndex !== next.wordIndex) {
            lastHlRef.current = next;
            window.dispatchEvent(new CustomEvent('qalaam:highlight', { detail: next }));
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [playing, verseKey]);

  // Resolve audio URL + segments whenever (verseKey, reciter) changes,
  // and broadcast the current word so any listener (e.g. an AyahCard
  // on the same page) can paint the matching word.
  useEffect(() => {
    // Object cell: lets the cleanup closure flip the cancellation flag
    // in a way eslint flow analysis can see (a let-rebinding looks
    // unmutated to it).
    const cancel = { v: false };
    setAudioUrl(null);
    setPosition(0);
    segmentsRef.current = [];
    void (async () => {
      try {
        const [res, segRes] = await Promise.all([
          fetch(`${apiBase}/v1/audio/by_verse/${encodeURIComponent(verseKey)}/${reciterSlug}`),
          fetch(
            `${apiBase}/v1/recitations/${reciterSlug}/segments/${encodeURIComponent(verseKey)}`,
          ),
        ]);
        if (!res.ok) return;
        const body = (await res.json()) as { audioUrl: string };
        if (!cancel.v) setAudioUrl(body.audioUrl);
        if (segRes.ok) {
          const segBody = (await segRes.json()) as {
            data: { wordIndex: number; startMs: number; endMs: number }[];
          };
          segmentsRef.current = segBody.data;
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel.v = true;
    };
  }, [verseKey, reciterSlug, apiBase]);

  // After URL is set + we wanted to resume, kick playback off. We have to
  // wait until the new src has loaded enough; `canplay` is the safest bet,
  // but on most browsers play() will queue and start once enough buffer is
  // available, so calling here is reliable.
  useEffect(() => {
    if (!audioUrl || !shouldResumeRef.current || !audioRef.current) return;
    const a = audioRef.current;
    shouldResumeRef.current = false;
    void a.play().then(
      () => {
        setPlaying(true);
      },
      () => {
        setPlaying(false);
      },
    );
  }, [audioUrl]);

  const advance = useCallback(
    (direction: 1 | -1, autoplay: boolean) => {
      const [s, a] = verseKey.split(':').map((n) => Number.parseInt(n, 10));
      if (!s || !a) return;
      const next = a + direction;
      if (next < 1) return;
      const nextKey = `${s.toString()}:${next.toString()}`;
      shouldResumeRef.current = autoplay;
      onVerseKeyChange(nextKey);
    },
    [verseKey, onVerseKeyChange],
  );

  function togglePlay(): void {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    if (!audioUrl) {
      // URL fetch still in flight — set the resume flag so the existing
      // useEffect kicks playback off as soon as audioUrl resolves.
      shouldResumeRef.current = true;
      return;
    }
    void a.play().then(
      () => {
        setPlaying(true);
      },
      () => {
        setPlaying(false);
      },
    );
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>): void {
    const a = audioRef.current;
    if (!a) return;
    const t = Number.parseFloat(e.target.value);
    a.currentTime = t;
    setPosition(t);
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
        }}
        onTimeUpdate={(e) => {
          setPosition(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
          advance(1, true);
        }}
      />
      <div
        className="border-hairline bg-paper-100/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md"
        role="region"
        aria-label="Audio player"
      >
        <div className="mx-auto max-w-5xl px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              aria-label="Previous verse"
              onClick={() => {
                advance(-1, playing);
              }}
              className="text-ink hover:bg-paper-200/60 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 6h2v12H6zm3.5 6L20 6v12z" />
              </svg>
            </button>

            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={togglePlay}
              className="bg-leaf text-paper inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:opacity-90 sm:h-12 sm:w-12"
            >
              {playing ? (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              aria-label="Next verse"
              onClick={() => {
                advance(1, playing);
              }}
              className="text-ink hover:bg-paper-200/60 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16 6h2v12h-2zM4 6l10.5 6L4 18z" />
              </svg>
            </button>

            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="font-display text-ink-strong truncate text-sm leading-tight">
                {reciterMeta?.name.en ?? reciterSlug}
                <span className="text-ink-muted mx-2">·</span>
                <span className="text-ink-muted font-mono tabular-nums">{verseKey}</span>
              </p>
              <p className="smallcaps text-ink-muted mt-0.5 text-[11px] tracking-widest">
                {format(position)} <span className="opacity-50">/</span> {format(duration)}
              </p>
            </div>

            <div className="min-w-0 flex-1 sm:hidden">
              <p className="smallcaps text-ink-muted text-[11px] tabular-nums tracking-widest">
                {arabicNumeral(Number.parseInt(verseKey.split(':')[1] ?? '0', 10))}
                <span className="mx-1">·</span>
                {format(position)} / {format(duration)}
              </p>
              <p className="text-ink truncate font-mono text-xs tabular-nums">{verseKey}</p>
            </div>

            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 1}
              step={0.1}
              value={position}
              onChange={onSeek}
              className="accent-leaf hidden flex-1 sm:block"
            />
          </div>

          <input
            type="range"
            aria-label="Seek (mobile)"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 1}
            step={0.1}
            value={position}
            onChange={onSeek}
            className="accent-leaf mt-2 block w-full sm:hidden"
          />
        </div>
      </div>
    </>
  );
}
