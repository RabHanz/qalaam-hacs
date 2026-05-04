'use client';

/**
 * ContinuousReaderPlayer — Tarteel-style continuous recitation with
 * word-by-word highlighting in /read.
 *
 * Pipeline per verse:
 *   1. Fetch the verse's audio URL  (/v1/audio/by_verse/:vk/:reciter)
 *   2. Fetch word-timing segments    (/v1/recitations/:reciter/segments/:vk)
 *   3. Set <audio src=…>; on canplay, start playback
 *   4. On timeupdate: find the segment whose [startMs, endMs] contains
 *      currentTime, set the highlightedVerseKey + highlightedWordIndex
 *      via callback so the parent can paint the matching word.
 *   5. On ended: advance to next verseKey, repeat.
 *
 * Sticky bar at bottom of /read shows reciter + transport controls;
 * the parent renders the actual word highlights by reading
 * { highlightedVerseKey, highlightedWordIndex } from the callback.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

interface VerseRef {
  readonly verseKey: string;
}

interface Segment {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

interface Props {
  readonly verses: readonly VerseRef[];
  readonly reciterSlug: string;
  readonly reciterName?: string | undefined;
  readonly onHighlight: (h: { verseKey: string; wordIndex: number } | null) => void;
  /** Surah number of the verses[] above. Used to chain into the next
   *  surah when continuous playback reaches the end of this one. */
  readonly currentSurah: number;
}

const STORE_LAST_PLAYED = 'qalaam-last-played-verse';

/**
 * Read the last-played verse for a given surah from localStorage.
 * Returns the verseKey or null. Used to resume continuous playback
 * from where the user last tapped a per-ayah Listen button.
 */
function readLastPlayed(surah: number): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORE_LAST_PLAYED);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[surah.toString()] ?? null;
  } catch {
    return null;
  }
}

interface AudioBundle {
  url: string;
  segments: readonly Segment[];
}

const bundleCache = new Map<string, AudioBundle>();

async function fetchBundle(
  apiBase: string,
  verseKey: string,
  reciterSlug: string,
): Promise<AudioBundle> {
  const ckey = `${reciterSlug}|${verseKey}`;
  const cached = bundleCache.get(ckey);
  if (cached) return cached;
  const [audioRes, segRes] = await Promise.all([
    fetch(`${apiBase}/v1/audio/by_verse/${encodeURIComponent(verseKey)}/${reciterSlug}`),
    fetch(`${apiBase}/v1/recitations/${reciterSlug}/segments/${encodeURIComponent(verseKey)}`),
  ]);
  const audioBody = audioRes.ok
    ? ((await audioRes.json()) as { audioUrl: string })
    : { audioUrl: '' };
  const segBody = segRes.ok
    ? ((await segRes.json()) as { data: readonly Segment[] })
    : { data: [] };
  const bundle: AudioBundle = { url: audioBody.audioUrl, segments: segBody.data };
  bundleCache.set(ckey, bundle);
  return bundle;
}

