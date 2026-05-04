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
  verses,
  reciterSlug,
  reciterName,
  onHighlight,
}: Props): ReactNode {
  const [active, setActive] = useState(false);
  const [verseIdx, setVerseIdx] = useState(0);
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
    // Tell any other player on the page to stop — only one continuous
    // / per-ayah audio source plays at a time.
    window.dispatchEvent(new CustomEvent('qalaam:audio-claim', { detail: { source: 'continuous' } }));
    setActive(true);
    setVerseIdx(0);
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
    // Lookahead window: trigger highlight slightly BEFORE the segment
    // start to compensate for browser timeupdate jitter (~250ms native
    // resolution). 80ms ahead matches the eye's ability to anticipate
    // the next syllable in normal recitation.
    const LOOKAHEAD_MS = 80;
    const t = tMs + LOOKAHEAD_MS;
    for (let i = 0; i < segments.length; i += 1) {
      const s = segments[i];
      if (!s) continue;
      if (t >= s.startMs && t <= s.endMs) return s;
    }
    // Between segments — return the most recent one we passed so the
    // highlight stays on the previous word instead of vanishing.
    let last: Segment | null = null;
    for (const s of segments) {
      if (s.endMs < t) last = s;
    }
    return last;
  }

  function onTimeUpdate(): void {
    const a = activeAudio();
    const bundle = activeBundle();
    if (!a || !bundle) return;
    const tMs = a.currentTime * 1000;
    const seg = pickActiveSegment(tMs, bundle.segments);
    if (!seg) return;
    const verseKey = verses[verseIdx]?.verseKey ?? '';
    if (
      seg.wordIndex === lastWordIdxRef.current &&
      verseKey === lastVerseKeyRef.current
    ) {
      return; // no change → no callback churn
    }
    lastWordIdxRef.current = seg.wordIndex;
    lastVerseKeyRef.current = verseKey;
    onHighlight({ verseKey, wordIndex: seg.wordIndex - 1 });
  }

  function onEnded(): void {
    // Before advancing, paint the LAST WORD OF THE VERSE — segments
    // sometimes don't cover the verse-end digit (e.g. 2:1 has 2 words
    // but only word 1 is segmented), so the final tick of audio
    // doesn't hit a new segment. Find the highest wordIndex from QUL
    // word data; if a segment exists for that index use it, else
    // synthesize one from the highest segment's index + 1.
    const bundle = activeBundle();
    const verseKey = verses[verseIdx]?.verseKey ?? '';
    if (bundle && verseKey) {
      let lastWordIdx = -1;
      if (bundle.segments.length > 0) {
        const last = bundle.segments[bundle.segments.length - 1];
        if (last) lastWordIdx = last.wordIndex - 1;
      }
      // Try to advance one more so the verse-end digit / final word
      // gets the highlight before we move on.
      if (lastWordIdx >= 0) {
        onHighlight({ verseKey, wordIndex: lastWordIdx + 1 });
        lastWordIdxRef.current = lastWordIdx + 2;
        lastVerseKeyRef.current = verseKey;
      }
    }
    if (verseIdx + 1 < verses.length) {
      setActiveBuffer((b) => (b === 'A' ? 'B' : 'A'));
      setVerseIdx((i) => i + 1);
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
        </div>
      </div>
    </>
  );
}
