'use client';

/**
 * useCast — single source of truth for the Cast Sender SDK session.
 *
 * Why this exists: SendToPicker LAUNCHES a cast session, MiniPlayer
 * RUNS local playback. Without a shared layer, the player keeps
 * driving the local <audio> element while the receiver plays
 * something else, so:
 *   - Pressing play/pause on Qalaam doesn't pause the receiver.
 *   - Scrubbing doesn't seek the receiver.
 *   - When the local audio ends, advance(1) loads the next ayah
 *     into local audio, NOT the receiver — receiver keeps the old
 *     ayah on screen.
 *   - When the remote (TV remote, cast app) pauses, our UI keeps
 *     showing "playing".
 *
 * This hook wraps the Cast Framework's RemotePlayer +
 * RemotePlayerController. When a session is active, it exposes the
 * receiver's state and accepts the same commands the local audio
 * accepts (loadMedia, play/pause, seek). Players bind to the hook
 * once, route every command through it, and stay in sync via the
 * subscription model.
 *
 * Lifecycle:
 *   1. SDK loads (lazy — first call to useCast on a Cast-capable
 *      browser triggers the script tag).
 *   2. User taps "Cast" in SendToPicker → requestSession() opens
 *      the OS picker.
 *   3. Session starts → `isConnected = true`. The hook auto-loads
 *      the current src + title + artist via `loadMedia`.
 *   4. RemotePlayerController events fire → React state updates.
 *   5. Components route play / pause / seek through the hook.
 *   6. When media ends on the receiver, the hook fires
 *      `onMediaEnded` so MiniPlayer can advance to the next ayah +
 *      reload media on the same session (NOT a fresh local audio).
 *   7. Session ends (user disconnects, or cast UI close) →
 *      `isConnected = false`, control returns to local audio.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

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
  playerState?: string;
  mediaInfo?: MediaInfo | null;
}
interface RemotePlayerController {
  playOrPause(): void;
  seek(): void;
  stop(): void;
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

// ─── Hook ─────────────────────────────────────────────────────────
export interface UseCastResult {
  /** True when a Cast session is live + media is loaded. Components
   *  should route play / pause / seek through this hook when true,
   *  and through the local audio element when false. */
  readonly isConnected: boolean;
  readonly isPaused: boolean;
  /** Receiver-side playback position, in seconds. Mirrors the
   *  RemotePlayer.currentTime — fires on every CURRENT_TIME_CHANGED
   *  event (typically 1 Hz from the receiver). */
  readonly currentTime: number;
  /** Receiver-side media duration, in seconds. Zero until the
   *  loaded media reports its duration. */
  readonly duration: number;
  /** True after `loadMedia` resolves and the receiver acknowledges
   *  it loaded the new src. Useful for gating "started" UI. */
  readonly isMediaLoaded: boolean;
  /** Whether the Cast SDK is ready and at least one cast device
   *  has been discovered. (We don't try to surface device count —
   *  the OS picker handles that.) */
  readonly isAvailable: boolean;
  /** Boot the SDK + open the OS Cast picker. Resolves to `true` if
   *  the user picked a device and the session started. */
  readonly requestSession: () => Promise<boolean>;
  /** Load (or replace) the current media on the active receiver.
   *  No-op if no session is live. */
  readonly loadMedia: (
    src: string,
    opts: { title: string; artist: string; contentType?: string },
  ) => Promise<void>;
  readonly play: () => void;
  readonly pause: () => void;
  /** Seek the receiver to `seconds` (uses controller.seek() after
   *  setting RemotePlayer.currentTime per Cast SDK contract). */
  readonly seek: (seconds: number) => void;
  /** End the current session (returns control to local playback). */
  readonly endSession: () => void;
  /** Subscribe to "media just ended" — fires when the receiver
   *  signals the loaded item finished. MiniPlayer hooks this to
   *  call advance(1) + loadMedia(nextSrc). */
  readonly onMediaEnded: (handler: () => void) => () => void;
}

