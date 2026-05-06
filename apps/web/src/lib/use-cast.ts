'use client';

/**
 * useCast — single source of truth for the Cast Sender SDK session.
 *
 * SINGLETON-BACKED.  Earlier this hook constructed a fresh
 * RemotePlayer + RemotePlayerController per call site, each with its
 * own ANY_CHANGE listener. /read renders one AyahCard per ayah (286
 * for Al-Baqarah), so every cast tick triggered ~286 setState chains
 * → render storm → page hang. The fix is one global player + one
 * global listener; consumers subscribe to a snapshot and re-render
 * only when the snapshot changes.
 *
 * Public API is unchanged — drop-in replacement for the previous
 * per-instance implementation.
 *
 * Lifecycle (global, runs once per origin):
 *   1. SDK loads on first useCast() call.
 *   2. RemotePlayer + Controller created at module scope.
 *   3. ANY_CHANGE → mutate singleton snapshot → notify subscribers.
 *   4. SESSION_STATE_CHANGED → also notify (handles auto-rejoin
 *      after page navigation when autoJoinPolicy='origin_scoped').
 *   5. End-of-media detection (PLAYING/BUFFERING → IDLE) fires
 *      every registered onMediaEnded handler.
 */
import { useEffect, useMemo, useState } from 'react';

const CAST_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const DEFAULT_RECEIVER_APP_ID = 'CC1AD845';

// ─── Cast Framework types (the bits we use) ───────────────────────
interface MediaInfo {
  contentId?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}
interface LoadRequest {
  media?: MediaInfo;
}
interface CastSession {
  loadMedia(req: LoadRequest): Promise<void>;
  endSession(stopCasting: boolean): void;
}
interface RemotePlayer {
  isConnected: boolean;
  isPaused: boolean;
  isMediaLoaded: boolean;
  currentTime: number;
  duration: number;
  /** 0..1 (Cast SDK: linear scale). */
  volumeLevel: number;
  isMuted: boolean;
  /** PLAYING | PAUSED | BUFFERING | IDLE | undefined. */
  playerState?: string;
  mediaInfo?: MediaInfo | null;
}
interface RemotePlayerController {
  playOrPause(): void;
  seek(): void;
  stop(): void;
  setVolumeLevel(): void;
  muteOrUnmute(): void;
  addEventListener(event: string, handler: () => void): void;
  removeEventListener(event: string, handler: () => void): void;
}
interface CastFramework {
  CastContext: {
    getInstance(): {
      setOptions(opts: unknown): void;
      requestSession(): Promise<void>;
      getCurrentSession(): CastSession | null;
      addEventListener(event: string, handler: (e: unknown) => void): void;
      removeEventListener(event: string, handler: (e: unknown) => void): void;
    };
  };
  RemotePlayer: new () => RemotePlayer;
  RemotePlayerController: new (player: RemotePlayer) => RemotePlayerController;
  RemotePlayerEventType: {
    IS_CONNECTED_CHANGED: string;
    IS_PAUSED_CHANGED: string;
    IS_MEDIA_LOADED_CHANGED: string;
    CURRENT_TIME_CHANGED: string;
    DURATION_CHANGED: string;
    PLAYER_STATE_CHANGED: string;
    ANY_CHANGE: string;
  };
  CastContextEventType: { SESSION_STATE_CHANGED: string };
}

interface ChromeCastWindow extends Window {
  cast?: { framework?: CastFramework };
  chrome?: {
    cast?: {
      media?: {
        MediaInfo: new (url: string, contentType: string) => MediaInfo;
        LoadRequest: new (info: MediaInfo) => LoadRequest;
      };
    };
  };
  __qalaamCastReady?: boolean;
  __onGCastApiAvailable?: (avail: boolean) => void;
}

// ─── Singleton state (module-level, ONE per origin) ──────────────
interface Snapshot {
  isConnected: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  isMediaLoaded: boolean;
  isAvailable: boolean;
  volume: number;
  isMuted: boolean;
}

const initialSnapshot: Snapshot = {
  isConnected: false,
  isPaused: true,
  currentTime: 0,
  duration: 0,
  isMediaLoaded: false,
  isAvailable: false,
  volume: 1,
  isMuted: false,
};

let snapshot: Snapshot = initialSnapshot;
const subscribers = new Set<() => void>();
const endedHandlers = new Set<() => void>();

let player: RemotePlayer | null = null;
let controller: RemotePlayerController | null = null;
let booted = false;
let prevPlayerState: string | undefined;
let sawPlaying = false;

