'use client';

/**
 * CompareClient — multi-reciter A/B/C/D comparison player.
 *
 * Each row is one reciter rendering the verse:
 *   - per-row HTMLAudioElement with its own playback state
 *   - synchronous "play all" / "pause all" master controls
 *   - "solo this reciter" toggle (mutes the others) for focused listening
 *
 * No timing-aware sync: starting all four at the same time is the right
 * behavior for this surface (compare HOW each one renders the verse,
 * including their natural pacing). For verse-aligned sync we'd need
 * stretching audio, which destroys the rendering being studied.
 */
import { useEffect, useRef, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

interface ReciterOption {
  readonly slug: string;
  readonly name: string;
}
interface Props {
  readonly verseKey: string;
  readonly verseText: string;
  readonly reciters: readonly ReciterOption[];
}

interface RowState {
  readonly slug: string;
  readonly name: string;
  audioUrl: string | null;
  playing: boolean;
  loading: boolean;
}

const STORE_KEY = 'qalaam-compare-reciters';
const MAX_ROWS = 4;

export function CompareClient({ verseKey, verseText, reciters }: Props): ReactNode {
  const apiBase = resolveApiBase();
  const [picked, setPicked] = useState<readonly string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (raw) {
          const arr = JSON.parse(raw) as string[];
          if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, MAX_ROWS);
        }
      } catch {
        /* ignore */
      }
    }
    // Sensible default: Sudais + Husary + Mishary + Maher.
    const defaults = ['sudais', 'husary', 'mishary-alafasy', 'maher-muaiqly'].filter((s) =>
      reciters.some((r) => r.slug === s),
    );
    return defaults.slice(0, 3);
  });
  const [rows, setRows] = useState<readonly RowState[]>([]);
  const [solo, setSolo] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Persist picked reciters whenever they change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(picked));
    } catch {
      /* ignore */
    }
  }, [picked]);

  // Resolve audio URLs whenever the picked set changes (or verseKey).
  useEffect(() => {
    const cancelled = { v: false };
    void (async () => {
      const next: RowState[] = picked.map((slug) => {
        const r = reciters.find((x) => x.slug === slug);
        return {
          slug,
          name: r?.name ?? slug,
          audioUrl: null,
          playing: false,
          loading: true,
        };
      });
      setRows(next);
      const resolved = await Promise.all(
        picked.map(async (slug) => {
          try {
            const res = await fetch(
              `${apiBase}/v1/audio/by_verse/${encodeURIComponent(verseKey)}/${slug}`,
            );
            if (!res.ok) return null;
            const body = (await res.json()) as { audioUrl: string };
            return body.audioUrl;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled.v) return;
      setRows((prev) =>
        prev.map((r, i) => ({ ...r, audioUrl: resolved[i] ?? null, loading: false })),
      );
    })();
    return () => {
      cancelled.v = true;
    };
  }, [picked, verseKey, apiBase, reciters]);

  function togglePick(slug: string): void {
    setPicked((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= MAX_ROWS) return cur;
      return [...cur, slug];
    });
  }

  function playAll(): void {
    audioRefs.current.forEach((a, slug) => {
      a.currentTime = 0;
      a.muted = solo !== null && solo !== slug;
      void a.play();
    });
  }
  function pauseAll(): void {
    audioRefs.current.forEach((a) => {
      a.pause();
    });
  }

  function setSoloFor(slug: string | null): void {
    setSolo(slug);
    audioRefs.current.forEach((a, s) => {
      a.muted = slug !== null && slug !== s;
    });
  }

  return (
    <div className="space-y-6">
      {/* Reciter picker — paper-card chip-row */}
      <section aria-labelledby="compare-pick" className="paper-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="compare-pick" className="smallcaps text-leaf text-[11px] tracking-widest">
            Pick up to {MAX_ROWS.toString()} reciters · {picked.length.toString()} selected
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={playAll}
              disabled={picked.length === 0}
              className="bg-leaf text-paper smallcaps touch-manipulation rounded-full px-4 py-1.5 text-[11px] tracking-widest hover:opacity-95 disabled:opacity-40"
            >
              Play all
            </button>
            <button
              type="button"
              onClick={pauseAll}
              className="border-hairline text-ink-muted smallcaps hover:text-ink touch-manipulation rounded-full border px-4 py-1.5 text-[11px] tracking-widest"
            >
              Pause all
            </button>
          </div>
        </div>
        <ul className="m-0 flex max-h-[180px] list-none flex-wrap gap-1.5 overflow-y-auto p-0">
          {reciters.map((r) => {
            const active = picked.includes(r.slug);
            return (
              <li key={r.slug}>
                <button
                  type="button"
                  onClick={() => {
                    togglePick(r.slug);
                  }}
                  disabled={!active && picked.length >= MAX_ROWS}
                  className={`smallcaps touch-manipulation rounded-full border px-3 py-1 text-xs tracking-wider transition-colors ${
                    active
                      ? 'bg-leaf text-paper border-leaf'
                      : 'border-hairline text-ink hover:border-leaf/40'
                  } disabled:opacity-30`}
                >
                  {r.name.replace(/^.* /, '').replace(/^al-/, '')}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Verse text reference */}
      {verseText ? (
        <p
          dir="rtl"
          lang="ar"
          className="paper-card-raised text-ink-strong p-5 text-center leading-[1.95] sm:p-8"
          style={{
            fontFamily: '"UthmanicHafs", "Amiri Quran", serif',
            fontSize: 'clamp(1.4rem, 1rem + 1.5vw, 2.2rem)',
            unicodeBidi: 'plaintext',
            fontWeight: 600,
          }}
        >
          {verseText}
        </p>
      ) : null}

      {/* Per-reciter rows */}
      {rows.length === 0 ? (
        <p className="text-ink-muted py-8 text-center text-sm italic">
          Pick at least one reciter above.
        </p>
      ) : (
        <ol className="m-0 list-none space-y-3 p-0">
          {rows.map((row) => (
            <li key={row.slug}>
              <article
                className={`paper-card p-4 transition-opacity sm:p-5 ${
                  solo !== null && solo !== row.slug ? 'opacity-50' : ''
                }`}
              >
                <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-display text-ink-strong text-base">{row.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSoloFor(solo === row.slug ? null : row.slug);
                    }}
                    className={`smallcaps touch-manipulation rounded-full border px-3 py-1 text-[11px] tracking-widest transition-colors ${
                      solo === row.slug
                        ? 'bg-leaf text-paper border-leaf'
                        : 'border-hairline text-ink-muted hover:text-ink'
                    }`}
                  >
                    {solo === row.slug ? 'Soloing' : 'Solo'}
                  </button>
                </header>
                {row.audioUrl ? (
                  <audio
                    ref={(el) => {
                      if (el) audioRefs.current.set(row.slug, el);
                      else audioRefs.current.delete(row.slug);
                    }}
                    src={row.audioUrl}
                    controls
                    preload="metadata"
                    className="w-full"
                  />
                ) : row.loading ? (
                  <p className="text-ink-muted text-xs italic">Loading…</p>
                ) : (
                  <p className="text-mistake-error text-xs italic">Audio unavailable.</p>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}

      <p className="text-ink-muted text-center text-[11px] italic">
        Tip: tap “Solo” on a row to mute the others without stopping playback.
      </p>
    </div>
  );
}