export function useCast(): UseCastResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const playerRef = useRef<RemotePlayer | null>(null);
  const controllerRef = useRef<RemotePlayerController | null>(null);
  const endedHandlersRef = useRef<Set<() => void>>(new Set());
  const wasPlayingRef = useRef(false);

  // Boot SDK on mount (lazy: only when this hook is actually used).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    void loadCastSdk().then((ok) => {
      if (cancelled || !ok) return;
      ensureCastOptions();
      const w = window as ChromeCastWindow;
      const fw = w.cast?.framework;
      if (!fw) return;

      const player = new fw.RemotePlayer();
      const controller = new fw.RemotePlayerController(player);
      playerRef.current = player;
      controllerRef.current = controller;
      setIsAvailable(true);

      const sync = (): void => {
        const wasPlayingBefore = wasPlayingRef.current;
        const isPlayingNow = player.isMediaLoaded && !player.isPaused;
        wasPlayingRef.current = isPlayingNow;

        setIsConnected(player.isConnected);
        setIsPaused(player.isPaused);
        setCurrentTime(player.currentTime);
        setDuration(player.duration);
        setIsMediaLoaded(player.isMediaLoaded);

        // "Ended" signal — receiver finishes when playerState
        // transitions to IDLE while currentTime is at duration.
        // The Cast SDK exposes this via `IS_MEDIA_LOADED_CHANGED`
        // flipping to false AFTER having been true; we also catch
        // the (currentTime >= duration > 0) case since some
        // receivers don't unload media on end.
        const justEnded =
          (wasPlayingBefore && !player.isMediaLoaded) ||
          (player.duration > 0 && player.currentTime >= player.duration - 0.25 && player.isPaused);
        if (justEnded) {
          for (const h of endedHandlersRef.current) {
            try {
              h();
            } catch {
              /* handler must not throw */
            }
          }
        }
      };

      // ANY_CHANGE fires for every property update we care about —
      // a single listener keeps the state aligned with the receiver.
      controller.addEventListener(fw.RemotePlayerEventType.ANY_CHANGE, sync);
      // Initial pull (player carries pre-existing values when the
      // hook mounts AFTER a session is already alive — e.g. the user
      // hot-reloads while casting).
      sync();
    });
    return (): void => {
      cancelled = true;
      // Don't tear the controller down on unmount — the SDK is a
      // singleton and other hook instances may still be using it.
      // We just drop our handlers from the ended-handler set in the
      // onMediaEnded subscriber's own cleanup.
    };
  }, []);

  const requestSession = useCallback(async (): Promise<boolean> => {
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
      // user dismissed picker or device unreachable
      return false;
    }
  }, []);

  const loadMedia = useCallback(
    async (
      src: string,
      opts: { title: string; artist: string; contentType?: string },
    ): Promise<void> => {
      if (typeof window === 'undefined') return;
      const w = window as ChromeCastWindow;
      const ctx = w.cast?.framework?.CastContext.getInstance();
      const session = ctx?.getCurrentSession();
      if (!session) return;
      const cast = w.chrome?.cast;
      if (!cast?.media) return;
      const info = new cast.media.MediaInfo(src, opts.contentType ?? 'audio/mpeg');
      info.metadata = {
        metadataType: 0,
        title: opts.title,
        subtitle: opts.artist,
      };
      const req = new cast.media.LoadRequest(info);
      try {
        await session.loadMedia(req);
      } catch {
        /* receiver rejected — caller keeps local playback */
      }
    },
    [],
  );

  const play = useCallback((): void => {
    const c = controllerRef.current;
    const p = playerRef.current;
    if (!c || !p) return;
    if (p.isPaused) c.playOrPause();
  }, []);

  const pause = useCallback((): void => {
    const c = controllerRef.current;
    const p = playerRef.current;
    if (!c || !p) return;
    if (!p.isPaused) c.playOrPause();
  }, []);

  const seek = useCallback((seconds: number): void => {
    const c = controllerRef.current;
    const p = playerRef.current;
    if (!c || !p) return;
    p.currentTime = seconds;
    c.seek();
  }, []);

  const endSession = useCallback((): void => {
    if (typeof window === 'undefined') return;
    const w = window as ChromeCastWindow;
    const ctx = w.cast?.framework?.CastContext.getInstance();
    const session = ctx?.getCurrentSession();
    session?.endSession(true);
  }, []);

  const onMediaEnded = useCallback((handler: () => void): (() => void) => {
    endedHandlersRef.current.add(handler);
    return (): void => {
      endedHandlersRef.current.delete(handler);
    };
  }, []);

  return {
    isConnected,
    isPaused,
    currentTime,
    duration,
    isMediaLoaded,
    isAvailable,
    requestSession,
    loadMedia,
    play,
    pause,
    seek,
    endSession,
    onMediaEnded,
  };
}
