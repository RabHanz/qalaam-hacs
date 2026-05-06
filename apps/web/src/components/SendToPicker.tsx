'use client';

/**
 * SendToPicker — "Send to…" popover on the recitation player.
 *
 * Routes the active <audio> element to a remote target. Three vectors:
 *
 *   1. AirPlay (Safari + iOS Safari + macOS Safari).
 *      `audio.webkitShowPlaybackTargetPicker()` invokes the native iOS/
 *      macOS AirPlay sheet. The audio element ALSO carries
 *      `x-webkit-airplay="allow"` so AirPlay-aware sites work without
 *      this picker — but the explicit button gives non-AirPlay-savvy
 *      users a discoverable affordance.
 *
 *   2. Chromecast (Chrome / Edge desktop + Chrome on Android).
 *      Lazy-loaded Cast Sender SDK (~110KB, gz). Loads ONLY when the
 *      user clicks the picker — keeping the cost off /listen's first
 *      paint. After init, `chrome.cast.requestSession` opens the
 *      browser's Cast picker. We then load the audio URL on the
 *      receiver via the default media receiver.
 *
 *   3. Home Assistant — link out to the HA media browser, where the
 *      user can pick any speaker HA controls (Sonos, multi-room,
 *      ESPHome, MPD, etc.). The HA panel exposes our media-source so
 *      the same surah/ayah is reachable from there.
 *
 * Browser support gating:
 *   - AirPlay: Safari only — feature-detect `WebKitPlaybackTargetAvailabilityEvent`.
 *   - Cast:   Chrome/Edge only — feature-detect `chrome.cast`.
 *   - HA:     always available (link), greyed out if no haUrl is wired.
 *
 * Accessibility: focus-trapped popover, ESC closes, all buttons have
 * aria-label. Reduced-motion-aware open animation.
 */
import { useEffect, useRef, useState } from 'react';

import type { ReactNode } from 'react';

interface Props {
  /**
   * Live <audio> element ref — required for AirPlay programmatic
   * invocation. Cast doesn't need it (it loads the URL fresh on the
   * receiver).
   */
  readonly audioRef: { current: HTMLAudioElement | null };
  /** Current playback URL, used by the Cast loader. */
  readonly currentSrc: string | null;
  /**
   * Optional Home Assistant base URL. When provided, the "Open in
   * Home Assistant" affordance routes there. Pulled from
   * NEXT_PUBLIC_HA_URL or the user's own configured HA host.
   */
  readonly haUrl?: string | null;
  /** Title displayed in the Cast receiver UI when launched. */
  readonly title?: string;
  /** Reciter / artist subtitle for the Cast UI. */
  readonly artist?: string;
}

interface AirPlayCapableAudio extends HTMLMediaElement {
  webkitShowPlaybackTargetPicker?: () => void;
}

interface CastSession {
  loadMedia(req: unknown): Promise<void>;
}

interface CastApi {
  framework?: {
    CastContext: {
      getInstance(): {
        setOptions(opts: unknown): void;
        requestSession(): Promise<void>;
        getCurrentSession(): CastSession | null;
      };
    };
    CastContextEventType: { SESSION_STATE_CHANGED: string };
  };
}

interface ChromeCastWindow extends Window {
  chrome?: { cast?: unknown } & Record<string, unknown>;
  cast?: CastApi;
  __qalaamCastReady?: boolean;
  __onGCastApiAvailable?: (avail: boolean) => void;
}

const CAST_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const DEFAULT_RECEIVER_APP_ID = 'CC1AD845'; // Google Default Media Receiver

// Module-singleton promise — first caller installs `__onGCastApiAvailable`
// + injects the script tag, every later caller awaits the same promise.
// Without this, a second caller would replace the global and never fire,
// because the Cast SDK only invokes `__onGCastApiAvailable` once per page.
let castSdkPromise: Promise<boolean> | null = null;

function loadCastSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (castSdkPromise) return castSdkPromise;
  const w = window as ChromeCastWindow;
  if (w.__qalaamCastReady) {
    castSdkPromise = Promise.resolve(Boolean(w.cast?.framework));
    return castSdkPromise;
  }
  castSdkPromise = new Promise<boolean>((resolve) => {
    w.__onGCastApiAvailable = (available: boolean): void => {
      w.__qalaamCastReady = true;
      resolve(available && Boolean(w.cast?.framework));
    };
    // Append the script even if a previous attempt left a tag in the
    // DOM — duplicate tags are harmless, and a stale tag may have
    // already fired the (now-overwritten) handler.
    const script = document.createElement('script');
    script.src = CAST_SDK_URL;
    script.async = true;
    script.onerror = (): void => {
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return castSdkPromise;
}

function detectAirPlay(): boolean {
  if (typeof window === 'undefined') return false;
  // Safari + iOS Safari fire WebKitPlaybackTargetAvailabilityEvent on
  // <video>/<audio> when an AirPlay target is reachable. Spec is
  // Safari-only; checking for the constructor is a fast capability probe.
  return 'WebKitPlaybackTargetAvailabilityEvent' in window;
}

function detectCastCapable(): boolean {
  if (typeof window === 'undefined') return false;
  // Cast SDK only loads on Chromium + a couple of forks. UA sniff is
  // imperfect but the SDK itself is the source of truth — feature-detect
  // chrome.cast after it loads.
  const w = window as ChromeCastWindow;
  return Boolean(w.chrome) && /Chrome|Edg/.test(navigator.userAgent);
}

export function SendToPicker({ audioRef, currentSrc, haUrl, title, artist }: Props): ReactNode {
  const [open, setOpen] = useState(false);
  const [castAvailable, setCastAvailable] = useState<boolean | null>(null);
  const [castStatus, setCastStatus] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Capability probes read `window` / `navigator` and so produce
  // different results on SSR (always false) vs client (variable).
  // Gate render with a `mounted` flag so the server emits `null` and
  // the client emits the same `null` on first paint, then upgrades to
  // the real picker — no hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const airplayCapable = mounted ? detectAirPlay() : false;
  const castCapable = mounted ? detectCastCapable() : false;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClickAway(e: MouseEvent): void {
      const t = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(t) &&
        !triggerRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickAway);
    return (): void => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickAway);
    };
  }, [open]);

  // Pre-warm cast capability check on first popover open — avoids the
  // user clicking "Cast" and then watching the SDK load.
  useEffect(() => {
    if (!open || !castCapable || castAvailable !== null) return;
    void loadCastSdk().then((ok) => {
      setCastAvailable(ok);
      if (ok) {
        const w = window as ChromeCastWindow;
        try {
          w.cast?.framework?.CastContext.getInstance().setOptions({
            receiverApplicationId: DEFAULT_RECEIVER_APP_ID,
            autoJoinPolicy: 'origin_scoped',
          });
        } catch {
          /* SDK quirk on init — non-fatal */
        }
      }
    });
  }, [open, castCapable, castAvailable]);

  function handleAirPlay(): void {
    const a = audioRef.current as AirPlayCapableAudio | null;
    if (!a?.webkitShowPlaybackTargetPicker) return;
    try {
      a.webkitShowPlaybackTargetPicker();
      setOpen(false);
    } catch {
      /* user cancelled or unsupported */
    }
  }

  async function handleCast(): Promise<void> {
    if (!castAvailable || !currentSrc) return;
    setCastStatus('connecting…');
    const w = window as ChromeCastWindow;
    const ctx = w.cast?.framework?.CastContext.getInstance();
    if (!ctx) {
      setCastStatus('cast unavailable');
      return;
    }
    try {
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) {
        setCastStatus('no session');
        return;
      }
      // Build a chrome.cast.media.MediaInfo through the SDK's globals.
      // We're using `unknown` casts because chrome.cast types are loaded
      // dynamically by the SDK and don't have @types.
      const chromeCast = (w.chrome as { cast?: { media?: Record<string, unknown> } }).cast;
      const MediaInfo = chromeCast?.media?.MediaInfo as
        | (new (url: string, contentType: string) => Record<string, unknown>)
        | undefined;
      const LoadRequest = chromeCast?.media?.LoadRequest as
        | (new (info: Record<string, unknown>) => Record<string, unknown>)
        | undefined;
      if (!MediaInfo || !LoadRequest) {
        setCastStatus('SDK incomplete');
        return;
      }
      const mediaInfo = new MediaInfo(currentSrc, 'audio/mpeg');
      mediaInfo.metadata = {
        metadataType: 0, // GENERIC
        title: title ?? 'Quran recitation',
        subtitle: artist ?? '',
      };
      const loadRequest = new LoadRequest(mediaInfo);
      await session.loadMedia(loadRequest as unknown);
      setCastStatus('casting');
      setOpen(false);
    } catch (err) {
      setCastStatus(`error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  function handleHa(): void {
    if (!haUrl) return;
    const target = `${haUrl.replace(/\/+$/, '')}/media-browser/qalaam`;
    window.open(target, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  // SSR + first-paint client + truly nothing-available all return null
  // (capability probes are always false until `mounted`, and once
  // mounted, if no transport is reachable we still hide the picker).
  if (!mounted) return null;
  if (!airplayCapable && !castCapable && !haUrl) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Send to another speaker"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
        title="Send to another speaker"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="M3 5h18v3" strokeLinecap="round" />
          <path d="M3 19l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 13l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="18" cy="17" r="2.5" />
        </svg>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Cast targets"
          className="border-hairline bg-paper absolute bottom-full right-0 mb-2 w-64 overflow-hidden rounded-2xl border shadow-2xl"
          style={{ animation: 'q-popover-rise 160ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <p className="smallcaps text-leaf border-hairline border-b px-4 py-2 text-[10px] tracking-widest">
            Send recitation to
          </p>
          <ul className="m-0 list-none p-0">
            <li>
              <button
                type="button"
                role="menuitem"
                disabled={!airplayCapable}
                onClick={handleAirPlay}
                className="hover:bg-paper-100 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="bg-leaf-300/30 inline-flex h-9 w-9 items-center justify-center rounded-full">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden
                  >
                    <path
                      d="M3 17h6m6 0h6M9 12l3-3 3 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M5 7h14" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="text-ink block text-sm font-medium">AirPlay</span>
                  <span className="text-ink-muted block text-xs">
                    {airplayCapable ? 'Pick an Apple TV / HomePod' : 'Safari only'}
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                disabled={!castCapable || castAvailable === false || !currentSrc}
                onClick={() => {
                  void handleCast();
                }}
                className="hover:bg-paper-100 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="bg-leaf-300/30 inline-flex h-9 w-9 items-center justify-center rounded-full">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden
                  >
                    <rect x="3" y="5" width="18" height="13" rx="2" />
                    <path
                      d="M3 11a8 8 0 0 1 8 8M3 14a5 5 0 0 1 5 5M3 17a2 2 0 0 1 2 2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="text-ink block text-sm font-medium">Cast</span>
                  <span className="text-ink-muted block text-xs">
                    {!castCapable
                      ? 'Chrome / Edge only'
                      : castAvailable === false
                        ? 'Cast SDK unavailable'
                        : (castStatus ?? 'Pick a Chromecast or Google TV')}
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                disabled={!haUrl}
                onClick={handleHa}
                className="hover:bg-paper-100 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="bg-leaf-300/30 inline-flex h-9 w-9 items-center justify-center rounded-full">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden
                  >
                    <path d="M3 12l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 10v10h14V10" strokeLinejoin="round" />
                    <circle cx="12" cy="14" r="2.5" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="text-ink block text-sm font-medium">Home Assistant</span>
                  <span className="text-ink-muted block text-xs">
                    {haUrl ? 'Sonos, ESPHome, MPD…' : 'Set NEXT_PUBLIC_HA_URL'}
                  </span>
                </span>
              </button>
            </li>
          </ul>
          <p className="text-ink-muted/80 border-hairline border-t px-4 py-2 text-[10px] leading-relaxed">
            Cast keeps your phone free — the recitation plays from the receiver, not your device.
          </p>
        </div>
      ) : null}
    </div>
  );
}
