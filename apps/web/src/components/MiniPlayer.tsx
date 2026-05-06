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
import {
  clearPositionSeconds,
  verseCountFor,
  writePlaying,
  writePositionSeconds,
  writeVerseKey,
} from '../lib/playback-store.js';
import { useCast } from '../lib/use-cast.js';
import { usePlaybackSession } from '../lib/use-playback-session.js';
import { useUser } from '../lib/use-user.js';

import { SendToPicker } from './SendToPicker.js';

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
  const { user } = useUser();
  const haUrl = user?.haUrl ?? null;
  const cast = useCast();
  // Cross-device session sync (ADR-0025 Phase 2). Dormant for
  // anonymous users — they get the same single-tab experience as
  // before. Authenticated users get cloud-mirrored playback
  // across all their devices.
  const session = usePlaybackSession({ enabled: Boolean(user) });
  // While casting we drive the receiver and ignore the local audio
  // element. The ROUTING flag is `cast.isConnected` — as soon as the
  // user picks a Cast device and the SDK confirms the session, we
  // route every command through the receiver. Previously this was
  // `connected && isMediaLoaded`, which created a chicken-and-egg
  // deadlock: media gets loaded by US (via cast.loadMedia), but our
  // load-effect only ran when `isCasting` was already true. So the
  // receiver sat idle until the user manually played, and reciter /
  // verse / surah changes never reached it. `isConnected` alone
  // breaks the deadlock — connect, then we load.
  const isCasting = cast.isConnected;
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localDuration, setLocalDuration] = useState(0);
  const [localPosition, setLocalPosition] = useState(0);
  // Scrub-in-progress — set during drag, cleared on commit. Pins
  // `position` to the drag value so receiver 1Hz updates don't snap
  // the slider back during a seek.
  const scrubRef = useRef<{ value: number } | null>(null);
  // Volume is persisted per-user via localStorage; default to 1.0
  // (full) on first mount. Hydrated in the dedicated effect below.
  const [localVolume, setLocalVolume] = useState(1);
  // Effective volume — receiver volume when casting, local volume
  // otherwise.
  const volume = isCasting ? cast.volume : localVolume;
  const isMuted = isCasting ? cast.isMuted : localVolume === 0;
  // Effective state surfaced to the UI — receiver state when casting,
  // local state otherwise. While the user is mid-drag, `scrubRef`
  // pins the displayed position to their drag value so 1Hz receiver
  // CURRENT_TIME_CHANGED echoes don't snap the slider back.
  const playing = isCasting ? !cast.isPaused : localPlaying;
  const duration = isCasting ? cast.duration : localDuration;
  const rawPosition = isCasting ? cast.currentTime : localPosition;
  const position = scrubRef.current?.value ?? rawPosition;
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldResumeRef = useRef(false);

  const reciterMeta = reciters.find((r) => r.slug === reciterSlug);
  const segmentsRef = useRef<{ wordIndex: number; startMs: number; endMs: number }[]>([]);
  const lastHlRef = useRef<{ verseKey: string; wordIndex: number } | null>(null);

  // ─── refs for stable-dep effects ─────────────────────────────────
  // The hooks (useCast, usePlaybackSession) return a memoised object
  // but the cross-cutting effects below STILL avoid putting them in
  // deps so the effect only fires on real signals. Refs let those
  // effects call the latest method without depending on the object
  // identity (the original page-hang root cause).
  const castRef = useRef(cast);
  castRef.current = cast;
  const reciterMetaRef = useRef(reciterMeta);
  reciterMetaRef.current = reciterMeta;
  // Local-state refs for the cross-device mirror effect.
  const playingRef = useRef(false);
  const verseKeyRef = useRef(verseKey);
  verseKeyRef.current = verseKey;
  const reciterSlugRef = useRef(reciterSlug);
  reciterSlugRef.current = reciterSlug;

  // Surah ayah counts — sourced from a hard-coded constant so cross-
  // surah advance NEVER depends on a /v1/metadata/surahs fetch
  // succeeding in time. (Earlier code raced the first end-of-ayah
  // against the fetch and would silently wrap to a non-existent
  // verse if the catalog hadn't landed yet.) The values are
  // immutable scripture; baking them in is safe.

  // Auto-resume — if the user was playing on /read (or another page)
  // when they navigated to /listen, the canonical playback flag is
  // set. Arm `shouldResumeRef` so the URL-resolve effect kicks
  // playback off as soon as the audio URL lands. Browsers gate
  // autoplay behind a user gesture, but the click on the nav link
  // counts as one — so this works in practice on first navigation.
  // Also captures the saved position so the resume seeks to where
  // the user actually was, not back to verse start.
  const resumePositionRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem('qalaam-playing') === '1') {
        shouldResumeRef.current = true;
      }
      const rawPos = window.localStorage.getItem('qalaam-position-seconds');
      if (rawPos) {
        const parsed = Number.parseFloat(rawPos);
        if (Number.isFinite(parsed) && parsed > 0) resumePositionRef.current = parsed;
      }
    } catch {
      /* ignore */
    }
    // Mount-only — we don't want to re-arm resume during the session.
  }, []);

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

  // Mirror canonical playback state to localStorage so the OTHER
  // player surface (ContinuousReaderPlayer on /read) can pick up
  // where we left off when the user navigates between pages.
  useEffect(() => {
    writeVerseKey(verseKey);
    // Verse changed — wipe any saved position from the previous
    // verse so cross-page resume starts at 0 for the new verse.
    clearPositionSeconds();
  }, [verseKey]);
  useEffect(() => {
    writePlaying(playing);
  }, [playing]);

  // Periodically persist current position while playing so a
  // cross-page resume lands at where the user actually IS, not just
  // at the last manual seek. Coarse 2 s tick — finer is wasted
  // localStorage writes for no UX benefit.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const a = audioRef.current;
      const pos = isCasting ? cast.currentTime : a?.currentTime;
      if (typeof pos === 'number' && pos > 0) writePositionSeconds(pos);
    }, 2000);
    return () => {
      window.clearInterval(id);
    };
  }, [playing, isCasting, cast]);

  // Resolve audio URL + segments whenever (verseKey, reciter) changes,
  // and broadcast the current word so any listener (e.g. an AyahCard
  // on the same page) can paint the matching word.
  //
  // We DO NOT clear audioUrl to null here — that would set <audio
  // src=undefined> momentarily, which on iOS Safari severs the
  // gesture-context chain and makes the next .play() fail without a
  // fresh tap. Instead we let the new URL replace the old in place.
  // Auto-advance was breaking on Al-Fatihah → Al-Baqarah for exactly
  // this reason: end-of-1:7 set audioUrl=null, then async fetch
  // resolved 2:1, but the .play() promise rejected silently.
  useEffect(() => {
    const cancel = { v: false };
    setLocalPosition(0);
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

  // While casting, every change to audioUrl pushes the new src to
  // the receiver immediately (autoplay=true on the LoadRequest, see
  // useCast.loadMedia). The lastCastSrcRef memo prevents redundant
  // reloads on unrelated re-renders. Stable deps only — the cast
  // method comes through a ref so we don't fire on cast-object
  // identity churn.
  const lastCastSrcRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isCasting || !audioUrl) return;
    if (lastCastSrcRef.current === audioUrl) return;
    lastCastSrcRef.current = audioUrl;
    // Pause local audio when casting so the user doesn't hear both
    // sources during the brief loadMedia round-trip.
    audioRef.current?.pause();
    setLocalPlaying(false);
    const meta = reciterMetaRef.current;
    const title = meta ? `${meta.name.en} · ${verseKey}` : `${reciterSlug} · ${verseKey}`;
    const artist = meta ? meta.name.en : reciterSlug;
    void castRef.current.loadMedia(audioUrl, { title, artist });
  }, [isCasting, audioUrl, reciterSlug, verseKey]);

  // Local-audio-only resume path (kicks off local playback when the
  // user had toggled play before the URL fetch completed).
  useEffect(() => {
    if (isCasting) return;
    if (!audioUrl || !shouldResumeRef.current || !audioRef.current) return;
    const a = audioRef.current;
    shouldResumeRef.current = false;
    // Apply any saved position from the cross-page resume so seek
    // is preserved across navigations.
    if (resumePositionRef.current !== null) {
      try {
        a.currentTime = resumePositionRef.current;
      } catch {
        /* not yet seekable — onLoadedMetadata will retry below */
      }
      resumePositionRef.current = null;
    }
    void a.play().then(
      () => {
        setLocalPlaying(true);
      },
      () => {
        setLocalPlaying(false);
      },
    );
  }, [audioUrl, isCasting]);

  // When the cast session ENDS (receiver disconnect, user stopped
  // casting), keep playback continuous on local — the user expects
  // the recitation to keep flowing, just from this device now.
  const wasCastingRef = useRef(isCasting);
  useEffect(() => {
    const wasCasting = wasCastingRef.current;
    wasCastingRef.current = isCasting;
    if (wasCasting && !isCasting) {
      // Cast just ended — clear the cast-src memo so re-engagement
      // works, and resume local audio if we have a URL queued.
      lastCastSrcRef.current = null;
      if (audioRef.current && audioUrl) {
        void audioRef.current.play().then(
          () => {
            setLocalPlaying(true);
          },
          () => {
            setLocalPlaying(false);
          },
        );
      }
    }
  }, [isCasting, audioUrl]);

  const advance = useCallback(
    (direction: 1 | -1, autoplay: boolean) => {
      const [s, a] = verseKey.split(':').map((n) => Number.parseInt(n, 10));
      if (!s || !a) return;
      let nextSurah = s;
      let nextAyah = a + direction;

      // Cross-surah forward — overflow → next surah ayah 1.
      if (direction === 1) {
        const cur = verseCountFor(s);
        if (cur > 0 && nextAyah > cur) {
          if (s >= 114) return; // end of mushaf — stop
          nextSurah = s + 1;
          nextAyah = 1;
        }
      }
      // Cross-surah backward — underflow → previous surah's last ayah.
      if (direction === -1 && nextAyah < 1) {
        if (s <= 1) return; // before Al-Fatihah — stop
        nextSurah = s - 1;
        const prevLen = verseCountFor(nextSurah);
        nextAyah = prevLen > 0 ? prevLen : 1;
      }

      const nextKey = `${nextSurah.toString()}:${nextAyah.toString()}`;
      shouldResumeRef.current = autoplay;
      onVerseKeyChange(nextKey);
    },
    [verseKey, onVerseKeyChange],
  );

  // Persist + restore volume across mounts via localStorage.
  // Hydrate-only on the client (window check) so SSR doesn't crash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('qalaam-volume');
      if (raw) {
        const v = Number.parseFloat(raw);
        if (Number.isFinite(v) && v >= 0 && v <= 1) setLocalVolume(v);
      }
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  // Push local volume into the <audio> element whenever it changes.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = localVolume;
  }, [localVolume]);

  function onVolumeChange(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    if (isCasting) {
      cast.setVolume(clamped);
      return;
    }
    setLocalVolume(clamped);
    try {
      window.localStorage.setItem('qalaam-volume', clamped.toString());
    } catch {
      /* ignore */
    }
  }

  function toggleMute(): void {
    if (isCasting) {
      cast.toggleMute();
      return;
    }
    if (localVolume === 0) {
      // Restore last non-zero volume if we tracked one — otherwise
      // unmute to half so the user has an audible reference.
      const stored = (() => {
        try {
          const raw = window.localStorage.getItem('qalaam-volume-prev');
          const v = raw ? Number.parseFloat(raw) : 0.5;
          return Number.isFinite(v) && v > 0 ? v : 0.5;
        } catch {
          return 0.5;
        }
      })();
      onVolumeChange(stored);
      return;
    }
    try {
      window.localStorage.setItem('qalaam-volume-prev', localVolume.toString());
    } catch {
      /* ignore */
    }
    onVolumeChange(0);
  }

  // ─── Cross-device session sync — Spotify-Connect-style ──────────
  //
  // Design (matches Spotify / Apple Music / Tidal):
  //   - Exactly ONE device is the "active" device at a time.
  //   - The active device PLAYS audio. All other devices SHOW what's
  //     playing (verseKey, position, isPaused) but never emit audio.
  //   - Any local user action (play / pause / seek / verse change)
  //     CLAIMS the active device — the action propagates to backend,
  //     other tabs/devices then go silent + show "Currently playing
  //     on <this device>".
  //   - Echo-suppression: when SSE pushes a state whose
  //     activeDeviceId matches OUR deviceId, it's an echo of our own
  //     command — skip.
  //
  // Refs declared once near the top of the component (see early-block
  // above). Just keep them in sync with the latest reactive values.
  playingRef.current = playing;
  const sessionStateRef = useRef(session.state);
  sessionStateRef.current = session.state;
  const isCastingRef = useRef(isCasting);
  isCastingRef.current = isCasting;

  // Track who's playing — drives the "Playing on <device>"
  // indicator below the player. someoneElseIsActive is the trigger
  // for the indicator + for the mirror effect's silence behaviour.
  const remoteActiveDeviceId = session.state?.activeDeviceId ?? null;
  const someoneElseIsActive =
    session.connected && remoteActiveDeviceId !== null && remoteActiveDeviceId !== session.deviceId;
  const activeDeviceName = (() => {
    if (!someoneElseIsActive) return null;
    const dev = session.devices.find((d) => d.deviceId === remoteActiveDeviceId);
    return dev?.name ?? 'another device';
  })();

  // Push local verse/reciter changes to the session as a `load`
  // command. Stable primitive deps so this only fires on actual
  // verse/reciter/casting transitions, not every parent render.
  const lastPushedRef = useRef<{ vk: string; r: string; t: string } | null>(null);
  useEffect(() => {
    if (!session.connected) return;
    const target = isCasting ? 'cast' : 'local';
    const pushed = lastPushedRef.current;
    if (pushed?.vk === verseKey && pushed.r === reciterSlug && pushed.t === target) return;
    lastPushedRef.current = { vk: verseKey, r: reciterSlug, t: target };
    void session.load(verseKey, reciterSlug, target);
    // session.load is stable (useCallback in the hook).
  }, [session.connected, session.load, verseKey, reciterSlug, isCasting]);

  // Mirror remote state. Effect fires only when state.updatedAt
  // actually moves (single primitive dep) — keeps render cost
  // bounded. Body reads everything else from refs so it never
  // forces extra runs.
  const stateUpdatedAt = session.state?.updatedAt ?? 0;
  useEffect(() => {
    const remote = sessionStateRef.current;
    if (!remote) return;
    // Echo from our own command — already applied locally.
    if (remote.activeDeviceId === session.deviceId) return;
    // Verse / reciter switch initiated remotely → mirror UI only.
    // We do NOT auto-play; the user must explicitly take over by
    // hitting play. Spotify works the same way — when you switch
    // playback to a different device, the previously-active device
    // pauses; it does not start playing on its own.
    if (remote.verseKey !== verseKeyRef.current) {
      onVerseKeyChange(remote.verseKey);
    }
    if (remote.reciterSlug !== reciterSlugRef.current) {
      window.dispatchEvent(
        new CustomEvent('qalaam:remote-reciter', { detail: { slug: remote.reciterSlug } }),
      );
    }
    // We are NOT the active device — be silent. Pause whichever
    // transport is currently playing locally + don't auto-play
    // anything based on remote state.
    if (playingRef.current) {
      if (isCastingRef.current) castRef.current.pause();
      else audioRef.current?.pause();
      setLocalPlaying(false);
    }
    // Note: we deliberately don't sync currentTime back to the
    // <audio> element on non-active devices — that just resets the
    // scrub position visually. The displayed `position` reads from
    // remote state directly via the UI (see `position` derivation).
  }, [stateUpdatedAt, session.deviceId, onVerseKeyChange]);

  // When casting, hook into the receiver's "media ended" signal so
  // we advance to the next ayah and load it on the receiver. Without
  // this, the receiver plays one ayah and stops — exactly the bug
  // the user reported. On local audio, this is handled by the
  // <audio onEnded> handler below.
  useEffect(() => {
    if (!isCasting) return;
    const off = cast.onMediaEnded(() => {
      advance(1, true);
    });
    return off;
  }, [isCasting, cast, advance]);

  function togglePlay(): void {
    if (isCasting) {
      if (cast.isPaused) {
        cast.play();
        if (session.connected) void session.play(cast.currentTime);
      } else {
        cast.pause();
        if (session.connected) void session.pause(cast.currentTime);
      }
      return;
    }
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setLocalPlaying(false);
      if (session.connected) void session.pause(a.currentTime);
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
        setLocalPlaying(true);
        if (session.connected) void session.play(a.currentTime);
      },
      () => {
        setLocalPlaying(false);
      },
    );
  }

  // Seek is split across THREE handlers so the slider stays
  // responsive while the user drags + commits cleanly on release.
  // Without scrub-tracking, the receiver's CURRENT_TIME_CHANGED
  // events (1Hz from cast) snap the slider back during the drag.
  function onSeekInput(e: React.ChangeEvent<HTMLInputElement>): void {
    // Live drag — update only the visual scrub state, NOT the
    // transport. Display reads scrubRef when present.
    const t = Number.parseFloat(e.target.value);
    scrubRef.current = { value: t };
    setLocalPosition(t);
  }
  function onSeekCommit(e: React.SyntheticEvent<HTMLInputElement>): void {
    const t = Number.parseFloat((e.target as HTMLInputElement).value);
    scrubRef.current = null;
    if (isCasting) {
      cast.seek(t);
    } else {
      const a = audioRef.current;
      if (a) {
        a.currentTime = t;
        setLocalPosition(t);
      }
    }
    // Persist the seek so a cross-page resume (or page reload) lands
    // back at the same position instead of always at 0.
    writePositionSeconds(t);
    if (session.connected) void session.seek(t);
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setLocalDuration(e.currentTarget.duration);
        }}
        onTimeUpdate={(e) => {
          setLocalPosition(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          // Local-audio end-of-track. When casting, the cast hook's
          // onMediaEnded subscriber drives advance — this only fires
          // for direct local playback.
          if (isCasting) return;
          setLocalPlaying(false);
          setLocalPosition(0);
          advance(1, true);
        }}
      />
      <div
        className="border-hairline bg-paper-100/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md"
        role="region"
        aria-label="Audio player"
      >
        {someoneElseIsActive ? (
          <div
            className="bg-leaf-500/8 border-leaf-500/20 text-leaf-700 mx-auto flex max-w-5xl items-center justify-between gap-3 border-b px-3 py-1.5 text-[11px] sm:px-6"
            role="status"
            aria-live="polite"
          >
            <span className="truncate">
              <span className="opacity-70">Playing on</span>{' '}
              <strong className="font-medium">{activeDeviceName}</strong>
            </span>
            <button
              type="button"
              onClick={togglePlay}
              className="border-leaf-500/30 hover:bg-leaf-500/15 shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
            >
              Take over
            </button>
          </div>
        ) : null}
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
              onChange={onSeekInput}
              onMouseUp={onSeekCommit}
              onTouchEnd={onSeekCommit}
              onKeyUp={onSeekCommit}
              className="accent-leaf hidden flex-1 sm:block"
            />

            {/* Volume — desktop only (mobile uses OS-level system
                volume; bottom-bar real estate is too tight). The
                control routes to the receiver when casting and to
                the local <audio> otherwise via onVolumeChange. */}
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                onClick={toggleMute}
                className="text-ink-muted hover:text-ink inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3L19 14.5l1.5-1.5L18 11l2.5-2.5L19 7l-2.5 2.5L14 7l-1.5 1.5L15 11l-2.5 2.5L14 15z" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 9v6h4l5 4V5L7 9H3zm11.5 3a4 4 0 0 0-2.5-3.7v7.4A4 4 0 0 0 14.5 12z" />
                  </svg>
                ) : (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 9v6h4l5 4V5L7 9H3zm11.5 3a4 4 0 0 0-2.5-3.7v7.4A4 4 0 0 0 14.5 12zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                aria-label="Volume"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  onVolumeChange(Number.parseFloat(e.target.value));
                }}
                className="accent-leaf w-20"
              />
            </div>

            <SendToPicker
              audioRef={audioRef}
              currentSrc={audioUrl ?? null}
              haUrl={haUrl}
              title={`${reciterMeta?.name.en ?? reciterSlug} · ${verseKey}`}
              artist={reciterMeta?.name.en ?? reciterSlug}
            />
          </div>

          <input
            type="range"
            aria-label="Seek (mobile)"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 1}
            step={0.1}
            value={position}
            onChange={onSeekInput}
            onMouseUp={onSeekCommit}
            onTouchEnd={onSeekCommit}
            onKeyUp={onSeekCommit}
            className="accent-leaf mt-2 block w-full sm:hidden"
          />
        </div>
      </div>
    </>
  );
}
