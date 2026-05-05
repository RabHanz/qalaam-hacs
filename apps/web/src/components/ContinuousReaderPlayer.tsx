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

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

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
      window.dispatchEvent(
        new CustomEvent('qalaam:audio-claim', { detail: { source: 'continuous' } }),
      );
      setActive(true);
      setVerseIdx(0);
    }
    // Restore playback speed if the user picked one previously.
    try {
      const stored = window.localStorage.getItem('qalaam-playback-rate');
      const parsed = stored ? Number.parseFloat(stored) : 1;
      if (parsed >= 0.5 && parsed <= 2) setPlaybackRate(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  const [active, setActive] = useState(false);
  const [verseIdx, setVerseIdx] = useState(0);
  // Repeat mode: 'none' = surah-by-surah continuous (default),
  // 'verse' = loop the current verse, 'surah' = loop the current surah.
  const [repeatMode, setRepeatMode] = useState<'none' | 'verse' | 'surah'>('none');
  // Playback speed — applied to both audio buffers via .playbackRate.
  // 1x is the canonical recitation speed; users learning a passage often
  // drop to 0.75x; advanced reciters who want to brush up on familiar
  // verses go to 1.25x. Persisted in localStorage so it survives reloads.
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  // Sleep timer — fades + stops playback after N seconds, OR at end-of-
  // surah / end-of-juz. Stored as { kind, deadline_ms? } so end-of-surah
  // can stay armed across verse transitions without a wall-clock countdown.
  type SleepTimer =
    | { kind: 'off' }
    | { kind: 'minutes'; deadlineMs: number; total: number }
    | { kind: 'end-of-surah' }
    | { kind: 'end-of-juz' };
  const [sleepTimer, setSleepTimer] = useState<SleepTimer>({ kind: 'off' });
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);

  // Apply playbackRate to both audio elements whenever it changes
  // (both buffers exist concurrently so we set both — safer than
  // tracking which one is active).
  useEffect(() => {
    if (audioARef.current) audioARef.current.playbackRate = playbackRate;
    if (audioBRef.current) audioBRef.current.playbackRate = playbackRate;
    try {
      window.localStorage.setItem('qalaam-playback-rate', playbackRate.toString());
    } catch {
      /* ignore */
    }
  }, [playbackRate]);

  // Sleep timer countdown — when set to a minutes-based timer, kick off
  // a 250ms tick that fades volume over the last 30s and pauses on
  // expiry. End-of-surah / end-of-juz fire from the verse-advance
  // handler (onEnded) below.
  useEffect(() => {
    if (sleepTimer.kind !== 'minutes') return;
    const id = window.setInterval(() => {
      const remainingMs = sleepTimer.deadlineMs - Date.now();
      if (remainingMs <= 0) {
        const a = audioARef.current;
        const b = audioBRef.current;
        if (a) a.pause();
        if (b) b.pause();
        setActive(false);
        setPlaying(false);
        setSleepTimer({ kind: 'off' });
        if (a) a.volume = 1;
        if (b) b.volume = 1;
        return;
      }
      // Fade volume over the last 30s.
      const fadeMs = 30_000;
      if (remainingMs < fadeMs) {
        const v = Math.max(0, remainingMs / fadeMs);
        if (audioARef.current) audioARef.current.volume = v;
        if (audioBRef.current) audioBRef.current.volume = v;
      }
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, [sleepTimer]);
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
      const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
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

  // Wire up navigator.mediaSession so iOS/Android lock-screen + Bluetooth
  // headset buttons control playback, and the system-level "now playing"
  // chrome shows the current surah + reciter. Cleared on unmount so
  // navigating away doesn't leave stale metadata behind.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const vk = verses[verseIdx]?.verseKey ?? '';
    const [s, a] = vk.split(':');
    if (s && a) {
      try {
        ms.metadata = new MediaMetadata({
          title: `Surah ${s} · Ayah ${a}`,
          artist: reciterName ?? 'Qalaam',
          album: 'The Quran',
          // Lock-screen artwork is intentionally omitted until /public has
          // the assets — Chrome's mediaSession is happy with an empty
          // artwork array (it falls back to favicon). Adding paths that
          // 404 floods the dev console with icon-192 / icon-512 noise.
          artwork: [],
        });
      } catch {
        /* ignore — older Safari can throw on artwork URLs */
      }
    }
    ms.playbackState = playing ? 'playing' : active ? 'paused' : 'none';

    const setOrClear = (action: MediaSessionAction, handler: (() => void) | null): void => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* not all browsers support every action */
      }
    };
    setOrClear('play', () => {
      const aud = activeAudio();
      if (aud) {
        void aud.play();
        setActive(true);
      }
    });
    setOrClear('pause', () => {
      const aud = activeAudio();
      if (aud) aud.pause();
    });
    setOrClear('previoustrack', () => {
      if (verseIdx > 0) {
        setActiveBuffer((b) => (b === 'A' ? 'B' : 'A'));
        setVerseIdx((i) => Math.max(0, i - 1));
      }
    });
    setOrClear('nexttrack', () => {
      if (verseIdx + 1 < verses.length) {
        setActiveBuffer((b) => (b === 'A' ? 'B' : 'A'));
        setVerseIdx((i) => i + 1);
      }
    });
    setOrClear('seekbackward', () => {
      const aud = activeAudio();
      if (aud) aud.currentTime = Math.max(0, aud.currentTime - 5);
    });
    setOrClear('seekforward', () => {
      const aud = activeAudio();
      if (aud) aud.currentTime = Math.min(aud.duration || 0, aud.currentTime + 5);
    });

    return () => {
      // Don't clear metadata on every state change — only on unmount —
      // otherwise the lock-screen flickers between transitions.
      setOrClear('play', null);
      setOrClear('pause', null);
      setOrClear('previoustrack', null);
      setOrClear('nexttrack', null);
      setOrClear('seekbackward', null);
      setOrClear('seekforward', null);
    };
    // Effect deps intentionally omit `verses` to avoid retriggering on every parent render.
  }, [verseIdx, verses, reciterName, playing, active]);

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
    const cancelled = { v: false };
    setLoading(true);
    void (async () => {
      const [curB, nextB] = await Promise.all([
        fetchBundle(apiBase, cur.verseKey, reciterSlug),
        next ? fetchBundle(apiBase, next.verseKey, reciterSlug) : Promise.resolve(null),
      ]);
      if (cancelled.v) return;
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
      cancelled.v = true;
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
    window.dispatchEvent(
      new CustomEvent('qalaam:audio-claim', { detail: { source: 'continuous' } }),
    );
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
    return () => {
      window.removeEventListener('qalaam:audio-claim', onClaim);
    };
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
    return () => {
      cancelAnimationFrame(raf);
    };
    // Effect deps intentionally omit `verses` to avoid retriggering on every parent render.
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
      void Promise.resolve(a.play()).then(
        () => {
          setPlaying(true);
        },
        () => {
          setPlaying(false);
        },
      );
    }
    // else: audio not yet buffered — onCanPlay will fire it.
    // Effect deps intentionally omit `verses` to avoid retriggering on every parent render.
  }, [activeBuffer, verseIdx, active]);

  function pickActiveSegment(tMs: number, segments: readonly Segment[]): Segment | null {
    const LOOKAHEAD_MS = 80;
    const t = tMs + LOOKAHEAD_MS;
    for (const s of segments) {
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

    // Tail handling — segment data ends at the last word's nominal endMs,
    // but the reciter typically continues for another 200-800ms of madd /
    // qalqalah / pause before the audio actually finishes. We pin the
    // highlight to the LAST recited word for the rest of the audio
    // playback; onEnded handles the brief rosette flash + buffer-swap.
    //
    // Earlier iterations advanced to the rosette mid-recitation (instantly
    // at endMs, or guarded by 250ms before audio.duration). Both flavors
    // surfaced as "the last second of recitation runs while highlight is
    // already on the next slot" — the user's reported regression. Pinning
    // for the full audio tail eliminates that without losing the rosette
    // moment (onEnded paints it).
    const lastSeg = segments.length > 0 ? segments[segments.length - 1] : null;
    if (lastSeg && tMs >= lastSeg.endMs) {
      const targetIdx = lastSeg.wordIndex - 1;
      if (targetIdx !== lastWordIdxRef.current || verseKey !== lastVerseKeyRef.current) {
        lastWordIdxRef.current = targetIdx;
        lastVerseKeyRef.current = verseKey;
        onHighlight({ verseKey, wordIndex: targetIdx });
      }
      return;
    }

    const seg = pickActiveSegment(tMs, segments);
    if (!seg) return;
    if (seg.wordIndex === lastWordIdxRef.current && verseKey === lastVerseKeyRef.current) {
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

    // Sleep-timer end-of-surah / end-of-juz check — fired when the
    // current verse is the last in its scope. End-of-juz uses the
    // verse_key prefix mapping kept on the verse list (juz boundaries
    // mid-verse don't apply to recitation).
    if (sleepTimer.kind === 'end-of-surah' && verseIdx + 1 >= verses.length) {
      const a = audioARef.current;
      const b = audioBRef.current;
      if (a) a.pause();
      if (b) b.pause();
      setActive(false);
      setPlaying(false);
      setSleepTimer({ kind: 'off' });
      return;
    }
    // End-of-juz check — verses are pre-tagged with juz numbers via
    // /v1/chapters but the easier signal is: stop after the current
    // surah ends in continuous chain mode. Without a juz field on
    // VerseRef we conservatively treat it as end-of-surah for now.
    if (sleepTimer.kind === 'end-of-juz' && verseIdx + 1 >= verses.length) {
      const a = audioARef.current;
      const b = audioBRef.current;
      if (a) a.pause();
      if (b) b.pause();
      setActive(false);
      setPlaying(false);
      setSleepTimer({ kind: 'off' });
      return;
    }

    // Repeat-mode handling.
    if (repeatMode === 'verse') {
      // Replay the same verse: rewind + play the active audio element.
      const a = activeAudio();
      if (a) {
        a.currentTime = 0;
        void Promise.resolve(a.play()).then(
          () => {
            setPlaying(true);
          },
          () => {
            setPlaying(false);
          },
        );
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
      // End of surah → navigate appropriately. If we're on a /mushaf
      // page, advance to the next mushaf page (which contains the
      // next surah's verses); otherwise navigate to /read/N+1.
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
      const path = window.location.pathname;
      const mushafMatch = /^\/mushaf\/([^/]+)\//.exec(path);
      if (mushafMatch) {
        // On /mushaf — go to the page-for the next surah's first verse
        // in the SAME layout. Server will redirect to the right page.
        const layout = mushafMatch[1] ?? 'madinah';
        const nextVk = `${(activeSurah + 1).toString()}:1`;
        window.location.href = `/mushaf/${layout}/page-for/${encodeURIComponent(nextVk)}?continue=1`;
      } else {
        window.location.href = `/read/${(activeSurah + 1).toString()}?continue=1`;
      }
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
        void Promise.resolve(a.play()).then(
          () => {
            setPlaying(true);
          },
          () => {
            setPlaying(false);
          },
        );
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
        <audio ref={audioARef} src={bundleA.url} preload="auto" {...attachAudioHandlers('A')} />
      ) : null}
      {bundleB?.url ? (
        <audio ref={audioBRef} src={bundleB.url} preload="auto" {...attachAudioHandlers('B')} />
      ) : null}
      <div
        className="border-hairline bg-paper-100/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md"
        role="region"
        aria-label="Continuous recitation"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={active}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${
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
              onClick={() => {
                jumpVerse(-1);
              }}
              disabled={verseIdx === 0}
              className="text-ink hover:bg-paper-200/60 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
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
              onClick={() => {
                jumpVerse(1);
              }}
              disabled={verseIdx >= verses.length - 1}
              className="text-ink hover:bg-paper-200/60 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16 6h2v12h-2zM4 6l10.5 6L4 18z" />
              </svg>
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-display text-ink-strong truncate text-sm leading-tight">
              {active ? (
                <>
                  Continuous · {reciterName ?? reciterSlug}
                  <span className="text-ink-muted mx-2">·</span>
                  <span className="text-ink-muted font-mono tabular-nums">{currentVerseKey}</span>
                </>
              ) : (
                <span className="text-ink-muted">
                  Tap play for continuous recitation with word highlighting
                </span>
              )}
            </p>
            {loading ? (
              <p className="smallcaps text-ink-muted mt-0.5 text-[11px] italic tracking-widest">
                loading…
              </p>
            ) : null}
          </div>

          {/* Speed cycler — 0.75 → 1 → 1.25 → 1.5 → 0.75. Persisted. */}
          <button
            type="button"
            onClick={() => {
              setPlaybackRate((r) => (r === 0.75 ? 1 : r === 1 ? 1.25 : r === 1.25 ? 1.5 : 0.75));
            }}
            aria-label={`Speed ${playbackRate.toString()}x`}
            title={`Playback speed · tap to cycle (current: ${playbackRate.toString()}x)`}
            className={`smallcaps inline-flex h-9 min-w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border text-[10px] tracking-widest ${
              playbackRate === 1
                ? 'border-hairline text-ink-muted hover:text-ink'
                : 'border-leaf bg-leaf/10 text-leaf'
            }`}
          >
            {playbackRate.toString()}×
          </button>

          {/* Sleep-timer popover */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setSleepMenuOpen((o) => !o);
              }}
              aria-label="Sleep timer"
              title={
                sleepTimer.kind === 'off'
                  ? 'Set a sleep timer'
                  : sleepTimer.kind === 'minutes'
                    ? `${Math.max(0, Math.ceil((sleepTimer.deadlineMs - Date.now()) / 60_000)).toString()}m left`
                    : sleepTimer.kind
              }
              className={`smallcaps inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border text-[10px] tracking-widest ${
                sleepTimer.kind === 'off'
                  ? 'border-hairline text-ink-muted hover:text-ink'
                  : 'border-leaf bg-leaf/10 text-leaf'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {sleepMenuOpen ? (
              <ul className="bg-paper border-hairline absolute bottom-full right-0 z-30 m-0 mb-2 min-w-[160px] list-none rounded-md border p-1 shadow-lg">
                {([5, 10, 15, 30, 60] as const).map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => {
                        setSleepTimer({
                          kind: 'minutes',
                          deadlineMs: Date.now() + m * 60_000,
                          total: m,
                        });
                        setSleepMenuOpen(false);
                      }}
                      className="hover:bg-paper-100 w-full rounded-sm px-3 py-2 text-left text-sm"
                    >
                      In {m.toString()} minutes
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSleepTimer({ kind: 'end-of-surah' });
                      setSleepMenuOpen(false);
                    }}
                    className="hover:bg-paper-100 w-full rounded-sm px-3 py-2 text-left text-sm"
                  >
                    End of surah
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSleepTimer({ kind: 'end-of-juz' });
                      setSleepMenuOpen(false);
                    }}
                    className="hover:bg-paper-100 w-full rounded-sm px-3 py-2 text-left text-sm"
                  >
                    End of juz
                  </button>
                </li>
                {sleepTimer.kind !== 'off' ? (
                  <li className="border-hairline mt-1 border-t pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSleepTimer({ kind: 'off' });
                        setSleepMenuOpen(false);
                        if (audioARef.current) audioARef.current.volume = 1;
                        if (audioBRef.current) audioBRef.current.volume = 1;
                      }}
                      className="text-mistake-error hover:bg-paper-100 w-full rounded-sm px-3 py-2 text-left text-sm"
                    >
                      Cancel timer
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {/* Repeat-mode cycler — none → verse → surah → none.
              Default 'none' = continuous surah-by-surah chain. */}
          <button
            type="button"
            onClick={() => {
              setRepeatMode((m) => (m === 'none' ? 'verse' : m === 'verse' ? 'surah' : 'none'));
            }}
            aria-label={`Repeat mode: ${repeatMode}`}
            title={
              repeatMode === 'none'
                ? 'No repeat (continues to next surah)'
                : repeatMode === 'verse'
                  ? 'Repeat current verse'
                  : 'Repeat current surah'
            }
            className={`smallcaps inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border text-[10px] tracking-widest ${
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
