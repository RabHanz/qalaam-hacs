'use client';

/**
 * CompareClient — multi-reciter A/B/C/D comparison player.
 *
 * UX: each row is one reciter rendering the verse. Reciters play
 * SEQUENTIALLY, not in unison — playing four mp3s at the same time is
 * an unintelligible smear. The order is the order you picked them in
 * (default Sudais → Husary → Mishary → Maher) and after row N's audio
 * ends, row N+1 auto-starts. The active row gets a leaf-gold ring.
 *
 *   - "Play sequence" master button → starts from the first picked row
 *     (or resumes the active one if it was paused).
 *   - "Pause" → halts whichever row is active.
 *   - "Solo" on a row → pauses every other row IMMEDIATELY (so when the
 *     queue ticks past, it skips the muted ones), and that row plays in
 *     focus. Tap "Soloing" again to release back into round-robin.
 *
 * Each row keeps its own native <audio controls> — users can scrub
 * individual reciters mid-comparison without breaking the queue.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';
import { useCast } from '../lib/use-cast.js';

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
  loading: boolean;
}

const STORE_KEY = 'qalaam-compare-reciters';
const MAX_ROWS = 4;

export function CompareClient({ verseKey, verseText, reciters }: Props): ReactNode {
  const apiBase = resolveApiBase();
  // Cast routing — when a session is live, the active row's audio
  // gets pushed to the receiver via cast.loadMedia. Local audio plays
  // muted to keep onTimeUpdate ticking for any per-row UI affordances.
  const cast = useCast();
  const isCasting = cast.isConnected;
  // Hydration-safe: deterministic initial state (no localStorage during
  // SSR), then sync from localStorage in a useEffect after mount. The
  // SSR HTML and the first client render both produce the same string.
  const [picked, setPicked] = useState<readonly string[]>(() => {
    const defaults = ['sudais', 'husary', 'mishary-alafasy', 'maher-muaiqly'].filter((s) =>
      reciters.some((r) => r.slug === s),
    );
    return defaults.slice(0, 3);
  });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr) && arr.length > 0) {
          // Filter to the reciters list to avoid stale entries
          const valid = arr.filter((s) => reciters.some((r) => r.slug === s)).slice(0, MAX_ROWS);
          if (valid.length > 0) setPicked(valid);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [rows, setRows] = useState<readonly RowState[]>([]);
  // Index into the `picked` array of whichever row is currently
  // playing (or paused mid-track). null = nobody's playing.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  // Solo mode forces the queue to a single row. The other rows are
  // paused immediately and skipped when the queue auto-advances.
  const [solo, setSolo] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Stable, identity-preserving ref callbacks per slug. Without
  // memoization React passes a fresh callback on every render, which
  // forces it to detach + reattach the ref — and in some browser
  // builds (notably Chrome's autoplay-policy hardened path) that
  // detach interrupts playback, manifesting as "audio cuts and
  // resets after ~1 second." Cache one closure per slug for the
  // component's lifetime.
  const refCallbacks = useRef<Map<string, (el: HTMLAudioElement | null) => void>>(new Map());
  function refFor(slug: string): (el: HTMLAudioElement | null) => void {
    let cb = refCallbacks.current.get(slug);
    if (!cb) {
      cb = (el: HTMLAudioElement | null): void => {
        if (el) audioRefs.current.set(slug, el);
        else audioRefs.current.delete(slug);
      };
      refCallbacks.current.set(slug, cb);
    }
    return cb;
  }

  // Persist picked reciters whenever they change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(picked));
    } catch {
      /* ignore */
    }
  }, [picked]);

  // Resolve audio URLs additively — once a slug's URL is known we never
  // blank it back to null on re-render. Earlier code reset rows to
  // {audioUrl:null, loading:true} on every dep change which forced the
  // <audio> element's src to flip to "" mid-playback, cutting audio
  // ~1s in. The merge below preserves resolved URLs when picked / solo
  // changes.
  useEffect(() => {
    const cancelled = { v: false };
    setRows((prev) => {
      const knownUrls = new Map(prev.map((r) => [r.slug, r.audioUrl] as const));
      return picked.map((slug) => {
        const r = reciters.find((x) => x.slug === slug);
        const cached = knownUrls.get(slug) ?? null;
        return {
          slug,
          name: r?.name ?? slug,
          audioUrl: cached,
          loading: cached === null,
        };
      });
    });
    void (async () => {
      const toResolve = picked.filter(
        (slug) => !rows.some((r) => r.slug === slug && r.audioUrl !== null),
      );
      const resolved = await Promise.all(
        toResolve.map(async (slug) => {
          try {
            const res = await fetch(
              `${apiBase}/v1/audio/by_verse/${encodeURIComponent(verseKey)}/${slug}`,
            );
            if (!res.ok) return [slug, null] as const;
            const body = (await res.json()) as { audioUrl: string };
            return [slug, body.audioUrl] as const;
          } catch {
            return [slug, null] as const;
          }
        }),
      );
      if (cancelled.v) return;
      const map = new Map(resolved);
      setRows((prev) =>
        prev.map((r) =>
          map.has(r.slug)
            ? { ...r, audioUrl: map.get(r.slug) ?? r.audioUrl, loading: false }
            : { ...r, loading: false },
        ),
      );
    })();
    return () => {
      cancelled.v = true;
    };
    // Deliberately omit `rows` from deps — including it would create
    // a feedback loop (effect updates rows → effect re-fires).
  }, [picked, verseKey, apiBase, reciters]);

  // Single source of truth for "which row is playing": whenever
  // activeIdx OR solo changes, pause every audio element that isn't
  // the active one. The onPlay handler updates activeIdx; this effect
  // does the muting. Detangles manual ▶ from programmatic playIndex —
  // before, both were calling .pause() on others, racing each other.
  useEffect(() => {
    const activeSlug = activeIdx !== null ? rows[activeIdx]?.slug : null;
    audioRefs.current.forEach((a, slug) => {
      if (slug !== activeSlug && !a.paused) a.pause();
    });
  }, [activeIdx, solo, rows]);

  function togglePick(slug: string): void {
    setPicked((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= MAX_ROWS) return cur;
      return [...cur, slug];
    });
  }

  // Pause every audio element. Used by master Pause + by Solo to halt
  // the non-soloed rows immediately.
  const pauseAll = useCallback(() => {
    audioRefs.current.forEach((a) => {
      a.pause();
    });
  }, []);

  // Start playing whichever row is at index `idx`. The "pause every
  // other row" step is owned by the [activeIdx] effect above, so this
  // function only needs to resolve + play the target. Returns true if
  // playback was kicked off.
  const playIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= rows.length) return false;
      const row = rows[idx];
      if (!row?.audioUrl) return false;
      const a = audioRefs.current.get(row.slug);
      if (!a) return false;
      // Only rewind if this row isn't already mid-playback. Manual
      // resume should preserve the user's seek position.
      if (a.paused || a.ended) a.currentTime = 0;
      // Set activeIdx eagerly so the [activeIdx] effect pauses others
      // immediately; .play()'s promise can lag on iOS autoplay-policy.
      setActiveIdx(idx);
      // Cast routing — push this row's audio to the receiver if a
      // session is live. Local audio plays muted so the row's own
      // <audio controls> still scrubs accurately while the receiver
      // does the actual playback.
      if (isCasting && row.audioUrl) {
        a.volume = 0;
        void cast.loadMedia(row.audioUrl, {
          title: `${row.name} · ${verseKey}`,
          artist: row.name,
        });
      } else {
        a.volume = 1;
      }
      void Promise.resolve(a.play()).catch(() => {
        /* iOS autoplay block — user can tap the row's native ▶ */
      });
      return true;
    },
    [rows, isCasting, cast, verseKey],
  );

  // Find the next playable row index after `idx`, honoring solo and
  // skipping rows whose audio failed to resolve.
  const nextPlayable = useCallback(
    (after: number): number => {
      for (let i = after + 1; i < rows.length; i += 1) {
        const r = rows[i];
        if (!r?.audioUrl) continue;
        if (solo !== null && r.slug !== solo) continue;
        return i;
      }
      return -1;
    },
    [rows, solo],
  );

  // When the active row's audio ends, advance to the next playable row.
  // We attach this once per row in the JSX with onEnded — the body
  // here is what fires.
  const handleEnded = useCallback(
    (slug: string) => {
      const idx = picked.indexOf(slug);
      if (idx < 0) return;
      const nxt = nextPlayable(idx);
      if (nxt >= 0) {
        playIndex(nxt);
      } else {
        setActiveIdx(null);
      }
    },
    [picked, nextPlayable, playIndex],
  );

  function playSequence(): void {
    // If something's already active and paused, resume it. Otherwise
    // start the first playable row.
    if (activeIdx !== null) {
      const row = rows[activeIdx];
      const a = row ? audioRefs.current.get(row.slug) : undefined;
      if (a && a.paused && (solo === null || row?.slug === solo)) {
        void Promise.resolve(a.play()).catch(() => {
          /* autoplay block */
        });
        return;
      }
    }
    const first = nextPlayable(-1);
    if (first >= 0) playIndex(first);
  }

  function setSoloFor(slug: string | null): void {
    setSolo(slug);
    if (slug !== null) {
      // Pause the other rows immediately so the user only hears the
      // soloed reciter from this point forward.
      audioRefs.current.forEach((a, s) => {
        if (s !== slug) a.pause();
      });
      // If the soloed row isn't currently active, switch to it.
      const idx = picked.indexOf(slug);
      if (idx >= 0 && activeIdx !== idx) {
        playIndex(idx);
      }
    }
  }

  const masterLabel = useMemo(() => {
    if (activeIdx === null) return 'Play sequence';
    const row = rows[activeIdx];
    const a = row ? audioRefs.current.get(row.slug) : undefined;
    return a && !a.paused ? 'Pause' : 'Resume';
  }, [activeIdx, rows]);

  return (
    <div className="space-y-6">
      {/* Reciter picker */}
      <section aria-labelledby="compare-pick" className="paper-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="compare-pick" className="smallcaps text-leaf text-[11px] tracking-widest">
            Pick up to {MAX_ROWS.toString()} reciters · {picked.length.toString()} selected
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (masterLabel === 'Pause') pauseAll();
                else playSequence();
              }}
              disabled={picked.length === 0}
              className="bg-leaf text-paper smallcaps touch-manipulation rounded-full px-4 py-1.5 text-[11px] tracking-widest hover:opacity-95 disabled:opacity-40"
            >
              {masterLabel}
            </button>
            <button
              type="button"
              onClick={pauseAll}
              className="border-hairline text-ink-muted smallcaps hover:text-ink touch-manipulation rounded-full border px-4 py-1.5 text-[11px] tracking-widest"
            >
              Stop
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
            fontFamily: '"UthmanicHafs"',
            fontSize: 'clamp(1.4rem, 1rem + 1.5vw, 2.2rem)',
            unicodeBidi: 'plaintext',
            fontWeight: 600,
          }}
        >
          {verseText}
        </p>
      ) : null}

      {/* Per-reciter rows — sequential queue, active row glows leaf */}
      {rows.length === 0 ? (
        <p className="text-ink-muted py-8 text-center text-sm italic">
          Pick at least one reciter above.
        </p>
      ) : (
        <ol className="m-0 list-none space-y-3 p-0">
          {rows.map((row, i) => {
            const isActive = activeIdx === i;
            const isSoloed = solo === row.slug;
            const isDimmed = solo !== null && solo !== row.slug;
            return (
              <li key={row.slug}>
                <article
                  className={`paper-card p-4 transition-all sm:p-5 ${
                    isActive ? 'ring-leaf/60 shadow-[0_0_18px_rgba(176,131,54,0.18)] ring-1' : ''
                  } ${isDimmed ? 'opacity-50' : ''}`}
                >
                  <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="smallcaps text-leaf text-[10px] tabular-nums tracking-widest">
                        {(i + 1).toString().padStart(2, '0')}
                      </span>
                      <p className="font-display text-ink-strong text-base">{row.name}</p>
                      {isActive ? (
                        <span className="smallcaps text-leaf text-[9px] tracking-widest">
                          ▶ playing
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSoloFor(isSoloed ? null : row.slug);
                      }}
                      className={`smallcaps touch-manipulation rounded-full border px-3 py-1 text-[11px] tracking-widest transition-colors ${
                        isSoloed
                          ? 'bg-leaf text-paper border-leaf'
                          : 'border-hairline text-ink-muted hover:text-ink'
                      }`}
                    >
                      {isSoloed ? 'Soloing' : 'Solo'}
                    </button>
                  </header>
                  {row.audioUrl ? (
                    <audio
                      ref={refFor(row.slug)}
                      src={row.audioUrl}
                      controls
                      preload="metadata"
                      className="w-full"
                      onEnded={() => {
                        handleEnded(row.slug);
                      }}
                      onPlay={() => {
                        // Manual ▶ on this row → just record the active
                        // index. The [activeIdx] effect pauses every
                        // other row in one place, so manual + auto
                        // never race each other on .pause() / .play().
                        if (activeIdx !== i) setActiveIdx(i);
                      }}
                    />
                  ) : row.loading ? (
                    <p className="text-ink-muted text-xs italic">Loading…</p>
                  ) : (
                    <p className="text-mistake-error text-xs italic">Audio unavailable.</p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-ink-muted text-center text-[11px] italic">
        Reciters play in sequence. Tap “Solo” to focus one and pause the rest.
      </p>
    </div>
  );
}