function commitSnapshot(next: Partial<Snapshot>): void {
  // Skip the notify if no field actually changed — saves render
  // churn on no-op ANY_CHANGE ticks (Cast SDK fires plenty).
  let changed = false;
  for (const k of Object.keys(next) as (keyof Snapshot)[]) {
    if (snapshot[k] !== next[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  snapshot = { ...snapshot, ...next };
  for (const cb of subscribers) {
    try {
      cb();
    } catch {
      /* subscriber must not throw */
    }
  }
}

// ─── SDK loader (singleton, idempotent across mounts) ────────────
let sdkPromise: Promise<boolean> | null = null;

function loadCastSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (sdkPromise) return sdkPromise;
  const w = window as ChromeCastWindow;
  if (w.cast?.framework) {
    sdkPromise = Promise.resolve(true);
    return sdkPromise;
  }
  sdkPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      w.__qalaamCastReady = true;
      resolve(ok);
    };
    w.__onGCastApiAvailable = (available: boolean): void => {
      finish(available && Boolean(w.cast?.framework));
    };
    const script = document.createElement('script');
    script.src = CAST_SDK_URL;
    script.async = true;
    script.onerror = (): void => {
      finish(false);
    };
    document.head.appendChild(script);
    const start = Date.now();
    const poll = (): void => {
      if (settled) return;
      if (w.cast?.framework) {
        finish(true);
        return;
      }
      if (Date.now() - start > 3500) {
        finish(false);
        return;
      }
      setTimeout(poll, 200);
    };
    setTimeout(poll, 500);
  });
  return sdkPromise;
}

function ensureCastOptions(): void {
  if (typeof window === 'undefined') return;
  const w = window as ChromeCastWindow;
  try {
    w.cast?.framework?.CastContext.getInstance().setOptions({
      receiverApplicationId: DEFAULT_RECEIVER_APP_ID,
      autoJoinPolicy: 'origin_scoped',
    });
  } catch {
    /* benign init quirk */
  }
}

function syncFromPlayer(): void {
  if (!player) return;
  const ps = player.playerState;
  const wasActive = prevPlayerState === 'PLAYING' || prevPlayerState === 'BUFFERING';
  if (ps === 'PLAYING' || ps === 'BUFFERING') sawPlaying = true;
  const justEnded = wasActive && ps === 'IDLE' && sawPlaying;
  prevPlayerState = ps;

  commitSnapshot({
    isConnected: player.isConnected,
    isPaused: player.isPaused,
    currentTime: player.currentTime,
    duration: player.duration,
    isMediaLoaded: player.isMediaLoaded,
    volume: player.volumeLevel,
    isMuted: player.isMuted,
  });

  if (justEnded) {
    sawPlaying = false;
    for (const h of endedHandlers) {
      try {
        h();
      } catch {
        /* handler must not throw */
      }
    }
  }
}

function bootSingleton(): void {
  if (booted) return;
  booted = true;
  if (typeof window === 'undefined') return;
  void loadCastSdk().then((ok) => {
    if (!ok) return;
    ensureCastOptions();
    const w = window as ChromeCastWindow;
    const fw = w.cast?.framework;
    if (!fw) return;

    player = new fw.RemotePlayer();
    controller = new fw.RemotePlayerController(player);
    commitSnapshot({ isAvailable: true });

    controller.addEventListener(fw.RemotePlayerEventType.ANY_CHANGE, syncFromPlayer);
    syncFromPlayer();

    // Auto-rejoin via origin_scoped policy. Subscribe to session
    // events so a fresh page mount detects the existing session.
    try {
      fw.CastContext.getInstance().addEventListener(
        fw.CastContextEventType.SESSION_STATE_CHANGED,
        () => {
          syncFromPlayer();
        },
      );
    } catch {
      /* older SDK builds don't expose this */
    }
    // Backstop: poll for ~3 s on first boot so SDK builds that
    // don't emit SESSION_STATE_CHANGED on rejoin still settle.
    const startedAt = Date.now();
    const tick = (): void => {
      syncFromPlayer();
      if (Date.now() - startedAt < 3000) {
        window.setTimeout(tick, 250);
      }
    };
    window.setTimeout(tick, 100);
  });
}

// ─── Imperative API (no React state, no subscriptions) ───────────
// Components that only need to ACT on cast (e.g. AyahCard's
// togglePlay) can use these directly and skip the render-cycle
// subscription. Keeps O(1) listener count regardless of how many
// AyahCards are mounted on a page.

export function getCastSnapshot(): Snapshot {
  bootSingleton();
  return snapshot;
}

export async function castRequestSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ok = await loadCastSdk();
  if (!ok) return false;
  ensureCastOptions();
  const w = window as ChromeCastWindow;
  const ctx = w.cast?.framework?.CastContext.getInstance();
  if (!ctx) return false;
  try {
    await ctx.requestSession();
    return Boolean(ctx.getCurrentSession());
  } catch {
    return false;
  }
}

