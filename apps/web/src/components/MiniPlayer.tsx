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
import type { ReactNode } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

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
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
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

  // Resolve audio URL whenever (verseKey, reciter) changes
  useEffect(() => {
    let cancelled = false;
    setAudioUrl(null);
    setPosition(0);
    void (async () => {
      try {
        const res = await fetch(
          `${apiBase}/v1/audio/by_verse/${encodeURIComponent(verseKey)}/${reciterSlug}`,
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { audioUrl: string };
        if (!cancelled) setAudioUrl(body.audioUrl);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
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
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-paper-100/95 backdrop-blur-md"
        role="region"
        aria-label="Audio player"
      >
        <div className="mx-auto max-w-5xl px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              aria-label="Previous verse"
              onClick={() => advance(-1, playing)}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-ink hover:bg-paper-200/60"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 6h2v12H6zm3.5 6L20 6v12z" />
              </svg>
            </button>

            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={togglePlay}
              className="shrink-0 inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-leaf text-paper hover:opacity-90"
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
              onClick={() => advance(1, playing)}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-ink hover:bg-paper-200/60"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16 6h2v12h-2zM4 6l10.5 6L4 18z" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 hidden sm:block">
              <p className="font-display text-sm leading-tight truncate text-ink-strong">
                {reciterMeta?.name.en ?? reciterSlug}
                <span className="mx-2 text-ink-muted">·</span>
                <span className="font-mono tabular-nums text-ink-muted">{verseKey}</span>
              </p>
              <p className="text-[11px] smallcaps text-ink-muted tracking-widest mt-0.5">
                {format(position)} <span className="opacity-50">/</span> {format(duration)}
              </p>
            </div>

            <div className="min-w-0 flex-1 sm:hidden">
              <p className="text-[11px] smallcaps text-ink-muted tracking-widest tabular-nums">
                {arabicNumeral(Number.parseInt(verseKey.split(':')[1] ?? '0', 10))}
                <span className="mx-1">·</span>
                {format(position)} / {format(duration)}
              </p>
              <p className="font-mono tabular-nums text-xs text-ink truncate">
                {verseKey}
              </p>
            </div>

            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 1}
              step={0.1}
              value={position}
              onChange={onSeek}
              className="hidden sm:block flex-1 accent-leaf"
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
            className="block sm:hidden w-full mt-2 accent-leaf"
          />
        </div>
      </div>
    </>
  );
}
