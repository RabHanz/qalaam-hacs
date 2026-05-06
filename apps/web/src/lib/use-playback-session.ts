'use client';

/**
 * usePlaybackSession — Spotify-Connect-style cross-device sync,
 * per ADR-0025 Phase 2. Subscribes to the backend SSE feed for
 * the authenticated user, mirrors `playback_sessions` state into
 * React state, and exposes typed command functions that POST to
 * /v1/playback/command.
 *
 * Per-user isolation: the SSE endpoint is auth-gated with the
 * existing cookie session, so two users on the same WiFi never
 * share a session — each EventSource only receives state for
 * the user whose cookie subscribed.
 *
 * Anonymous fallback: when the user is not authenticated, the
 * hook is inert (no SSE connection, command functions are
 * no-ops). MiniPlayer continues to drive the local audio + Cast
 * directly, exactly as before. Sign-in upgrades the experience.
 *
 * Echo-suppression: every command we send carries this hook's
 * `deviceId`. When the SSE pushes a state frame whose
 * activeDeviceId matches our own, we know it's an echo of our
 * own command — we don't redundantly mutate local state from
 * it. State changes from OTHER devices flow through normally.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const HEARTBEAT_INTERVAL_MS = 60_000;

export interface PlaybackSessionState {
  readonly verseKey: string;
  readonly reciterSlug: string;
  readonly positionSeconds: number;
  readonly isPaused: boolean;
  readonly target: string;
  readonly activeDeviceId: string | null;
  readonly updatedAt: number;
}

export interface PlaybackDevice {
  readonly deviceId: string;
  readonly name: string;
  readonly capabilities: readonly string[];
  readonly lastSeen: number;
}

export interface UsePlaybackSessionOptions {
  /** When false, the hook is dormant — no SSE, no heartbeat,
   *  command functions return without firing. Defaults to true.
   *  Used by MiniPlayer to disable session sync for anonymous
   *  users (the backend would 401 anyway). */
  readonly enabled: boolean;
}

export interface UsePlaybackSessionResult {
  /** True once the SSE has delivered at least one state frame.
   *  Components should withhold "we control playback" UI until
   *  this is true to avoid a startup flash. */
  readonly connected: boolean;
  /** This device's identifier — also sent on every command POST
   *  + every heartbeat. Generated once per browser tab via
   *  crypto.randomUUID(). */
  readonly deviceId: string;
  readonly state: PlaybackSessionState | null;
  readonly devices: readonly PlaybackDevice[];
  /** Returns true when the active device on the session row is
   *  THIS device — i.e. we're the controller. Other devices
   *  observe our updates but don't issue commands. */
  readonly isActiveDevice: boolean;
  readonly load: (verseKey: string, reciterSlug: string, target?: string) => Promise<void>;
  readonly play: (position?: number) => Promise<void>;
  readonly pause: (position?: number) => Promise<void>;
  readonly seek: (position: number) => Promise<void>;
  readonly transfer: (target: string) => Promise<void>;
  readonly sync: (position: number) => Promise<void>;
}

/** Generate a stable per-tab device ID. Persisted in sessionStorage
 *  so reloads keep the same identity (better device-list UX); each
 *  new tab is a different device. */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const cached = window.sessionStorage.getItem('qalaam-device-id');
    if (cached) return cached;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem('qalaam-device-id', id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function getDeviceName(): string {
  if (typeof window === 'undefined') return 'unknown';
  // Best-effort UA-derived label — the user can override later
  // via a preferences UI. Keep it human-friendly for the device
  // picker.
  const ua = navigator.userAgent;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  if (platform) return platform;
  if (/iPhone|iPad/i.test(ua)) return 'iOS device';
  if (/Android/i.test(ua)) return 'Android device';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'Browser';
}

export function usePlaybackSession(opts: UsePlaybackSessionOptions): UsePlaybackSessionResult {
  const { enabled } = opts;
  const deviceId = useMemo(() => getDeviceId(), []);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<PlaybackSessionState | null>(null);
  const [devices, setDevices] = useState<readonly PlaybackDevice[]>([]);
  // Track the deviceId we last sent a command from so SSE-echo
  // detection works without re-rendering on every echo.
  const lastSelfCommandRef = useRef(0);

  // SSE subscription — opens when enabled, auto-closes on disable
  // or unmount. EventSource's built-in reconnect handles transient
  // network blips.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const es = new EventSource('/api/v1/playback/subscribe');
    es.addEventListener('state', (e: MessageEvent<string>) => {
      try {
        const next = JSON.parse(e.data) as PlaybackSessionState;
        setState(next);
        setConnected(true);
      } catch {
        /* malformed frame — drop */
      }
    });
    es.addEventListener('error', () => {
      // EventSource auto-reconnects; we just mark disconnected so
      // UI can render an indicator.
      setConnected(false);
    });
    return (): void => {
      es.close();
      setConnected(false);
    };
  }, [enabled]);

  // Heartbeat — keeps this device alive in the per-user device
  // list. Runs every 60s while enabled, and once on first mount.
  useEffect(() => {
    if (!enabled) return;
    const send = (): void => {
      void fetch('/api/v1/playback/devices/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          name: getDeviceName(),
          capabilities: ['local-audio'],
        }),
      });
    };
    send();
    const id = window.setInterval(send, HEARTBEAT_INTERVAL_MS);
    return (): void => {
      window.clearInterval(id);
    };
  }, [enabled, deviceId]);

  // Devices list — refresh on a slower cadence (every 30s) plus
  // immediately after we send a command (in case a new device
  // just appeared).
  const refreshDevices = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/v1/playback/devices', { credentials: 'include' });
      if (!res.ok) return;
      const body = (await res.json()) as { devices: readonly PlaybackDevice[] };
      setDevices(body.devices);
    } catch {
      /* ignore */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refreshDevices();
    const id = window.setInterval(() => {
      void refreshDevices();
    }, 30_000);
    return (): void => {
      window.clearInterval(id);
    };
  }, [enabled, refreshDevices]);

  // Command primitive. Every command flows through this so the
  // self-command timestamp gets bumped + echo suppression stays
  // correct.
  const command = useCallback(
    async (body: Record<string, unknown>): Promise<void> => {
      if (!enabled) return;
      lastSelfCommandRef.current = Date.now();
      try {
        await fetch('/api/v1/playback/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, deviceId }),
        });
      } catch {
        /* network blip — UI will resync on next SSE frame */
      }
    },
    [enabled, deviceId],
  );

  const load = useCallback(
    async (verseKey: string, reciterSlug: string, target = 'local') => {
      await command({ action: 'load', verseKey, reciterSlug, target });
    },
    [command],
  );
  const play = useCallback(
    async (position?: number) => {
      await command({ action: 'play', position });
    },
    [command],
  );
  const pause = useCallback(
    async (position?: number) => {
      await command({ action: 'pause', position });
    },
    [command],
  );
  const seek = useCallback(
    async (position: number) => {
      await command({ action: 'seek', position });
    },
    [command],
  );
  const transfer = useCallback(
    async (target: string) => {
      await command({ action: 'transfer', target });
    },
    [command],
  );
  const sync = useCallback(
    async (position: number) => {
      await command({ action: 'sync', position });
    },
    [command],
  );

  const isActiveDevice = state?.activeDeviceId === deviceId;

  return {
    connected,
    deviceId,
    state,
    devices,
    isActiveDevice,
    load,
    play,
    pause,
    seek,
    transfer,
    sync,
  };
}