export async function castLoadMedia(
  src: string,
  opts: { title: string; artist: string; contentType?: string },
): Promise<void> {
  if (typeof window === 'undefined') return;
  const w = window as ChromeCastWindow;
  const ctx = w.cast?.framework?.CastContext.getInstance();
  const session = ctx?.getCurrentSession();
  if (!session) return;
  const cast = w.chrome?.cast;
  if (!cast?.media) return;
  // Reset end-of-media detection for the new track so a transient
  // IDLE during the load round-trip can't get classified as the
  // previous track's end-of-media.
  sawPlaying = false;
  prevPlayerState = undefined;
  const info = new cast.media.MediaInfo(src, opts.contentType ?? 'audio/mpeg');
  info.metadata = {
    metadataType: 0,
    title: opts.title,
    subtitle: opts.artist,
  };
  const req = new cast.media.LoadRequest(info);
  (req as { autoplay?: boolean }).autoplay = true;
  try {
    await session.loadMedia(req);
  } catch {
    /* receiver rejected — caller keeps local playback */
  }
}

export function castPlay(): void {
  if (!player || !controller) return;
  if (player.isPaused) controller.playOrPause();
}

export function castPause(): void {
  if (!player || !controller) return;
  if (!player.isPaused) controller.playOrPause();
}

export function castSeek(seconds: number): void {
  if (!player || !controller) return;
  player.currentTime = seconds;
  controller.seek();
  commitSnapshot({ currentTime: seconds });
}

export function castSetVolume(level: number): void {
  if (!player || !controller) return;
  const clamped = Math.max(0, Math.min(1, level));
  player.volumeLevel = clamped;
  controller.setVolumeLevel();
  commitSnapshot({ volume: clamped });
}

export function castToggleMute(): void {
  if (!player || !controller) return;
  controller.muteOrUnmute();
  commitSnapshot({ isMuted: !player.isMuted });
}

export function castEndSession(): void {
  if (typeof window === 'undefined') return;
  const w = window as ChromeCastWindow;
  const ctx = w.cast?.framework?.CastContext.getInstance();
  const session = ctx?.getCurrentSession();
  session?.endSession(true);
}

export function castOnMediaEnded(handler: () => void): () => void {
  endedHandlers.add(handler);
  return (): void => {
    endedHandlers.delete(handler);
  };
}

// ─── Hook (subscribes to snapshot changes) ───────────────────────
export interface UseCastResult {
  readonly isConnected: boolean;
  readonly isPaused: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly isMediaLoaded: boolean;
  readonly isAvailable: boolean;
  readonly volume: number;
  readonly isMuted: boolean;
  readonly requestSession: () => Promise<boolean>;
  readonly loadMedia: (
    src: string,
    opts: { title: string; artist: string; contentType?: string },
  ) => Promise<void>;
  readonly play: () => void;
  readonly pause: () => void;
  readonly seek: (seconds: number) => void;
  readonly setVolume: (level: number) => void;
  readonly toggleMute: () => void;
  readonly endSession: () => void;
  readonly onMediaEnded: (handler: () => void) => () => void;
}

export function useCast(): UseCastResult {
  // Boot the singleton on first call. Idempotent.
  if (typeof window !== 'undefined') bootSingleton();

  // Subscribe — a single cb per consumer that just bumps a tick so
  // React re-renders. The render then reads the latest singleton
  // snapshot via useMemo deps.
  const [snap, setSnap] = useState<Snapshot>(() => snapshot);
  useEffect(() => {
    const cb = (): void => {
      setSnap(snapshot);
    };
    subscribers.add(cb);
    cb(); // sync immediately in case singleton state moved before mount
    return (): void => {
      subscribers.delete(cb);
    };
  }, []);

  return useMemo(
    () => ({
      isConnected: snap.isConnected,
      isPaused: snap.isPaused,
      currentTime: snap.currentTime,
      duration: snap.duration,
      isMediaLoaded: snap.isMediaLoaded,
      isAvailable: snap.isAvailable,
      volume: snap.volume,
      isMuted: snap.isMuted,
      requestSession: castRequestSession,
      loadMedia: castLoadMedia,
      play: castPlay,
      pause: castPause,
      seek: castSeek,
      setVolume: castSetVolume,
      toggleMute: castToggleMute,
      endSession: castEndSession,
      onMediaEnded: castOnMediaEnded,
    }),
    [
      snap.isConnected,
      snap.isPaused,
      snap.currentTime,
      snap.duration,
      snap.isMediaLoaded,
      snap.isAvailable,
      snap.volume,
      snap.isMuted,
    ],
  );
}