export function ContinuousReaderPlayer({
  verses: initialVerses,
  reciterSlug,
  reciterName,
  onHighlight,
  currentSurah,
}: Props): ReactNode {
  // The player keeps its own running list of verses so it can chain
  // surahs without unmounting. Starts with the parent-supplied surah's
  // verses and appends the next surah's verses when we reach the end.
  const [verses, setVerses] = useState<readonly VerseRef[]>(initialVerses);
  const [activeSurah, setActiveSurah] = useState<number>(currentSurah);
  // Reset list when the surrounding surah changes (user navigated /read/N).
  useEffect(() => {
    setVerses(initialVerses);
    setActiveSurah(currentSurah);
  }, [initialVerses, currentSurah]);

  // Auto-resume continuous playback on mount if the previous surah's
  // chain set the qalaam-continue-on-load flag (cross-surah hand-off).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let shouldResume = false;
    try {
      shouldResume = window.localStorage.getItem('qalaam-continue-on-load') === '1';
      if (shouldResume) window.localStorage.removeItem('qalaam-continue-on-load');
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get('continue') === '1') {
      shouldResume = true;
      url.searchParams.delete('continue');
      window.history.replaceState(null, '', url.toString());
    }
    if (shouldResume) {
      window.dispatchEvent(new CustomEvent('qalaam:audio-claim', { detail: { source: 'continuous' } }));
      setActive(true);
      setVerseIdx(0);
    }
  }, []);
  const [active, setActive] = useState(false);
  const [verseIdx, setVerseIdx] = useState(0);
  // Repeat mode: 'none' = surah-by-surah continuous (default),
  // 'verse' = loop the current verse, 'surah' = loop the current surah.
  const [repeatMode, setRepeatMode] = useState<'none' | 'verse' | 'surah'>('none');
  // Dual-buffer audio elements for gapless playback. The "current"
  // buffer plays the active verse; the "next" buffer pre-loads the
  // upcoming verse so it's already buffered when we swap.
  const [bundleA, setBundleA] = useState<AudioBundle | null>(null);
  const [bundleB, setBundleB] = useState<AudioBundle | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<'A' | 'B'>('A');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);

  // Persist last-played verse as the continuous player advances, so
  // the next "tap continuous" resumes here. Same key/format as
  // AyahCard's per-ayah Listen so they share state.
  useEffect(() => {
    if (!active) return;
    const vk = verses[verseIdx]?.verseKey;
    if (!vk) return;
    try {
      const raw = window.localStorage.getItem(STORE_LAST_PLAYED);
      const map = (raw ? (JSON.parse(raw) as Record<string, string>) : {}) ?? {};
      map[activeSurah.toString()] = vk;
      window.localStorage.setItem(STORE_LAST_PLAYED, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }, [active, verseIdx, verses, activeSurah]);
  const apiBase = resolveApiBase();
  const lastWordIdxRef = useRef<number>(-1);
  const lastVerseKeyRef = useRef<string>('');

  function activeAudio(): HTMLAudioElement | null {
    return activeBuffer === 'A' ? audioARef.current : audioBRef.current;
  }
  function activeBundle(): AudioBundle | null {
    return activeBuffer === 'A' ? bundleA : bundleB;
  }

  // Load bundle for the active buffer (current verse) AND the next
  // verse into the OTHER buffer simultaneously. With both buffers
  // ready, advancing between verses is just a swap of which audio
  // element is the active one — no src change, no canplay wait,
  // gapless playback.
  useEffect(() => {
    if (!active) return;
    const cur = verses[verseIdx];
    const next = verses[verseIdx + 1];
    if (!cur) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [curB, nextB] = await Promise.all([
        fetchBundle(apiBase, cur.verseKey, reciterSlug),
        next ? fetchBundle(apiBase, next.verseKey, reciterSlug) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      // If the current verse has NO audio URL (some reciters lack
      // coverage on certain ayahs — abdul-basit-mujawwad has audio
      // only for some verses, etc), skip forward instead of stalling.
      if (!curB.url) {
        if (verseIdx + 1 < verses.length) {
          setVerseIdx((i) => i + 1);
        } else {
          setActive(false);
          setPlaying(false);
        }
        return;
      }
      // Place current bundle in the activeBuffer slot, next in the other.
      if (activeBuffer === 'A') {
        setBundleA(curB);
        setBundleB(nextB);
      } else {
        setBundleB(curB);
        setBundleA(nextB);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, verseIdx, verses, reciterSlug, apiBase, activeBuffer]);

  function toggle(): void {
    if (active) {
      setActive(false);
      setPlaying(false);
      onHighlight(null);
      audioARef.current?.pause();
      audioBRef.current?.pause();
      return;
    }
    // Resume from the last-played verse if the user has listened to a
    // specific ayah on this surah; otherwise start from the top.
    const lastVk = readLastPlayed(activeSurah);
    let startIdx = 0;
    if (lastVk) {
      const found = verses.findIndex((v) => v.verseKey === lastVk);
      if (found >= 0) startIdx = found;
    }
    window.dispatchEvent(new CustomEvent('qalaam:audio-claim', { detail: { source: 'continuous' } }));
    setActive(true);
    setVerseIdx(startIdx);
  }

  // Listen for audio-claim events from other players (per-ayah Listen
  // chips, MiniPlayer on /listen) — when they take the audio focus,
  // we pause and clear our highlight.
  useEffect(() => {
    function onClaim(e: Event): void {
      const detail = (e as CustomEvent<{ source: string }>).detail;
      if (detail.source === 'continuous') return; // it's our own claim
      if (active) {
        setActive(false);
        setPlaying(false);
        onHighlight(null);
        audioARef.current?.pause();
        audioBRef.current?.pause();
      }
    }
    window.addEventListener('qalaam:audio-claim', onClaim);
    return () => window.removeEventListener('qalaam:audio-claim', onClaim);
  }, [active, onHighlight]);

  // High-frequency rAF tracker — browser timeupdate fires at ~250ms
  // resolution which lags behind the audio. We poll currentTime every
  // animation frame (~16ms) while playing for tighter sync.
  useEffect(() => {
    if (!active || !playing) return;
    let raf = 0;
    function tick(): void {
      onTimeUpdate();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, playing, activeBuffer, bundleA, bundleB, verseIdx]);

  // After a buffer swap (verse advance), the new active audio element
  // already has its src set from the pre-fetch — but autoPlay only
  // fires once at mount. Explicitly call .play() on whichever audio
  // is now active so playback resumes seamlessly.
  useEffect(() => {
    if (!active) return;
    const a = activeAudio();
    if (!a) return;
    // Reset to the start of the new verse and play.
    if (a.readyState >= 2) {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    } else {
      // Audio not yet buffered — let onCanPlay fire it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBuffer, verseIdx, active]);

  function pickActiveSegment(tMs: number, segments: readonly Segment[]): Segment | null {
    const LOOKAHEAD_MS = 80;
    const t = tMs + LOOKAHEAD_MS;
    for (let i = 0; i < segments.length; i += 1) {
      const s = segments[i];
      if (!s) continue;
      if (t >= s.startMs && t <= s.endMs) return s;
    }
    let last: Segment | null = null;
    for (const s of segments) {
      if (s.endMs < t) last = s;
    }
    return last;
  }

  function onTimeUpdate(): void {
    const a = activeAudio();
    const bundle = activeBundle();
    if (!a || !bundle || !verses[verseIdx]) return;
    const tMs = a.currentTime * 1000;
    const verseKey = verses[verseIdx].verseKey;
    const segments = bundle.segments;

    // Once we're past the last segment's end_ms, advance the highlight
    // to lastSegment.wordIndex + 1 so the verse-end digit / closing
    // word lights up DURING playback (not after onEnded fires, which
    // is too late — buffer swap clears it before the eye lands).
    const lastSeg = segments.length > 0 ? segments[segments.length - 1] : null;
    if (lastSeg && tMs >= lastSeg.endMs) {
      const finalIdx = lastSeg.wordIndex; // already +1 because we want one PAST the last segmented word
      if (
        finalIdx !== lastWordIdxRef.current ||
        verseKey !== lastVerseKeyRef.current
      ) {
        lastWordIdxRef.current = finalIdx;
        lastVerseKeyRef.current = verseKey;
        onHighlight({ verseKey, wordIndex: finalIdx });
      }
      return;
    }

    const seg = pickActiveSegment(tMs, segments);
    if (!seg) return;
    if (
      seg.wordIndex === lastWordIdxRef.current &&
      verseKey === lastVerseKeyRef.current
    ) {
      return;
    }
    lastWordIdxRef.current = seg.wordIndex;
    lastVerseKeyRef.current = verseKey;
    onHighlight({ verseKey, wordIndex: seg.wordIndex - 1 });
  }

  function onEnded(): void {
    const bundle = activeBundle();
    const verseKey = verses[verseIdx]?.verseKey ?? '';
    if (bundle && verseKey) {
      let lastWordIdx = -1;
      if (bundle.segments.length > 0) {
        const last = bundle.segments[bundle.segments.length - 1];
        if (last) lastWordIdx = last.wordIndex - 1;
      }
      if (lastWordIdx >= 0) {
        onHighlight({ verseKey, wordIndex: lastWordIdx + 1 });
        lastWordIdxRef.current = lastWordIdx + 2;
        lastVerseKeyRef.current = verseKey;
      }
    }

    // Repeat-mode handling.
    if (repeatMode === 'verse') {
      // Replay the same verse: rewind + play the active audio element.
      const a = activeAudio();
      if (a) {
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(() => setPlaying(true)).catch(() => setPlaying(false));
        }
      }
      return;
    }
    if (repeatMode === 'surah' && verseIdx + 1 >= verses.length) {
      // End of surah → restart from verse 0 of the same surah.
      setActiveBuffer((b) => (b === 'A' ? 'B' : 'A'));
      setBundleA(null);
      setBundleB(null);
      setVerseIdx(0);
      return;
    }

    if (verseIdx + 1 < verses.length) {
      // Same-surah advance: swap buffers (next verse pre-loaded) +
      // bump verseIdx.
      setActiveBuffer((b) => (b === 'A' ? 'B' : 'A'));
      setVerseIdx((i) => i + 1);
    } else if (activeSurah < 114) {
      // End of surah → navigate to the next surah's /read page so the
      // visible reader page actually changes. Persist a continue=1
      // query param + last-played verse 1:1 so the new page resumes
      // continuous playback from the top automatically.
      try {
        const next = activeSurah + 1;
        const lp = (() => {
          try {
            const raw = window.localStorage.getItem(STORE_LAST_PLAYED);
            return raw ? (JSON.parse(raw) as Record<string, string>) : {};
          } catch {
            return {};
          }
        })();
        lp[next.toString()] = `${next.toString()}:1`;
        window.localStorage.setItem(STORE_LAST_PLAYED, JSON.stringify(lp));
        window.localStorage.setItem('qalaam-continue-on-load', '1');
      } catch {
        /* ignore */
      }
      // Hard navigate — the new page will mount the player fresh and
      // auto-resume because of the continue flag above.
      window.location.href = `/read/${(activeSurah + 1).toString()}?continue=1`;
    } else {
      setActive(false);
      setPlaying(false);
    }
  }

  function jumpVerse(direction: 1 | -1): void {
    setVerseIdx((i) => Math.max(0, Math.min(verses.length - 1, i + direction)));
  }

  const currentVerseKey = verses[verseIdx]?.verseKey ?? '';

  function attachAudioHandlers(buffer: 'A' | 'B'): {
    onCanPlay: () => void;
    onTimeUpdate: () => void;
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
  } {
    return {
      onCanPlay: (): void => {
        if (!active) return;
        if (buffer !== activeBuffer) return; // only the active buffer auto-plays
        const a = activeAudio();
        if (!a) return;
        const p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(() => setPlaying(true)).catch(() => setPlaying(false));
        } else {
          setPlaying(true);
        }
      },
      onTimeUpdate: (): void => {
        if (buffer !== activeBuffer) return;
        onTimeUpdate();
      },
      onPlay: (): void => {
        if (buffer === activeBuffer) setPlaying(true);
      },
      onPause: (): void => {
        if (buffer === activeBuffer) setPlaying(false);
      },
      onEnded: (): void => {
        if (buffer === activeBuffer) onEnded();
      },
    };
  }

  return (
    <>
      {/* Only render the <audio> element after we have a non-empty
          URL — passing src="" causes the browser to refetch the page
          and triggers a Next.js empty-string-src warning. */}
      {bundleA?.url ? (
        <audio
          ref={audioARef}
          src={bundleA.url}
          preload="auto"
          {...attachAudioHandlers('A')}
        />
      ) : null}
      {bundleB?.url ? (
        <audio
          ref={audioBRef}
          src={bundleB.url}
          preload="auto"
          {...attachAudioHandlers('B')}
        />
      ) : null}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-paper-100/95 backdrop-blur-md"
        role="region"
        aria-label="Continuous recitation"
      >
        <div className="mx-auto max-w-5xl px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={active}
            className={`shrink-0 inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full ${
              active ? 'bg-leaf text-paper' : 'bg-paper-200 text-ink'
            } hover:opacity-95`}
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
          {active ? (
            <button
              type="button"
              aria-label="Previous verse"
              onClick={() => jumpVerse(-1)}
              disabled={verseIdx === 0}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-ink hover:bg-paper-200/60 disabled:opacity-30"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 6h2v12H6zm3.5 6L20 6v12z" />
              </svg>
            </button>
          ) : null}
          {active ? (
            <button
              type="button"
              aria-label="Next verse"
              onClick={() => jumpVerse(1)}
              disabled={verseIdx >= verses.length - 1}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-ink hover:bg-paper-200/60 disabled:opacity-30"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16 6h2v12h-2zM4 6l10.5 6L4 18z" />
              </svg>
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm leading-tight truncate text-ink-strong">
              {active ? (
                <>
                  Continuous · {reciterName ?? reciterSlug}
                  <span className="mx-2 text-ink-muted">·</span>
                  <span className="font-mono tabular-nums text-ink-muted">{currentVerseKey}</span>
                </>
              ) : (
                <span className="text-ink-muted">
                  Tap play for continuous recitation with word highlighting
                </span>
              )}
            </p>
            {loading ? (
              <p className="text-[11px] smallcaps text-ink-muted tracking-widest mt-0.5 italic">
                loading…
              </p>
            ) : null}
          </div>

          {/* Repeat-mode cycler — none → verse → surah → none.
              Default 'none' = continuous surah-by-surah chain. */}
          <button
            type="button"
            onClick={() =>
              setRepeatMode((m) => (m === 'none' ? 'verse' : m === 'verse' ? 'surah' : 'none'))
            }
            aria-label={`Repeat mode: ${repeatMode}`}
            title={
              repeatMode === 'none'
                ? 'No repeat (continues to next surah)'
                : repeatMode === 'verse'
                  ? 'Repeat current verse'
                  : 'Repeat current surah'
            }
            className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-[10px] smallcaps tracking-widest border ${
              repeatMode === 'none'
                ? 'border-hairline text-ink-muted hover:text-ink'
                : 'border-leaf bg-leaf/10 text-leaf'
            }`}
          >
            {repeatMode === 'none' ? '↻' : repeatMode === 'verse' ? '①' : '🜸'}
          </button>
        </div>
      </div>
    </>
  );
}
